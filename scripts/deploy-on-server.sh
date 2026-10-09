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
# Doro CI 와 Gradle 캐시를 나누어 쓴다: 같은 캐시 폴더를 동시에 쓰면 Gradle 의 캐시 잠금 대기(60초)로 빌드가 실패할 수 있다.
CACHE="${CI_CACHE_DIR:-$HOME/.cache/blog-deploy}"
TS="$(date +%Y%m%d-%H%M%S)"
SNAP="$HOME/backups/pre-blog-deploy-$TS"
# 배포 로그를 서버에도 남긴다(러너가 로그 파일을 업로드 후 지우므로). 실패하면 GitHub 주석으로 마지막 줄도 남긴다.
LOG_DIR="$HOME/logs"; mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/blog-deploy-$TS.log"
exec > >(tee -a "$LOG_FILE") 2>&1
on_exit() {
  local rc=$?
  if [ "$rc" -ne 0 ] && [ "${GITHUB_ACTIONS:-}" = true ]; then
    printf '::error title=deploy-on-server.sh failed (exit %s)::%s\n' "$rc" "$(tail -n 25 "$LOG_FILE" | sed 's/%/%25/g' | awk '{printf "%s%%0A", $0}')"
  fi
}
trap on_exit EXIT
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
# 게이트웨이의 공개 하위 경로(예: /blog). 서버 .env 의 BLOG_WEB_BASE_PATH 에서 읽고, 비어 있으면 루트('/')로 빌드한다(값은 비밀이 아니다).
# 이 값은 백엔드 환경변수(BLOG_WEB_BASE_PATH)와 같아야 한다: 웹 빌드의 기준 경로와 로그인 쿠키 Path/복귀 주소가 어긋나면 로그인이 깨진다.
BASE_PATH="$(grep -E '^BLOG_WEB_BASE_PATH=' "$REMOTE_DIR/.env" 2>/dev/null | head -1 | cut -d= -f2- | tr -d "\"'" || true)"
log "  웹 기준 경로: ${BASE_PATH:-/ (루트)}"
docker run "${COMMON[@]}" -e npm_config_cache=/cache/npm -e VITE_BASE_PATH="$BASE_PATH" -w "/work/$BLOG_NAME/web" "$NODE_IMAGE" \
  sh -ec 'npm ci --no-audit --no-fund && npm run build'
[ -f "$BLOG_SRC/$JAR_REL" ] || die "$JAR_REL 이 만들어지지 않았다"
[ -d "$BLOG_SRC/web/dist" ] || die "web/dist 가 만들어지지 않았다"

# 서비스 워커가 미리 캐시하는 주소가 게이트웨이에서 이동 없이 나가는지 컨테이너를 바꾸기 전에 점검한다(Doro 저장소의 공용 스크립트).
SW_CHECK="$DORO_SRC/scripts/check-sw-precache.sh"
sw_check() {  # <pre|post>
  if [ ! -x "$SW_CHECK" ]; then log "경고: $SW_CHECK 가 없어 서비스 워커 미리 캐시 점검을 건너뛴다"; return 0; fi
  "$SW_CHECK" "$BLOG_SRC/web/dist" "${BASE_PATH:-}/" "$1"
}
sw_check pre || die "서비스 워커 미리 캐시 주소가 게이트웨이에서 올바르게 나가지 않는다. 배포하지 않는다"

log "== 롤백 스냅샷 + DB 백업 =="
mkdir -p "$SNAP"
cp -a "$REMOTE_DIR/build/libs" "$SNAP/libs" 2>/dev/null || true
cp -a "$REMOTE_DIR/web/dist" "$SNAP/dist" 2>/dev/null || true
for svc in backend web; do
  img="$(docker inspect --format '{{.Image}}' "doro-blog-$svc" 2>/dev/null || true)"
  [ -n "$img" ] && docker tag "$img" "doro-blog-rollback:$svc-$TS" && echo "$svc $img" >> "$SNAP/images.txt"
done
"$HOME/ops/backup.sh" backup | tail -2

# 배포가 성공한 뒤에만 오래된 산출물을 정리한다(정리 실패가 배포를 실패로 만들지 않는다). 서버 디스크(128GB)를 채우는 주범이 롤백 이미지와 빌드 캐시였다.
#  - 롤백 이미지: 종류별(backend web)로 최근 ROLLBACK_KEEP 개만 남긴다. 실행 중인 이미지는 docker 가 지우지 않는다.
#  - 롤백 스냅샷 폴더(~/backups/pre-blog-deploy-*): 최근 SNAPSHOT_KEEP 개만 남긴다.
#  - 빌드 캐시: BUILD_CACHE_KEEP_HOURS 시간보다 오래된 것만 지운다(다른 서비스 CI 가 방금 만든 캐시는 건드리지 않는다).
prune_old_releases() {
  local keep="${ROLLBACK_KEEP:-5}" snap_keep="${SNAPSHOT_KEEP:-5}" kind tag dir
  for kind in backend web; do
    docker images "doro-blog-rollback" --format '{{.Tag}}' | grep "^$kind-" | sort -r | tail -n +"$((keep + 1))" | while read -r tag; do
      docker rmi "doro-blog-rollback:$tag" >/dev/null 2>&1 || true
    done
  done
  ls -1d "$HOME/backups/pre-blog-deploy-"* 2>/dev/null | sort -r | tail -n +"$((snap_keep + 1))" | while read -r dir; do
    rm -rf -- "$dir"
  done
  docker builder prune -f --filter "until=${BUILD_CACHE_KEEP_HOURS:-72}h" 2>&1 | tail -1 || true
  log "  정리 완료: 롤백 이미지 종류별 ${keep}개, 스냅샷 ${snap_keep}개, 빌드 캐시 ${BUILD_CACHE_KEEP_HOURS:-72}시간 초과분 삭제. 디스크: $(df -h / | awk 'NR==2{print $5" 사용, 여유 "$4}')"
}

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

