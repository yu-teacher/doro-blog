#!/usr/bin/env bash
# 서버(mini)의 셀프호스티드 러너가 실행하는 배포: 컨테이너 안에서 빌드 -> 롤백 스냅샷 + DB 백업 -> 반영 -> 헬스체크 -> 실패하면 자동 복구.
# 로컬(Mac)에서 ssh 로 하는 scripts/deploy.sh 와 같은 절차를 서버에서 직접 수행한다.
# 서버에는 Java 21 만 있어서 Java 25 / Node 24 는 Docker 이미지로 가져온다. 서버의 docker-compose.prod.yml 은 덮어쓰지 않는다.
#
#   scripts/deploy-on-server.sh <doro-blog 체크아웃> <Doro 체크아웃>
#   scripts/deploy-on-server.sh --dry-run <...>   # 사전 점검만
set -Eeuo pipefail

DRY_RUN=false
if [ "${1:-}" = "--dry-run" ]; then DRY_RUN=true; shift; fi
BLOG_SRC="$(cd "${1:?doro-blog 체크아웃 경로가 필요하다}" && pwd)"
DORO_SRC="$(cd "${2:?Doro 체크아웃 경로가 필요하다}" && pwd)"
[ "$(dirname "$BLOG_SRC")" = "$(dirname "$DORO_SRC")" ] || { echo "두 체크아웃은 같은 부모 디렉터리 아래 형제여야 한다 (build.gradle 의 includeBuild('../Doro'))" >&2; exit 2; }
PARENT="$(dirname "$BLOG_SRC")"; BLOG_NAME="$(basename "$BLOG_SRC")"

REMOTE_DIR="${DEPLOY_DIR:-$HOME/doro-blog}"
COMPOSE="docker-compose.prod.yml"
JAR_REL="build/libs/doro-blog-0.0.1-SNAPSHOT.jar"
HEALTH_TIMEOUT_SEC="${HEALTH_TIMEOUT_SEC:-120}"
JAVA_IMAGE="${CI_JAVA_IMAGE:-gradle:9.5.1-jdk25}"
NODE_IMAGE="${CI_NODE_IMAGE:-node:24-alpine}"
CACHE="${CI_CACHE_DIR:-$HOME/.cache/doro-ci}"
TS="$(date +%Y%m%d-%H%M%S)"
SNAP="$HOME/backups/pre-blog-deploy-$TS"
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

log "== 사전 점검 =="
[ -f "$REMOTE_DIR/$COMPOSE" ] && [ -f "$REMOTE_DIR/.env" ] || die "$REMOTE_DIR/$COMPOSE 또는 .env 가 없다"
[ -x "$HOME/ops/backup.sh" ] || die "$HOME/ops/backup.sh 가 없다 (DB 백업 없이 배포하지 않는다)"
docker info >/dev/null 2>&1 || die "docker 를 사용할 수 없다"
log "  commit: $(git -C "$BLOG_SRC" rev-parse --short HEAD 2>/dev/null || echo '?'), 대상: $REMOTE_DIR"
if [ "$DRY_RUN" = true ]; then log "--dry-run: 여기서 종료"; exit 0; fi

mkdir -p "$CACHE/gradle" "$CACHE/npm"
LIMITS=(--cpus "${CI_CPUS:-2}" --memory "${CI_MEMORY:-4g}")
COMMON=(--rm "${LIMITS[@]}" --user "$(id -u):$(id -g)" -e HOME=/tmp -v "$CACHE:/cache" -v "$PARENT:/work")

log "== 빌드: 백엔드 jar (테스트는 CI 에서 통과한 커밋만 여기까지 온다) =="
docker run "${COMMON[@]}" -e GRADLE_USER_HOME=/cache/gradle -w "/work/$BLOG_NAME" "$JAVA_IMAGE" \
  gradle clean bootJar -x test --no-daemon --console=plain
log "== 빌드: 웹 =="
docker run "${COMMON[@]}" -e npm_config_cache=/cache/npm -w "/work/$BLOG_NAME/web" "$NODE_IMAGE" \
  sh -ec 'npm ci --no-audit --no-fund && npm run build'
[ -f "$BLOG_SRC/$JAR_REL" ] || die "$JAR_REL 이 만들어지지 않았다"
[ -d "$BLOG_SRC/web/dist" ] || die "web/dist 가 만들어지지 않았다"

log "== 롤백 스냅샷 + DB 백업 =="
mkdir -p "$SNAP"
cp -a "$REMOTE_DIR/build/libs" "$SNAP/libs" 2>/dev/null || true
cp -a "$REMOTE_DIR/web/dist" "$SNAP/dist" 2>/dev/null || true
for svc in backend web; do
  img="$(docker inspect --format '{{.Image}}' "doro-blog-$svc" 2>/dev/null || true)"
  [ -n "$img" ] && docker tag "$img" "doro-blog-rollback:$svc-$TS" && echo "$svc $img" >> "$SNAP/images.txt"
done
"$HOME/ops/backup.sh" backup | tail -2

apply_release() {  # $1=jar 경로, $2=dist 경로
  mkdir -p "$REMOTE_DIR/build/libs" "$REMOTE_DIR/web/dist"
  cp -f "$1" "$REMOTE_DIR/build/libs/doro-blog-0.0.1-SNAPSHOT.jar"
  rsync -a --delete "$2/" "$REMOTE_DIR/web/dist/"
  (cd "$REMOTE_DIR" && docker compose -f "$COMPOSE" up -d --build blog-backend blog-web) 2>&1 | tail -5
}
wait_healthy() {
  local deadline=$((SECONDS + HEALTH_TIMEOUT_SEC))
  until [ "$(docker inspect --format '{{.State.Health.Status}}' doro-blog-backend 2>/dev/null || echo none)" = healthy ]; do
    [ $SECONDS -lt $deadline ] || return 1
    sleep 3
  done
  curl -fsS -o /dev/null "http://127.0.0.1:3002/api/v1/posts?page=0&size=1"
}

log "== 반영 (compose 파일은 보내지 않는다) =="
cp -f "$BLOG_SRC/Dockerfile" "$REMOTE_DIR/Dockerfile"
cp -f "$BLOG_SRC/web/nginx.conf" "$BLOG_SRC/web/Dockerfile" "$REMOTE_DIR/web/"
apply_release "$BLOG_SRC/$JAR_REL" "$BLOG_SRC/web/dist"

log "== 헬스체크 (최대 ${HEALTH_TIMEOUT_SEC}s) =="
if wait_healthy; then
  log "완료. 롤백 지점: $SNAP, 이미지 태그 doro-blog-rollback:{backend,web}-$TS"
  exit 0
fi

log "ERROR: 헬스체크 실패. 직전 릴리스로 자동 복구한다."
docker logs --tail 40 doro-blog-backend || true
if [ -d "$SNAP/libs" ] && [ -d "$SNAP/dist" ]; then
  apply_release "$SNAP/libs/doro-blog-0.0.1-SNAPSHOT.jar" "$SNAP/dist"
  if wait_healthy; then log "복구 완료: 직전 릴리스가 서비스 중이다."; else log "ERROR: 복구 후에도 헬스체크 실패. 수동 확인 필요 ($SNAP)."; fi
else
  log "ERROR: 스냅샷이 없어 자동 복구할 수 없다. 수동 확인 필요."
fi
exit 1
