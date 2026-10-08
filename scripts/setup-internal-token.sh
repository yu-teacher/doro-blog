#!/usr/bin/env bash
# 서버(mini)에서 실행한다: 블로그가 Doro IAM 내부 API(/internal/**)를 부를 때 쓰는 호출자 서비스 토큰을 안전하게 준비한다.
# 여러 번 실행해도 결과가 같다(멱등). 토큰 값은 화면에 출력하지 않는다. 기본은 계획만 보여 주는 dry-run 이다.
#
#   ssh mini 'bash -s --'                   < scripts/setup-internal-token.sh   # 계획만 출력(아무것도 바꾸지 않음)
#   ssh mini 'bash -s -- --apply'           < scripts/setup-internal-token.sh   # 토큰 생성·배치 (이미 있으면 그대로 둠)
#   ssh mini 'bash -s -- --apply --rotate'  < scripts/setup-internal-token.sh   # 토큰을 새로 만든다(IAM 과 블로그를 모두 다시 띄워야 반영)
#   ssh mini 'bash -s -- --apply --mode WARN' < scripts/setup-internal-token.sh # 도입 중 IAM 이 실패를 경고만 하게(확인 후 ENFORCE 로)
#
# 하는 일
#   1) ~/doro-blog/.env 에 DORO_IAM_INTERNAL_TOKEN(32바이트 난수 hex)을 둔다. 이미 있으면 유지한다(--rotate 면 새로 만든다).
#   2) ~/doro/.env 의 DORO_IAM_INTERNAL_TOKENS 에 'blog:<같은 토큰>' 항목을 둔다(다른 호출자 항목은 건드리지 않는다).
#   3) --mode 를 주면 ~/doro/.env 의 DORO_IAM_INTERNAL_AUTH_MODE 를 그 값으로 둔다(주지 않으면 기본 ENFORCE).
#   4) ~/doro-blog/docker-compose.prod.yml 의 blog-backend 환경변수에 DORO_IAM_INTERNAL_TOKEN 전달을 넣는다(서버 전용 파일이라 제자리 수정).
#   5) 바꾸는 파일은 먼저 백업하고(.bak-internal-<시각>), 고친 compose 를 검증한다.
#
# 반영 순서(실패해도 데이터는 안전하다: 동기화는 멱등이고 매시간 다시 시도한다)
#   a) 이 스크립트 --apply
#   b) Doro 푸시 -> CI 배포: IAM 이 새 토큰으로 /internal 을 지킨다(이 시점부터 토큰 없는 블로그 요청은 401)
#   c) 블로그 배포: 블로그가 토큰을 보낸다
#   d) 확인: ssh mini 'docker logs --since 10m doro-blog-backend 2>&1 | grep -i "deleted"'
set -Eeuo pipefail

BLOG_DIR="${BLOG_DIR:-$HOME/doro-blog}"
DORO_DIR="${DORO_DIR:-$HOME/doro}"
BLOG_ENV="$BLOG_DIR/.env"
DORO_ENV="$DORO_DIR/.env"
COMPOSE="$BLOG_DIR/docker-compose.prod.yml"
CALLER_NAME="${INTERNAL_CALLER_NAME:-blog}"
APPLY=false; ROTATE=false; MODE=""
while [ $# -gt 0 ]; do
  case "$1" in
    --apply) APPLY=true; shift ;;
    --rotate) ROTATE=true; shift ;;
    --mode) MODE="${2:?--mode 값이 필요하다(OFF|WARN|ENFORCE)}"; shift 2 ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 2 ;;
  esac
done
if [ -n "$MODE" ]; then
  MODE="$(printf '%s' "$MODE" | tr '[:lower:]' '[:upper:]')"
  case "$MODE" in OFF|WARN|ENFORCE) ;; *) echo "--mode 는 OFF, WARN, ENFORCE 중 하나다" >&2; exit 2 ;; esac
fi
TS="$(date +%Y%m%d-%H%M%S)"
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

[ -f "$BLOG_ENV" ] || die "$BLOG_ENV 가 없다"
[ -f "$DORO_ENV" ] || die "$DORO_ENV 가 없다"
[ -f "$COMPOSE" ] || die "$COMPOSE 가 없다"
command -v python3 >/dev/null || die "python3 가 필요하다"

env_get() { grep -E "^$2=" "$1" 2>/dev/null | head -1 | cut -d= -f2- || true; }

CURRENT="$(env_get "$BLOG_ENV" DORO_IAM_INTERNAL_TOKEN)"
IN_IAM="$(env_get "$DORO_ENV" DORO_IAM_INTERNAL_TOKENS)"
need_token=false; need_iam_entry=false; need_mode=false; need_compose=false
[ -n "$CURRENT" ] && [ "$ROTATE" = false ] || need_token=true
grep -q 'DORO_IAM_INTERNAL_TOKEN' "$COMPOSE" || need_compose=true
if [ -n "$MODE" ] && [ "$(env_get "$DORO_ENV" DORO_IAM_INTERNAL_AUTH_MODE)" != "$MODE" ]; then need_mode=true; fi
# IAM 쪽 항목은 블로그가 쓸 토큰과 같아야 한다. 새로 만들면 항상 다시 쓰고, 그대로 두면 지금 값과 같은지 확인한다.
if [ "$need_token" = true ]; then
  need_iam_entry=true
elif ! printf '%s' "$IN_IAM" | tr ',' '\n' | grep -qxF "$CALLER_NAME:$CURRENT"; then
  need_iam_entry=true
fi

