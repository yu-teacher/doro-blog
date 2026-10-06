#!/usr/bin/env bash
# 서버(mini)에서 한 번 실행한다: 블로그 BFF 로그인에 필요한 서버 설정을 안전하게 준비한다. 여러 번 실행해도 결과가 같다(멱등).
#
#   scripts/setup-bff-server.sh --origin https://example.com            # 설정 + 검증 (OAuth 클라이언트 등록은 안내만)
#   scripts/setup-bff-server.sh --origin https://example.com --register # 위 + OAuth 클라이언트(doro-blog) 등록
#   scripts/setup-bff-server.sh --origin https://example.com --dry-run   # 무엇을 바꿀지 출력만
#
# 하는 일
#   1) ~/doro-blog/.env 에 BLOG_SESSION_KEY(세션 토큰 암호화 키, 32바이트 난수)와 BLOG_PUBLIC_ORIGIN 을 추가한다. 이미 있으면 건드리지 않는다.
#   2) ~/doro-blog/docker-compose.prod.yml 의 blog-backend 환경변수에 BFF 설정을 넣는다 (compose 파일은 서버 전용이라 제자리에서 고친다).
#   3) 두 파일을 먼저 백업하고(.bak-bff-<시각>), 고친 compose 를 검증한다. 비밀 값은 화면에 출력하지 않는다.
#   4) --register 이면 Doro IAM 에 블로그 클라이언트를 등록한다(자사 앱 표시, redirect_uri 정확히 하나).
set -Eeuo pipefail

BLOG_DIR="${BLOG_DIR:-$HOME/doro-blog}"
COMPOSE="$BLOG_DIR/docker-compose.prod.yml"
ENV_FILE="$BLOG_DIR/.env"
CLIENT_ID="${BLOG_OAUTH_CLIENT_ID:-doro-blog}"
POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-doro-postgres}"
AUTH_DB="${AUTH_DB:-doro_auth}"
ORIGIN=""; REGISTER=false; DRY_RUN=false
while [ $# -gt 0 ]; do
  case "$1" in
    --origin) ORIGIN="${2:?--origin 값이 필요하다}"; shift 2 ;;
    --register) REGISTER=true; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    *) echo "알 수 없는 옵션: $1" >&2; exit 2 ;;
  esac
done
[ -n "$ORIGIN" ] || { echo "--origin https://<공개 도메인> 이 필요하다 (끝에 / 없이)" >&2; exit 2; }
case "$ORIGIN" in https://*) ;; *) echo "origin 은 https:// 로 시작해야 한다 (로그인 쿠키가 Secure 이다)" >&2; exit 2 ;; esac
ORIGIN="${ORIGIN%/}"
TS="$(date +%Y%m%d-%H%M%S)"
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }

[ -f "$COMPOSE" ] && [ -f "$ENV_FILE" ] || { echo "$COMPOSE 또는 $ENV_FILE 이 없다" >&2; exit 1; }

# ---------------------------------------------------------------- 계획
need_key=false; need_origin=false; need_compose=false
grep -q '^BLOG_SESSION_KEY=.\+' "$ENV_FILE" || need_key=true
grep -q '^BLOG_PUBLIC_ORIGIN=.\+' "$ENV_FILE" || need_origin=true
grep -q 'BLOG_SESSION_KEY' "$COMPOSE" || need_compose=true
log "계획: .env 에 세션 키 추가=$need_key, 공개 주소 추가=$need_origin, compose 에 BFF 환경변수 추가=$need_compose, 클라이언트 등록=$REGISTER"
if [ "$DRY_RUN" = true ]; then log "--dry-run: 여기서 종료"; exit 0; fi

# ---------------------------------------------------------------- 백업
if [ "$need_key" = true ] || [ "$need_origin" = true ] || [ "$need_compose" = true ]; then
  cp -p "$ENV_FILE" "$ENV_FILE.bak-bff-$TS"
  cp -p "$COMPOSE" "$COMPOSE.bak-bff-$TS"
  log "백업: $ENV_FILE.bak-bff-$TS, $COMPOSE.bak-bff-$TS"
fi

