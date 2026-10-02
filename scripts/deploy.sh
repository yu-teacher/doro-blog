#!/usr/bin/env bash
# doro-blog 를 운영 서버(mini)에 배포한다. 로컬(Mac)에서 실행한다.
#
#   scripts/deploy.sh --dry-run    # 빌드/테스트 없이 서버 상태만 점검하고 무엇을 할지 출력
#   scripts/deploy.sh              # 테스트 -> 빌드 -> 롤백 스냅샷 -> DB 백업 -> 전송 -> 재기동 -> 헬스체크
#   scripts/deploy.sh --skip-tests # 테스트를 건너뛴다 (이미 통과를 확인한 경우만)
#
# 서버의 docker-compose.prod.yml 은 로컬 사본과 다르다(MinIO 서비스 포함). 절대 덮어쓰지 않는다.
# 롤백: 서버의 ~/backups/pre-blog-deploy-<ts> 에 이전 jar/dist 가, 이미지 태그 doro-blog-rollback:* 가 남는다.
set -Eeuo pipefail

SERVER="${DEPLOY_HOST:-mini}"
REMOTE_DIR="${DEPLOY_DIR:-doro-blog}"
COMPOSE="docker-compose.prod.yml"
JAR="build/libs/doro-blog-0.0.1-SNAPSHOT.jar"
HEALTH_TIMEOUT_SEC=120

DRY_RUN=false
RUN_TESTS=true
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
    --skip-tests) RUN_TESTS=false ;;
    *) echo "알 수 없는 옵션: $arg" >&2; exit 2 ;;
  esac
done

cd "$(dirname "${BASH_SOURCE[0]}")/.."
SSH=(ssh -o BatchMode=yes -o ConnectTimeout=10 "$SERVER")
TS="$(date +%Y%m%d-%H%M%S)"
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

# ------------------------------------------------------------ 사전 점검 (읽기 전용)
log "== 사전 점검 =="
[ -z "$(git status --porcelain)" ] || die "커밋되지 않은 변경이 있다. 커밋한 뒤 배포한다"
"${SSH[@]}" true || die "$SERVER 에 ssh 로 접속할 수 없다"
"${SSH[@]}" "test -f ~/$REMOTE_DIR/$COMPOSE && test -f ~/$REMOTE_DIR/.env" || die "서버에 ~/$REMOTE_DIR/$COMPOSE 또는 .env 가 없다"
"${SSH[@]}" "test -x ~/ops/backup.sh" || die "서버에 ~/ops/backup.sh 가 없다 (DB 백업 없이 배포하지 않는다)"
log "  commit: $(git rev-parse --short HEAD) $(git log -1 --format=%s)"
log "  서버 컨테이너: $("${SSH[@]}" "docker ps --format '{{.Names}}={{.Status}}' | grep doro-blog | tr '\n' ' '")"

if [ "$DRY_RUN" = true ]; then
  log "--dry-run: 여기서 종료한다. 실제 배포는 옵션 없이 실행"
  exit 0
fi

# ------------------------------------------------------------ 테스트 + 빌드
if [ "$RUN_TESTS" = true ]; then
  log "== 백엔드 테스트 =="; ./gradlew test
  log "== 웹 테스트/린트/타입 =="; (cd web && npm test --silent && npm run lint --silent && npx tsc -b)
fi
log "== 빌드 =="
./gradlew clean bootJar -x test
(cd web && npm run build --silent)
[ -f "$JAR" ] || die "$JAR 이 만들어지지 않았다"
[ -d web/dist ] || die "web/dist 가 만들어지지 않았다"

# ------------------------------------------------------------ 롤백 스냅샷 + DB 백업
log "== 롤백 스냅샷 + DB 백업 =="
"${SSH[@]}" bash -s -- "$REMOTE_DIR" "$TS" <<'REMOTE'
set -Eeuo pipefail
dir="$HOME/$1"; ts="$2"; snap="$HOME/backups/pre-blog-deploy-$ts"
mkdir -p "$snap"
cp -a "$dir/build/libs" "$snap/libs" 2>/dev/null || true
cp -a "$dir/web/dist" "$snap/dist" 2>/dev/null || true
for svc in backend web; do
  img="$(docker inspect --format '{{.Image}}' "doro-blog-$svc" 2>/dev/null || true)"
  [ -n "$img" ] && docker tag "$img" "doro-blog-rollback:$svc-$ts" && echo "$svc $img" >> "$snap/images.txt"
done
echo "스냅샷: $snap"
"$HOME/ops/backup.sh" backup | tail -2
REMOTE

# ------------------------------------------------------------ 전송 (compose 파일은 보내지 않는다)
log "== 전송 =="
"${SSH[@]}" "mkdir -p ~/$REMOTE_DIR/build/libs ~/$REMOTE_DIR/web/dist"
rsync -az "$JAR" "$SERVER:$REMOTE_DIR/build/libs/"
rsync -az --delete web/dist/ "$SERVER:$REMOTE_DIR/web/dist/"
rsync -az web/nginx.conf web/Dockerfile "$SERVER:$REMOTE_DIR/web/"
rsync -az Dockerfile "$SERVER:$REMOTE_DIR/"

# ------------------------------------------------------------ 재기동 + 헬스체크
log "== 재기동 =="
"${SSH[@]}" "cd ~/$REMOTE_DIR && docker compose -f $COMPOSE up -d --build blog-backend blog-web" 2>&1 | tail -5

log "== 헬스체크 (최대 ${HEALTH_TIMEOUT_SEC}s) =="
deadline=$((SECONDS + HEALTH_TIMEOUT_SEC))
while :; do
  state="$("${SSH[@]}" "docker inspect --format '{{.State.Health.Status}}' doro-blog-backend 2>/dev/null || echo none")"
  [ "$state" = healthy ] && break
  [ $SECONDS -lt $deadline ] || {
    "${SSH[@]}" "docker logs --tail 40 doro-blog-backend" || true
    die "backend 가 healthy 가 되지 않았다($state). 롤백: ssh $SERVER 에서 ~/backups/pre-blog-deploy-$TS 의 libs/dist 를 복원하고 재빌드하거나 doro-blog-rollback:*-$TS 이미지를 되돌린다"
  }
  sleep 3
done
"${SSH[@]}" "curl -fsS -o /dev/null -w 'feed %{http_code}\n' 'http://127.0.0.1:3002/api/v1/posts?page=0&size=1'" \
  || die "web 경유 피드 조회 실패"
log "완료. 롤백 지점: ~/backups/pre-blog-deploy-$TS, 이미지 태그 doro-blog-rollback:{backend,web}-$TS"
