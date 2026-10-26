#!/usr/bin/env bash
# 서버(mini)에서 실행한다: 블로그의 푸시 알림(플랫폼 알림 서비스로 요청)을 켜거나 끈다. 여러 번 실행해도 결과가 같다(멱등). 토큰 값은 화면에 출력하지 않는다.
#
#   ssh mini 'bash -s -- --check'           < scripts/enable-notify.sh   # 읽기 전용: 현재 상태(기본)
#   ssh mini 'bash -s -- --apply'           < scripts/enable-notify.sh   # 설정 파일만 고친다(컨테이너는 그대로)
#   ssh mini 'bash -s -- --apply --restart' < scripts/enable-notify.sh   # 위 + 블로그 백엔드 컨테이너를 다시 만든다(몇 초)
#   ssh mini 'bash -s -- --off --restart'   < scripts/enable-notify.sh   # 끈다(토큰을 비운다: 푸시 요청·설정 API 모두 꺼지고 앱 안 알림은 그대로)
#
# 하는 일
#   1) ~/doro-notify/.env 의 NOTIFY_INTERNAL_TOKENS 에서 'blog:' 토큰을 읽어(출력 안 함) ~/doro-blog/.env 의 BLOG_NOTIFY_TOKEN 에 넣는다(백업 후).
#      --off 는 BLOG_NOTIFY_TOKEN 을 비운다. 켜짐/꺼짐은 이 토큰 하나로 정해진다.
#   2) ~/doro-blog/docker-compose.prod.yml 이 BLOG_NOTIFY_TOKEN 을 컨테이너에 전달하지 않으면 환경변수 줄 하나를 추가한다(백업 후).
#   3) (--restart) 블로그 백엔드(blog-backend)만 다시 만들고 healthy 를 기다린다.
# 하지 않는 일: 알림 서비스 설정 변경, 게이트웨이 변경, 블로그 코드 배포.
# 이 스크립트는 `ssh mini 'bash -s -- …' < 스크립트` 로 표준입력으로 실행된다. 그래서 안에서 쓰는 docker 명령은 모두 </dev/null 로 표준입력을 막는다
# (안 막으면 docker 가 이 스크립트의 나머지를 읽어 가서 스크립트가 조용히 끝난다).
# 환경변수(리허설·점검용, 기본값은 운영): BLOG_DIR, NOTIFY_DIR, BLOG_CONTAINER, BLOG_SERVICE
set -Eeuo pipefail

BLOG_DIR="${BLOG_DIR:-$HOME/doro-blog}"
NOTIFY_DIR="${NOTIFY_DIR:-$HOME/doro-notify}"
BLOG_CONTAINER="${BLOG_CONTAINER:-doro-blog-backend}"
BLOG_SERVICE="${BLOG_SERVICE:-blog-backend}"
APPLY=false; OFF=false; RESTART=false
for a in "$@"; do
  case "$a" in
    --check) ;;
    --apply) APPLY=true ;;
    --off) OFF=true; APPLY=true ;;
    --restart) RESTART=true ;;
    *) echo "사용법: bash -s -- [--check | --apply | --off] [--restart]" >&2; exit 2 ;;
  esac
done
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }
get_var() { grep -m1 "^$2=" "$1" 2>/dev/null | cut -d= -f2- || true; }
set_var() {
  local file="$1" key="$2" value="$3" tmp
  tmp="$(mktemp "$file.XXXXXX")"
  grep -v "^$key=" "$file" > "$tmp" || true
  printf '%s=%s\n' "$key" "$value" >> "$tmp"
  chmod 600 "$tmp"; mv "$tmp" "$file"
}
ENV_FILE="$BLOG_DIR/.env"; COMPOSE="$BLOG_DIR/docker-compose.prod.yml"; NOTIFY_ENV="$NOTIFY_DIR/.env"
[ -f "$ENV_FILE" ] && [ -f "$COMPOSE" ] || die "$BLOG_DIR 의 .env 또는 docker-compose.prod.yml 이 없다"
passes() { grep -q "BLOG_NOTIFY_TOKEN" "$COMPOSE"; }
blog_token_in_notify() { get_var "$NOTIFY_ENV" NOTIFY_INTERNAL_TOKENS | tr ',' '\n' | grep -m1 '^blog:' | cut -d: -f2- || true; }

