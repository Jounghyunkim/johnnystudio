#!/usr/bin/env bash
# 배포 되돌리기: current 링크를 다른 릴리스로 바꾼다.
#
#   ./deploy/rollback.sh                    current 바로 앞 릴리스로
#   ./deploy/rollback.sh 20261105-153000    지정한 릴리스로
#   ./deploy/rollback.sh --list             릴리스 목록 (▶ = 현재)
#
# 환경 변수: JOHNNYSTUDIO_DEPLOY_BASE (기본 /opt/johnnystudio)
set -euo pipefail

BASE="${JOHNNYSTUDIO_DEPLOY_BASE:-/opt/johnnystudio}"
RELEASES="$BASE/releases"

die() { echo "✗ $*" >&2; exit 1; }

[[ -L "$BASE/current" ]] || die "$BASE/current 링크가 없습니다. 아직 배포한 적이 없습니다."
current="$(basename "$(readlink "$BASE/current")")"
mapfile -t all < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)

if [[ "${1:-}" == "--list" ]]; then
  for r in "${all[@]}"; do
    mark="  "
    if [[ "$r" == "$current" ]]; then mark="▶ "; fi
    info="$(grep -m1 '^commit=' "$RELEASES/$r/.release" 2>/dev/null | cut -d= -f2- || true)"
    echo "$mark$r  ${info:+commit $info}"
  done
  exit 0
fi

if [[ $# -ge 1 ]]; then
  target="$1"
  [[ "$target" =~ ^[0-9]{8}-[0-9]{6}$ && -d "$RELEASES/$target" ]] \
    || die "릴리스가 없습니다: $target (목록: ./deploy/rollback.sh --list)"
else
  target=""
  for i in "${!all[@]}"; do
    if [[ "${all[$i]}" == "$current" ]]; then
      if (( i > 0 )); then target="${all[$((i - 1))]}"; fi
      break
    fi
  done
  [[ -n "$target" ]] || die "$current 보다 앞선 릴리스가 없습니다."
fi

[[ "$target" != "$current" ]] || die "이미 $current 입니다."

ln -sfn "$RELEASES/$target" "$BASE/.current.tmp"
mv -Tf "$BASE/.current.tmp" "$BASE/current"
echo "✓ 롤백: $current → $target"
