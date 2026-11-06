#!/usr/bin/env bash
# 출시 빌드 미리보기: 초안이 빠진, 실제로 배포될 결과(web/out)를 그대로 본다. 회원 API 도 함께 뜬다.
#
#   ./scripts/preview.sh             빌드한 뒤 → http://127.0.0.1:8080
#   ./scripts/preview.sh --no-build  이미 있는 web/out 을 그대로
#   NO_API=1 ./scripts/preview.sh    회원 API 없이 (로그인 화면은 '연결할 수 없음'으로 보인다)
#
# 운영 nginx 처럼 보안 헤더(CSP 포함)를 붙이고 /api/ 를 API 로 넘긴다 (scripts/preview_server.py).
# 운영과 다른 점: HTTPS·캐시 헤더·요청 제한이 없고, 메일은 보내지 않고 이 터미널에 찍힌다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"
HOST="${HOST:-127.0.0.1}"
API_PORT="${API_PORT:-8090}"
export NEXT_TELEMETRY_DISABLED=1

if [[ "${1:-}" != "--no-build" ]]; then
  [[ -d "$ROOT/web/node_modules" ]] || npm --prefix "$ROOT/web" ci --no-fund --no-audit
  npm --prefix "$ROOT/web" run --silent build
fi

if [[ "${NO_API:-}" != "1" ]]; then
  # shellcheck source=scripts/_api.sh
  source "$ROOT/scripts/_api.sh"
  start_api "$API_PORT" "http://$HOST:$PORT"
fi

echo "▶ http://$HOST:$PORT  (종료: Ctrl+C)"
python3 "$ROOT/scripts/preview_server.py" --root "$ROOT/web/out" --host "$HOST" --port "$PORT" \
  --api "http://127.0.0.1:$API_PORT" --nginx-conf "$ROOT/deploy/nginx/johnnystudio.conf"