# ---------------------------------------------------------------- .env
if [ "$need_key" = true ]; then
  umask 077
  printf '\nBLOG_SESSION_KEY=%s\n' "$(openssl rand -base64 32)" >> "$ENV_FILE"
  log ".env 에 BLOG_SESSION_KEY 추가 (값은 출력하지 않는다. 분실하면 모든 로그인 세션이 무효가 된다 — 비밀번호 관리자에 보관)"
fi
if [ "$need_origin" = true ]; then
  printf 'BLOG_PUBLIC_ORIGIN=%s\n' "$ORIGIN" >> "$ENV_FILE"
  log ".env 에 BLOG_PUBLIC_ORIGIN=$ORIGIN 추가"
fi

# ---------------------------------------------------------------- compose
if [ "$need_compose" = true ]; then
  python3 - "$COMPOSE" <<'PY'
import sys
path = sys.argv[1]
text = open(path, encoding='utf-8').read()
anchor = "      MINIO_PUBLIC_URL: /media\n"
if anchor not in text:
    sys.exit("compose 에서 삽입 위치(MINIO_PUBLIC_URL: /media)를 찾지 못했다. 수동으로 확인해야 한다.")
block = anchor + (
    "      # 블로그 BFF 로그인(Doro OAuth). 세션 키는 .env 에만 둔다.\n"
    "      BLOG_SESSION_KEY: ${BLOG_SESSION_KEY:?BLOG_SESSION_KEY must be set in .env}\n"
    "      BLOG_OAUTH_CLIENT_ID: doro-blog\n"
    "      BLOG_OAUTH_AUTHORIZE_URL: ${BLOG_PUBLIC_ORIGIN:?BLOG_PUBLIC_ORIGIN must be set in .env}/oauth2/authorize\n"
    "      BLOG_OAUTH_TOKEN_URL: http://auth-api:8080/oauth2/token\n"
    "      BLOG_OAUTH_REVOKE_URL: http://auth-api:8080/oauth2/revoke\n"
    "      BLOG_OAUTH_REDIRECT_URI: ${BLOG_PUBLIC_ORIGIN}/api/v1/bff/callback\n"
    "      BLOG_COOKIE_SECURE: \"true\"\n"
)
open(path, 'w', encoding='utf-8').write(text.replace(anchor, block, 1))
PY
  log "compose 에 BFF 환경변수 추가"
fi

# ---------------------------------------------------------------- 검증
if command -v docker >/dev/null 2>&1; then
  if (cd "$BLOG_DIR" && docker compose -f "$COMPOSE" config -q 2>/tmp/bff-compose-check.err); then
    log "compose 검증 통과"
    (cd "$BLOG_DIR" && docker compose -f "$COMPOSE" config 2>/dev/null) | grep -E "BLOG_OAUTH_|BLOG_COOKIE" | sed 's/^ *//' | sed 's/^/    /'
  else
    echo "compose 검증 실패:" >&2; cat /tmp/bff-compose-check.err >&2
    echo "복구: cp $COMPOSE.bak-bff-$TS $COMPOSE" >&2
    exit 1
  fi
fi

# ---------------------------------------------------------------- OAuth 클라이언트
REG_SQL="INSERT INTO oauth_clients (id, client_id, name, redirect_uris, allowed_scopes, is_active, first_party, created_at)
VALUES (gen_random_uuid(), '$CLIENT_ID', 'Doro Blog', '$ORIGIN/api/v1/bff/callback', 'openid profile email', TRUE, TRUE, now())
ON CONFLICT (client_id) DO UPDATE SET redirect_uris = EXCLUDED.redirect_uris, is_active = TRUE, first_party = TRUE;"
if [ "$REGISTER" = true ]; then
  printf '%s\n' "$REG_SQL" | docker exec -i "$POSTGRES_CONTAINER" sh -c "psql -U \"\$POSTGRES_USER\" -d $AUTH_DB -v ON_ERROR_STOP=1" >/dev/null
  log "OAuth 클라이언트 등록 완료: client_id=$CLIENT_ID, redirect_uri=$ORIGIN/api/v1/bff/callback, firstParty=true"
else
  log "OAuth 클라이언트는 아직 등록하지 않았다. 등록하려면 --register 를 붙여 다시 실행한다."
fi
log "완료. 다음: 블로그를 배포한다(푸시 → CI → 자동 배포)."
