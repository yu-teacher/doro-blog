#!/usr/bin/env bash
# scripts/gateway-url.sh 의 시험. 서버·Docker 없이 로컬에서 돈다.
set -Eeuo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
# shellcheck source=gateway-url.sh
source ./gateway-url.sh
unset GATEWAY_CHECK_URL

fail=0
expect() {  # <설명> <기대> <실제>
  if [ "$2" = "$3" ]; then echo "ok   $1"; else echo "FAIL $1: 기대 '$2' 실제 '$3'"; fail=1; fi
}

expect "빈 값은 루트 경로(기존과 같다)" "https://127.0.0.1/api/v1/posts?page=0&size=1" "$(gateway_check_url '')"
expect "인자 없음도 루트 경로" "https://127.0.0.1/api/v1/posts?page=0&size=1" "$(gateway_check_url)"
expect "/ 만 있으면 루트 경로" "https://127.0.0.1/api/v1/posts?page=0&size=1" "$(gateway_check_url '/')"
expect "/blog" "https://127.0.0.1/blog/api/v1/posts?page=0&size=1" "$(gateway_check_url '/blog')"
expect "/blog/ (뒤 슬래시)" "https://127.0.0.1/blog/api/v1/posts?page=0&size=1" "$(gateway_check_url '/blog/')"
expect "blog (앞 슬래시 없음)" "https://127.0.0.1/blog/api/v1/posts?page=0&size=1" "$(gateway_check_url 'blog')"
expect "/dev/blog" "https://127.0.0.1/dev/blog/api/v1/posts?page=0&size=1" "$(gateway_check_url '/dev/blog')"
expect "/dev/blog/ (뒤 슬래시)" "https://127.0.0.1/dev/blog/api/v1/posts?page=0&size=1" "$(gateway_check_url '/dev/blog/')"
expect "GATEWAY_CHECK_URL 이 우선한다" "https://example.test/x" "$(GATEWAY_CHECK_URL=https://example.test/x gateway_check_url '/dev/blog')"

[ "$fail" -eq 0 ] && echo "모두 통과" || { echo "실패가 있다"; exit 1; }
