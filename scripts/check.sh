#!/usr/bin/env bash
# 커밋·배포 전 검사. 문제가 있으면 0 이 아닌 값으로 끝난다.
# 검사 항목: docs/04_architecture/ARCHITECTURE.md §4
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
fail=0

echo "▶ 사이트 (src/)"
python3 scripts/check_site.py src || fail=1

echo "▶ 셸 스크립트 문법"
while IFS= read -r -d '' f; do
  if ! bash -n "$f"; then
    echo "  ✗ $f"
    fail=1
  fi
done < <(find . -path ./.git -prune -o -name '*.sh' -print0)

echo "▶ 줄바꿈 (CRLF 금지)"
while IFS= read -r f; do
  echo "  ✗ CRLF: $f"
  fail=1
done < <(grep -rIl --exclude-dir=.git $'\r' . || true)

if (( fail )); then
  echo "✗ 검사 실패"
  exit 1
fi
echo "✓ 모든 검사 통과"
