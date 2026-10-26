#!/usr/bin/env bash
# 게이트웨이 경유 점검 주소 계산(deploy-on-server.sh 가 source 한다). 시험: scripts/test-gateway-url.sh
# 공개 하위 경로(BLOG_WEB_BASE_PATH: '', '/blog', '/dev/blog/' 등)를 '' 또는 '/dev/blog' 꼴로 맞춰 API 주소에 붙인다.

normalize_base_path() {  # <raw> -> '' 또는 '/a/b' (앞 슬래시 하나, 뒤 슬래시 없음)
  local trimmed="${1:-}"
  trimmed="${trimmed#"${trimmed%%[![:space:]/]*}"}"   # 앞쪽 공백·슬래시 제거
  trimmed="${trimmed%"${trimmed##*[![:space:]/]}"}"   # 뒤쪽 공백·슬래시 제거
  if [ -z "$trimmed" ]; then printf ''; else printf '/%s' "$trimmed"; fi
}

gateway_check_url() {  # <raw base path> -> 점검 URL (GATEWAY_CHECK_URL 이 있으면 그것을 쓴다)
  if [ -n "${GATEWAY_CHECK_URL:-}" ]; then printf '%s' "$GATEWAY_CHECK_URL"; return 0; fi
  printf 'https://127.0.0.1%s/api/v1/posts?page=0&size=1' "$(normalize_base_path "${1:-}")"
}
