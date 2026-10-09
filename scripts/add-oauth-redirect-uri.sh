#!/usr/bin/env bash
# 서버(mini)에서 실행한다: Doro IAM 에 등록된 OAuth 클라이언트의 redirect_uris 에 주소 하나를 "추가"하거나 "제거"한다.
# 블로그를 /blog/ 아래로 옮길 때, 전환 전에 새 복귀 주소(.../blog/api/v1/bff/callback)를 먼저 추가해 두면 옛 주소와 새 주소가 둘 다 동작해
# 전환 중에도 로그인이 끊기지 않는다. 전환이 끝나고 안정되면 옛 주소를 --remove 로 지운다.
#
# redirect_uris 는 TEXT 컬럼이고 줄바꿈으로 구분한다(Doro auth V6). IAM 은 인가 요청의 redirect_uri 가 이 목록의 한 줄과 정확히 같아야 허용한다.
# 이미 있으면 아무것도 바꾸지 않는다(멱등). 바꾸기 전 값은 화면에 남기고, 한 트랜잭션에서 한 행만 수정한다(행 수가 1 이 아니면 되돌린다).
#
#   ssh mini 'CLIENT_ID=doro-blog bash -s -- --dry-run https://도메인/blog/api/v1/bff/callback' < scripts/add-oauth-redirect-uri.sh
#   ssh mini 'CLIENT_ID=doro-blog bash -s -- --add     https://도메인/blog/api/v1/bff/callback' < scripts/add-oauth-redirect-uri.sh
#   ssh mini 'CLIENT_ID=doro-blog bash -s -- --remove  https://도메인/api/v1/bff/callback'      < scripts/add-oauth-redirect-uri.sh
set -Eeuo pipefail

POSTGRES_CONTAINER="${POSTGRES_CONTAINER:-doro-postgres}"
AUTH_DB="${AUTH_DB:-doro_auth}"
CLIENT_ID="${CLIENT_ID:?CLIENT_ID 가 필요하다 (예: doro-blog)}"

MODE="${1:---dry-run}"; URI="${2:-}"
case "$MODE" in --dry-run|--add|--remove) ;; *) echo "사용법: $0 --dry-run|--add|--remove <redirect_uri>" >&2; exit 2 ;; esac
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }

# 검증: https 절대 주소만 허용한다. 공백·따옴표·세미콜론·역슬래시·개행이 섞이면 SQL/목록을 깨뜨릴 수 있어 거부한다(SQL 에 직접 넣기 때문).
[[ "$URI" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]+)?(/[A-Za-z0-9._~/-]*)?$ ]] || die "redirect_uri 형식이 이상하다: $URI"
[[ "$CLIENT_ID" =~ ^[A-Za-z0-9_-]+$ ]] || die "CLIENT_ID 형식이 이상하다"
docker inspect "$POSTGRES_CONTAINER" >/dev/null 2>&1 || die "$POSTGRES_CONTAINER 컨테이너가 없다"

psql_run() { docker exec -i "$POSTGRES_CONTAINER" sh -c "psql -U \"\$POSTGRES_USER\" -d $AUTH_DB -v ON_ERROR_STOP=1 -At $*"; }

CURRENT="$(printf "SELECT redirect_uris FROM oauth_clients WHERE client_id = '%s';\n" "$CLIENT_ID" | psql_run)"
[ -n "$CURRENT" ] || die "클라이언트 $CLIENT_ID 를 찾지 못했다(oauth_clients)"
log "현재 $CLIENT_ID 의 redirect_uris:"; printf '%s\n' "$CURRENT" | sed 's/^/    /'

# 목록에 이미 있는지(줄 단위로 정확히 일치)
if printf '%s\n' "$CURRENT" | grep -Fxq -- "$URI"; then PRESENT=true; else PRESENT=false; fi

case "$MODE" in
  --dry-run) log "--dry-run: 아무것도 바꾸지 않았다. 이 주소는 현재 목록에 $([ "$PRESENT" = true ] && echo '있다' || echo '없다')." ; exit 0 ;;
  --add)
    [ "$PRESENT" = false ] || { log "이미 목록에 있다. 변경하지 않는다."; exit 0; }
    SQL="UPDATE oauth_clients SET redirect_uris = redirect_uris || E'\n' || '$URI' WHERE client_id = '$CLIENT_ID';" ;;
  --remove)
    [ "$PRESENT" = true ] || { log "목록에 없다. 변경하지 않는다."; exit 0; }
    [ "$(printf '%s\n' "$CURRENT" | grep -c .)" -gt 1 ] || die "마지막 하나 남은 복귀 주소는 지우지 않는다(로그인이 전부 막힌다)"
    SQL="UPDATE oauth_clients SET redirect_uris = array_to_string(array_remove(string_to_array(redirect_uris, E'\n'), '$URI'), E'\n') WHERE client_id = '$CLIENT_ID';" ;;
esac

# 한 행만 바뀌었는지 확인하고, 아니면 되돌린다. UPDATE 의 영향 행 수를 GET DIAGNOSTICS 로 읽어 1 이 아니면 예외를 내서 트랜잭션 전체가 롤백된다.
RESULT="$(cat <<SQLEOF | psql_run 2>&1
DO \$\$
DECLARE n integer;
BEGIN
  $SQL
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN
    RAISE EXCEPTION '영향받은 행이 1개가 아니다(%): 되돌린다', n;
  END IF;
END
\$\$;
SQLEOF
)" || die "SQL 실행 실패(변경은 롤백됐다): $RESULT"
log "적용 후 $CLIENT_ID 의 redirect_uris:"
printf "SELECT redirect_uris FROM oauth_clients WHERE client_id = '%s';\n" "$CLIENT_ID" | psql_run | sed 's/^/    /'
log "완료. 되돌리려면 같은 스크립트를 반대 옵션(--add 였으면 --remove)으로 실행한다."
