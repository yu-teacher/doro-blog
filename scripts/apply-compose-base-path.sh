#!/usr/bin/env bash
# 서버(mini)에서 실행한다: 서버의 docker-compose.prod.yml(배포가 덮어쓰지 않는 파일)에서 블로그 백엔드가 공개 하위 경로를 따르게 한다.
#   1) 환경변수 BLOG_WEB_BASE_PATH 를 컨테이너로 전달한다(서버 .env 의 값, 없으면 빈 문자열).
#   2) BLOG_OAUTH_REDIRECT_URI 를 ${BLOG_PUBLIC_ORIGIN}${BLOG_WEB_BASE_PATH:-}/api/v1/bff/callback 로 만든다.
# 이렇게 하면 서버 .env 에 BLOG_WEB_BASE_PATH=/blog 한 줄만 넣을 때 웹 빌드 기준 경로, 백엔드 쿠키 Path/복귀 위치, OAuth 복귀 주소가 같은 값으로 함께 바뀐다.
# BLOG_WEB_BASE_PATH 가 비어 있는 동안에는 지금과 똑같은 값이 만들어진다(이 스크립트를 적용해도 운영 동작은 그대로다).
#
# 안전장치: 적용 전후의 "해석된 블로그 백엔드 환경변수"를 docker compose config 로 비교해, 바뀌는 키가 이 두 개뿐이고 기준 경로가 비어 있을 때는
# 값이 하나도 달라지지 않음을 확인한다(비밀 값은 화면에 출력하지 않는다). 백업을 만들고, 검증에 실패하면 아무것도 바꾸지 않거나 복구한다.
# 컨테이너는 재시작하지 않는다. 변경은 다음 블로그 배포(docker compose up) 때 반영된다.
#
#   ssh mini 'bash -s -- --dry-run' < scripts/apply-compose-base-path.sh   # 바뀔 내용과 검증만
#   ssh mini 'bash -s -- --apply'   < scripts/apply-compose-base-path.sh   # 반영
set -Eeuo pipefail

DIR="${BLOG_DIR:-$HOME/doro-blog}"
COMPOSE="$DIR/docker-compose.prod.yml"
ENVFILE="$DIR/.env"
APPLY=false
for a in "$@"; do
  case "$a" in
    --apply) APPLY=true ;;
    --dry-run) APPLY=false ;;
    *) echo "알 수 없는 옵션: $a" >&2; exit 2 ;;
  esac
done
log() { printf '[%s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { log "ERROR: $*"; exit 1; }
[ -f "$COMPOSE" ] && [ -f "$ENVFILE" ] || die "$COMPOSE 또는 $ENVFILE 가 없다"
command -v python3 >/dev/null || die "python3 가 필요하다"

TS="$(date +%Y%m%d-%H%M%S)"
NEW="$(mktemp)"; trap 'rm -f "$NEW"' EXIT

# 1) 새 compose 만들기 (이미 적용돼 있으면 SAME)
STATE="$(python3 - "$COMPOSE" "$NEW" <<'PY'
import re, sys
src, out = sys.argv[1], sys.argv[2]
text = open(src, encoding="utf-8").read()
old_uri = "      BLOG_OAUTH_REDIRECT_URI: ${BLOG_PUBLIC_ORIGIN}/api/v1/bff/callback\n"
new_uri = "      BLOG_OAUTH_REDIRECT_URI: ${BLOG_PUBLIC_ORIGIN}${BLOG_WEB_BASE_PATH:-}/api/v1/bff/callback\n"
new_env = ("      # 웹이 마운트된 공개 하위 경로(예: /blog). 서버 .env 의 BLOG_WEB_BASE_PATH 와 같은 값이다. 비어 있으면 루트.\n"
           "      BLOG_WEB_BASE_PATH: ${BLOG_WEB_BASE_PATH:-}\n")
if "BLOG_WEB_BASE_PATH" in text and new_uri in text:
    open(out, "w", encoding="utf-8").write(text); print("SAME"); sys.exit(0)
if text.count(old_uri) != 1:
    sys.exit(f"BLOG_OAUTH_REDIRECT_URI 줄을 정확히 1개 찾지 못했다(찾은 수: {text.count(old_uri)})")
text = text.replace(old_uri, new_uri + new_env, 1)
open(out, "w", encoding="utf-8").write(text); print("CHANGE")
PY
)" || die "새 compose 를 만들지 못했다: $STATE"
[ "$STATE" = "SAME" ] && { log "이미 적용돼 있다. 변경하지 않는다."; exit 0; }

