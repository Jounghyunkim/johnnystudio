#!/usr/bin/env bash
# 커밋·배포 전 검사. 문제가 있으면 0 이 아닌 값으로 끝난다.
# 검사 항목: docs/04_architecture/ARCHITECTURE.md §8
#
#   ./scripts/check.sh               전체 (타입 → 린트 → 테스트 → API 테스트 → 출시 빌드 → 빌드 결과 → 셸 → 줄바꿈)
#   ./scripts/check.sh --skip-build  빌드를 건너뛰고 이미 있는 web/out 을 검사한다 (빠른 확인용)
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export NEXT_TELEMETRY_DISABLED=1 # Next.js 사용 통계 전송 끄기 (추적 없음 원칙)

skip_build=0
[[ "${1:-}" == "--skip-build" ]] && skip_build=1
fail=0

command -v node >/dev/null || { echo "✗ node 가 없습니다. ADR-0004 의 설치 방법을 보세요."; exit 1; }
if [[ ! -d web/node_modules ]]; then
  echo "▶ 의존성 설치 (npm ci)"
  npm --prefix web ci --no-fund --no-audit || exit 1
fi

echo "▶ 타입 검사 (tsc)"
npm --prefix web run --silent typecheck || fail=1

echo "▶ 린트 (eslint)"
npm --prefix web run --silent lint || fail=1

echo "▶ 테스트 (vitest)"
npm --prefix web run --silent test || fail=1

echo "▶ 회원 API 테스트 (pytest, SQLite)"
if command -v uv >/dev/null; then
  (cd api && uv run --frozen --quiet pytest) || fail=1
else
  echo "  ✗ uv 가 없습니다 (https://docs.astral.sh/uv/)"
  fail=1
fi

if (( ! skip_build )); then
  echo "▶ 출시 빌드 (next build → web/out, 초안 제외)"
  if [[ "${SHOW_DRAFTS:-}" == "1" ]]; then
    echo "  ✗ SHOW_DRAFTS=1 이 켜져 있습니다. 출시 빌드 검사는 초안 없이 해야 합니다."
    fail=1
  elif ! npm --prefix web run --silent build; then
    fail=1
  fi
fi

echo "▶ 빌드 결과 (web/out: 링크·앵커·메타·CSP 해시·외부 리소스)"
if [[ -d web/out ]]; then
  python3 scripts/check_site.py web/out --built || fail=1
else
  echo "  ✗ web/out 이 없습니다"
  fail=1
fi

echo "▶ 셸 스크립트 문법"
while IFS= read -r -d '' f; do
  if ! bash -n "$f"; then
    echo "  ✗ $f"
    fail=1
  fi
done < <(find . \( -path ./.git -o -path ./web/node_modules -o -path ./web/.next -o -path ./web/out -o -path ./api/.venv \) -prune -o -name '*.sh' -print0)

echo "▶ 줄바꿈 (CRLF 금지)"
while IFS= read -r f; do
  echo "  ✗ CRLF: $f"
  fail=1
done < <(grep -rIl --exclude-dir={.git,node_modules,.next,out,.venv,data,.pytest_cache,__pycache__} $'\r' . || true)

if (( fail )); then
  echo "✗ 검사 실패"
  exit 1
fi
echo "✓ 모든 검사 통과"
