#!/usr/bin/env bash
# 로컬 미리보기: src/ 를 그대로 서빙한다.
#
#   ./scripts/dev.sh                → http://127.0.0.1:8080
#   PORT=9000 ./scripts/dev.sh      → 포트 바꾸기
#   HOST=0.0.0.0 ./scripts/dev.sh   → 같은 네트워크의 다른 PC 에서 http://192.168.0.206:8080 으로 접속
#                                     (방화벽이 막고 있으면 포트를 열어야 한다 [확인 필요])
#
# 운영 nginx 와 다른 점: 보안 헤더(CSP)·캐시 설정이 없다. 없는 주소에는 404.html 대신 기본 오류 페이지가 나온다.
# CSP 위반은 ./scripts/check.sh 가 잡는다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-8080}"
HOST="${HOST:-127.0.0.1}"

echo "▶ http://$HOST:$PORT  (종료: Ctrl+C)"
exec python3 -m http.server "$PORT" --bind "$HOST" --directory "$ROOT/src"