log "바뀔 내용:"; diff "$COMPOSE" "$NEW" | sed 's/^/    /' || true

# 2) 문법 + 해석된 환경변수 비교. 비밀 값은 출력하지 않고, 바뀌는 두 키만 값을 보여준다.
resolved() { # <compose 파일> <BLOG_WEB_BASE_PATH 값(없으면 설정 안 함)>
  local file="$1"; shift
  ( cd "$DIR" && env -u BLOG_WEB_BASE_PATH "$@" docker compose -f "$file" --env-file "$ENVFILE" config --format json ) \
    | python3 -c '
import json, sys
cfg = json.load(sys.stdin)
env = cfg["services"]["blog-backend"].get("environment", {})
print(json.dumps(env, sort_keys=True))'
}
BEFORE="$(resolved "$COMPOSE")" || die "현재 compose 를 해석하지 못했다"
AFTER_EMPTY="$(resolved "$NEW")" || die "새 compose 의 문법/해석 검증 실패(아무것도 바꾸지 않았다)"
AFTER_BLOG="$(resolved "$NEW" BLOG_WEB_BASE_PATH=/blog)" || die "새 compose(기준 경로 /blog) 해석 실패"

python3 - "$BEFORE" "$AFTER_EMPTY" "$AFTER_BLOG" <<'PY' || die "검증 실패: 기준 경로가 비어 있을 때 운영 값이 달라진다(아무것도 바꾸지 않았다)"
import json, sys
before, empty, blog = (json.loads(a) for a in sys.argv[1:4])
# (a) 기준 경로가 비어 있으면, 새로 생기는 BLOG_WEB_BASE_PATH(빈 문자열)를 빼고 모든 값이 똑같아야 한다.
added = set(empty) - set(before)
removed = set(before) - set(empty)
changed = [k for k in before if k in empty and before[k] != empty[k]]
assert added == {"BLOG_WEB_BASE_PATH"}, f"예상 밖으로 늘어난 키: {added}"
assert not removed, f"사라진 키: {removed}"
assert not changed, f"값이 달라진 키: {changed}"
assert empty["BLOG_WEB_BASE_PATH"] == "", "기준 경로가 비어 있을 때 빈 문자열이어야 한다"
print("    [검증 통과] 기준 경로가 비어 있으면: 새 키 BLOG_WEB_BASE_PATH(빈 값)만 늘고, 기존 환경변수 %d개는 모두 같은 값이다" % len(before))
# (b) 기준 경로를 /blog 로 두면 바뀌는 키는 정확히 둘이어야 한다.
diff = sorted(k for k in set(blog) | set(empty) if blog.get(k) != empty.get(k))
assert diff == ["BLOG_OAUTH_REDIRECT_URI", "BLOG_WEB_BASE_PATH"], f"바뀌는 키가 예상과 다르다: {diff}"
print("    [검증 통과] 기준 경로를 /blog 로 두면 바뀌는 키: " + ", ".join(diff))
print("        BLOG_WEB_BASE_PATH       = %r" % blog["BLOG_WEB_BASE_PATH"])
uri_empty, uri_blog = empty["BLOG_OAUTH_REDIRECT_URI"], blog["BLOG_OAUTH_REDIRECT_URI"]
print("        BLOG_OAUTH_REDIRECT_URI  = ...%s  ->  ...%s" % (uri_empty[uri_empty.index("/api/"):], uri_blog[uri_blog.index("/blog/"):]))
PY

if [ "$APPLY" != true ]; then log "--dry-run 이므로 여기서 종료한다(아무것도 바꾸지 않았다). 반영하려면 --apply"; exit 0; fi

BACKUP="$COMPOSE.bak-basepath-$TS"
cp -p "$COMPOSE" "$BACKUP"; log "백업: $BACKUP"
cat "$NEW" > "$COMPOSE"
if ! ( cd "$DIR" && docker compose -f "$COMPOSE" --env-file "$ENVFILE" config -q ); then
  cat "$BACKUP" > "$COMPOSE"; die "적용 후 검증 실패. 백업으로 되돌렸다"
fi
log "적용 완료. 컨테이너는 재시작하지 않았다(다음 블로그 배포 때 반영). 되돌리려면: cat $BACKUP > $COMPOSE"