# 컨테이너가 다시 만들어지면 IP 가 바뀐다. 게이트웨이(nginx)는 compose 밖에 있고 업스트림 이름을 시작·reload 때만 해석해 IP 를 기억하므로,
# 그대로 두면 옛 IP 로 접속해 502 가 난다(배포·재시작 직후 화면이 비어 보이는 원인). 그래서 배포 직후 설정을 검증하고 무중단 reload 한 뒤
# 게이트웨이 경유 응답까지 확인한다. 게이트웨이 컨테이너가 없으면 경고만 남기고 건너뛴다.
reload_gateway() {
  local gw="${GATEWAY_CONTAINER:-doro-gateway}" i code=""
  if ! docker inspect "$gw" >/dev/null 2>&1; then
    log "경고: $gw 컨테이너가 없어 게이트웨이 reload 를 건너뛴다"
    return 0
  fi
  docker exec "$gw" nginx -t >/dev/null 2>&1 || { log "ERROR: 게이트웨이 설정 검증(nginx -t) 실패 — reload 하지 않는다"; return 1; }
  docker exec "$gw" nginx -s reload >/dev/null 2>&1 || { log "ERROR: 게이트웨이 reload 실패"; return 1; }
  for i in $(seq 1 "${GATEWAY_CHECK_TRIES:-15}"); do
    code="$(curl -sk -o /dev/null -w '%{http_code}' -m 5 "${GATEWAY_CHECK_URL:-https://127.0.0.1/api/v1/posts?page=0&size=1}" || true)"
    if [ "$code" = 200 ]; then log "게이트웨이 reload 후 경유 응답 확인(200)"; return 0; fi
    sleep "${GATEWAY_CHECK_SLEEP:-2}"
  done
  log "ERROR: 게이트웨이 reload 후 경유 응답이 200 이 아니다(마지막: ${code:-없음})"
  return 1
}

log "== 반영 (compose 파일은 보내지 않는다) =="
cp -f "$BLOG_SRC/Dockerfile" "$REMOTE_DIR/Dockerfile"
cp -f "$BLOG_SRC/web/nginx.conf" "$BLOG_SRC/web/Dockerfile" "$REMOTE_DIR/web/"
apply_release "$BLOG_SRC/$JAR_REL" "$BLOG_SRC/web/dist"

log "== 헬스체크 (최대 ${HEALTH_TIMEOUT_SEC}s) =="
if wait_healthy; then
  # 앱은 정상이다. 게이트웨이 reload 가 실패하면 502 가 남으므로 배포를 실패로 표시한다(롤백은 하지 않는다).
  reload_gateway || die "앱은 정상이지만 게이트웨이가 새 컨테이너를 가리키지 못한다. 수동 확인 필요: docker exec doro-gateway nginx -s reload"
  sw_check post || die "배포는 됐지만 서비스 워커 미리 캐시 주소가 올바르지 않다. 설치된 앱에 잘못된 화면이 저장될 수 있어 수동 확인 필요"
  prune_old_releases || log "경고: 오래된 산출물 정리에 실패했다(배포는 성공)"
  log "완료. 롤백 지점: $SNAP, 이미지 태그 doro-blog-rollback:{backend,web}-$TS"
  exit 0
fi

log "ERROR: 헬스체크 실패. 직전 릴리스로 자동 복구한다."
docker logs --tail 40 doro-blog-backend || true
if [ -d "$SNAP/libs" ] && [ -d "$SNAP/dist" ]; then
  apply_release "$SNAP/libs/doro-blog-0.0.1-SNAPSHOT.jar" "$SNAP/dist"
  if wait_healthy; then reload_gateway || log "ERROR: 복구는 됐지만 게이트웨이 reload 실패. 수동 확인 필요."; log "복구 완료: 직전 릴리스가 서비스 중이다."; else log "ERROR: 복구 후에도 헬스체크 실패. 수동 확인 필요 ($SNAP)."; fi
else
  log "ERROR: 스냅샷이 없어 자동 복구할 수 없다. 수동 확인 필요."
fi
exit 1