log "계획: 블로그 토큰 새로 만듦=$need_token (rotate=$ROTATE), IAM 항목 쓰기=$need_iam_entry, IAM 모드 쓰기=$need_mode(${MODE:-기본 ENFORCE}), compose 환경변수 추가=$need_compose"
if [ "$APPLY" != true ]; then log "--dry-run: 여기서 종료 (--apply 로 반영)"; exit 0; fi
if [ "$need_token" = false ] && [ "$need_iam_entry" = false ] && [ "$need_mode" = false ] && [ "$need_compose" = false ]; then
  log "이미 모두 준비돼 있다. 변경 없음"; exit 0
fi

# ---------------------------------------------------------------- 백업
cp -p "$BLOG_ENV" "$BLOG_ENV.bak-internal-$TS"
cp -p "$DORO_ENV" "$DORO_ENV.bak-internal-$TS"
cp -p "$COMPOSE" "$COMPOSE.bak-internal-$TS"
log "백업: $BLOG_ENV, $DORO_ENV, $COMPOSE 를 *.bak-internal-$TS 로 복사"

# ---------------------------------------------------------------- 토큰과 .env
umask 077
if [ "$need_token" = true ]; then
  command -v openssl >/dev/null || die "openssl 이 필요하다"
  CURRENT="$(openssl rand -hex 32)"
fi

# KEY=VALUE 를 파일에 넣는다(있으면 그 줄만 바꾸고, 없으면 끝에 더한다). 값은 환경변수로만 넘겨 프로세스 목록에 남기지 않는다.
set_env() {  # $1=파일 $2=키 ; 값은 NEW_VALUE 환경변수
  NEW_VALUE="$3" python3 - "$1" "$2" <<'PY'
import os, sys
path, key = sys.argv[1], sys.argv[2]
value = os.environ["NEW_VALUE"]
lines = open(path, encoding="utf-8").read().split("\n")
out, done = [], False
for line in lines:
    if line.startswith(key + "="):
        if not done:
            out.append(f"{key}={value}")
            done = True
        continue
    out.append(line)
if not done:
    while out and out[-1] == "":
        out.pop()
    out.append(f"{key}={value}")
    out.append("")
open(path, "w", encoding="utf-8").write("\n".join(out))
PY
}

if [ "$need_token" = true ]; then
  set_env "$BLOG_ENV" DORO_IAM_INTERNAL_TOKEN "$CURRENT"
  log "$BLOG_ENV 에 DORO_IAM_INTERNAL_TOKEN 을 썼다(값은 출력하지 않는다)"
fi

if [ "$need_iam_entry" = true ]; then
  # 다른 호출자 항목은 그대로 두고 블로그 항목만 바꾼다
  NEW_LIST="$(CALLER="$CALLER_NAME" TOKEN="$CURRENT" EXISTING="$IN_IAM" python3 - <<'PY'
import os
caller, token, existing = os.environ["CALLER"], os.environ["TOKEN"], os.environ["EXISTING"]
items = [i.strip() for i in existing.split(",") if i.strip() and not i.strip().startswith(caller + ":")]
items.append(f"{caller}:{token}")
print(",".join(items))
PY
)"
  set_env "$DORO_ENV" DORO_IAM_INTERNAL_TOKENS "$NEW_LIST"
  log "$DORO_ENV 의 DORO_IAM_INTERNAL_TOKENS 에 '$CALLER_NAME' 항목을 썼다(다른 호출자 항목은 유지, 값은 출력하지 않는다)"
fi

if [ "$need_mode" = true ]; then
  set_env "$DORO_ENV" DORO_IAM_INTERNAL_AUTH_MODE "$MODE"
  log "$DORO_ENV 에 DORO_IAM_INTERNAL_AUTH_MODE=$MODE 를 썼다"
fi

# ---------------------------------------------------------------- compose (서버 전용 파일이라 제자리 수정)
if [ "$need_compose" = true ]; then
  python3 - "$COMPOSE" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding="utf-8").read()
anchor = "      IAM_PORT: 8080\n"
if text.count(anchor) != 1:
    sys.exit("compose 에서 삽입 위치(IAM_PORT: 8080)를 정확히 하나 찾지 못했다. 수동으로 확인해야 한다.")
block = anchor + (
    "      # Doro IAM 내부 API 호출자 서비스 토큰(값은 .env 에만 둔다)\n"
    "      DORO_IAM_INTERNAL_TOKEN: ${DORO_IAM_INTERNAL_TOKEN:-}\n"
)
open(path, "w", encoding="utf-8").write(text.replace(anchor, block, 1))
PY
  log "compose 의 blog-backend 환경변수에 DORO_IAM_INTERNAL_TOKEN 전달을 추가했다"
fi

# ---------------------------------------------------------------- 검증
if command -v docker >/dev/null 2>&1; then
  if (cd "$BLOG_DIR" && docker compose -f "$COMPOSE" config -q 2>/tmp/internal-token-compose.err); then
    log "compose 검증 통과"
  else
    cat /tmp/internal-token-compose.err >&2
    die "compose 검증 실패. 복구: cp $COMPOSE.bak-internal-$TS $COMPOSE"
  fi
fi
for f in "$BLOG_ENV" "$DORO_ENV"; do
  [ -n "$(env_get "$f" "$( [ "$f" = "$BLOG_ENV" ] && echo DORO_IAM_INTERNAL_TOKEN || echo DORO_IAM_INTERNAL_TOKENS)")" ] || die "$f 에 값이 비어 있다. 복구: 백업(*.bak-internal-$TS)을 되돌린다"
done
log "완료. 다음: (1) Doro 푸시로 IAM 배포 (2) 블로그 배포 (3) 로그 확인. 토큰을 잃으면 --rotate 로 다시 만든다."
