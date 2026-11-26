#!/usr/bin/env bash
# 공식 앱·서비스(운영자 작품)를 Store·Showroom DB 로 옮긴다 (ADR-0014). 여러 번 돌려도 된다 (이미 옮긴 것은 건너뛴다).
#
#   ./scripts/import-official.sh --dry-run         무엇을 옮길지만 본다 (DB·작품 파일을 바꾸지 않는다)
#   ./scripts/import-official.sh                   옮기고, 작품 파일에 storeApp·showroomService 코드를 적는다
#   ./scripts/import-official.sh --owner <이메일>   운영자가 여럿일 때 주인을 정한다 (하나면 생략)
#
# 차례: 1) web 작품 관리 CLI 가 content/ 를 검사해 JSON 으로 내보낸다 → 2) api/app/import_official.py 가 DB 를 채운다
#       → 3) CLI 가 옮긴 코드를 작품 파일에 적는다 (머리말의 다른 줄은 그대로)
# 개발: api/.env.local 의 설정(운영자 이메일)을 쓰고, DB 는 api/data/dev.sqlite3, 설치 파일은 .local/files 에서 읽는다.
#       개발 DB 는 스키마가 바뀌면 다시 만들어진다. 그때는 이 스크립트를 다시 돌리면 같은 코드로 되살아난다.
# 운영 (서버 설치 뒤, deploy/README.md §3-8 참고):
#   JOHNNYSTUDIO_ENV_FILE=/opt/johnnystudio/api.env JOHNNYSTUDIO_FILES_DIR=/opt/johnnystudio/files ./scripts/import-official.sh
# 작품 파일이 바뀌므로 끝나면 git diff content/ 로 확인하고 커밋한다.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
dry=0
for a in "$@"; do
  [[ "$a" == "--dry-run" ]] && dry=1
done

command -v uv >/dev/null || { echo "✗ uv 가 없습니다 (https://docs.astral.sh/uv/)"; exit 1; }
[[ -d "$ROOT/web/node_modules" ]] || npm --prefix "$ROOT/web" ci --no-fund --no-audit

tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

echo "▶ 1/3 작품 파일에서 공식 앱·서비스를 읽습니다 (content/assets)"
npm --prefix "$ROOT/web" run --silent admin -- official-export > "$tmp/official.json"

echo "▶ 2/3 DB 로 옮깁니다"
env_file="${JOHNNYSTUDIO_ENV_FILE:-}"
if [[ -z "$env_file" && -f "$ROOT/api/.env.local" ]]; then
  env_file="$ROOT/api/.env.local"
fi
status=0
(
  cd "$ROOT/api"
  JOHNNYSTUDIO_ENV_FILE="$env_file" uv run --frozen --quiet python -m app.import_official \
    --input "$tmp/official.json" --output "$tmp/links.json" "$@"
) || status=$?

if (( dry )); then
  exit "$status"
fi
if [[ -f "$tmp/links.json" ]]; then
  echo "▶ 3/3 작품 파일에 코드를 적습니다"
  npm --prefix "$ROOT/web" run --silent admin -- official-link "$tmp/links.json"
  echo "  확인: git diff content/assets"
fi
exit "$status"