describe() {
  local tok ntok
  tok="$(get_var "$ENV_FILE" BLOG_NOTIFY_TOKEN)"; ntok="$(blog_token_in_notify)"
  log "블로그 .env: 푸시 알림 $([ -n "$tok" ] && echo "켜짐(토큰 ${#tok}자)" || echo "꺼짐(토큰 없음)") | compose 전달: $(passes && echo 예 || echo 아니오)"
  log "알림 서비스 .env 의 blog 호출자 토큰: $([ -n "$ntok" ] && echo "있음(${#ntok}자)" || echo 없음)"
  if [ -n "$tok" ] && [ -n "$ntok" ]; then [ "$tok" = "$ntok" ] && log "두 토큰이 같다" || log "경고: 블로그 쪽 토큰과 알림 서비스 쪽 토큰이 다르다"; fi
  log "블로그 컨테이너: $(docker inspect "$BLOG_CONTAINER" --format '{{.State.Status}}/{{.State.Health.Status}} (시작 {{.State.StartedAt}})' </dev/null 2>/dev/null || echo 없음)"
}
if [ "$APPLY" != true ]; then describe; exit 0; fi

TS="$(date +%Y%m%d-%H%M%S)"
if [ "$OFF" = true ]; then
  cp -p "$ENV_FILE" "$ENV_FILE.bak-notify-$TS"
  set_var "$ENV_FILE" BLOG_NOTIFY_TOKEN ""
  log "BLOG_NOTIFY_TOKEN 을 비웠다 = 푸시 알림 꺼짐(백업: $ENV_FILE.bak-notify-$TS)"
else
  NTOK="$(blog_token_in_notify)"
  [ -n "$NTOK" ] || die "$NOTIFY_ENV 의 NOTIFY_INTERNAL_TOKENS 에 'blog:' 항목이 없다(알림 서비스의 issue-caller-tokens.sh 를 먼저)"
  [ "${#NTOK}" -ge 32 ] || die "blog 호출자 토큰이 32자 미만이다"
  cp -p "$ENV_FILE" "$ENV_FILE.bak-notify-$TS"; log ".env 백업: $ENV_FILE.bak-notify-$TS"
  set_var "$ENV_FILE" BLOG_NOTIFY_TOKEN "$NTOK"
  unset NTOK
  log "블로그 .env 에 BLOG_NOTIFY_TOKEN(값 비출력)을 넣었다 = 푸시 알림 켜짐"
fi
if passes; then log "compose 가 이미 BLOG_NOTIFY_TOKEN 을 전달한다"
else
  # 서버의 compose 는 배포가 덮어쓰지 않는다. 있는 환경변수 줄 중 하나(우선순위 순) 바로 뒤에 한 줄을 넣는다.
  ANCHOR=""
  for key in BLOG_COOKIE_SECURE BLOG_WEB_BASE_PATH DORO_GUARD_SERVICE_TOKEN; do
    if grep -q "^[ ]\+$key:" "$COMPOSE"; then ANCHOR="$key"; break; fi
  done
  [ -n "$ANCHOR" ] || die "compose 에서 전달 줄을 넣을 기준 줄(BLOG_COOKIE_SECURE 등)을 찾지 못했다(손대지 않았다)"
  cp -p "$COMPOSE" "$COMPOSE.bak-notify-$TS"
  awk -v key="$ANCHOR" '
    $0 ~ "^[ ]+" key ":" && !done { print; match($0, /^[ ]+/); ind=substr($0, 1, RLENGTH);
      print ind "BLOG_NOTIFY_TOKEN: ${BLOG_NOTIFY_TOKEN:-}"; done=1; next }
    { print }' "$COMPOSE.bak-notify-$TS" > "$COMPOSE"
  if passes; then log "compose 에 전달 줄 하나를 추가했다(백업: $COMPOSE.bak-notify-$TS)"
  else cp -p "$COMPOSE.bak-notify-$TS" "$COMPOSE"; die "compose 에 전달 줄을 넣지 못했다(되돌렸다)"; fi
fi
if [ "$RESTART" = true ]; then
  log "블로그 백엔드 컨테이너를 다시 만든다(몇 초)"
  ( cd "$BLOG_DIR" && docker compose -f docker-compose.prod.yml up -d --no-build --no-deps --force-recreate "$BLOG_SERVICE" </dev/null ) >/dev/null 2>&1 || die "컨테이너를 다시 만들지 못했다"
  for _ in $(seq 1 40); do
    [ "$(docker inspect "$BLOG_CONTAINER" --format '{{.State.Health.Status}}' </dev/null 2>/dev/null)" = healthy ] && { log "$BLOG_CONTAINER 가 healthy 로 돌아왔다"; describe; exit 0; }
    sleep 3
  done
  die "$BLOG_CONTAINER 가 healthy 로 돌아오지 않았다(.env 백업: $ENV_FILE.bak-notify-$TS)"
fi
log "컨테이너는 그대로다. 새 값은 --restart 또는 다음 배포 때 반영된다."
log "참고: 게이트웨이는 컨테이너가 다시 만들어지면 IP 를 다시 해석해야 한다(--restart 후 502 가 나면 배포 스크립트의 게이트웨이 reload 절차를 따른다)."
describe
