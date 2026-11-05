#!/usr/bin/env bash
# JohnnyStudio 배포: src/ 를 새 릴리스 폴더로 복사하고 current 링크를 새 릴리스로 바꾼다.
#
# 서버(M8)에서 실행한다:
#   ./deploy/deploy.sh
# 다른 PC 에서 실행할 때 (GitHub 원격을 연결한 뒤):
#   ssh jounghyun-kim@192.168.0.206 "cd ~/workspace/JohnnyStudio && git pull && ./deploy/deploy.sh"
#
# 처음 한 번은 deploy/README.md §2 의 서버 설정이 필요하다.
#
# 환경 변수
#   JOHNNYSTUDIO_DEPLOY_BASE   배포 위치 (기본 /opt/johnnystudio)
#   JOHNNYSTUDIO_KEEP          남길 릴리스 수 (기본 5)
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BASE="${JOHNNYSTUDIO_DEPLOY_BASE:-/opt/johnnystudio}"
KEEP="${JOHNNYSTUDIO_KEEP:-5}"
RELEASES="$BASE/releases"
STAMP="$(date +%Y%m%d-%H%M%S)"
TARGET="$RELEASES/$STAMP"

die() { echo "✗ $*" >&2; exit 1; }

[[ -d "$RELEASES" && -w "$RELEASES" ]] \
  || die "$RELEASES 가 없거나 쓸 수 없습니다. deploy/README.md §2 (서버 1회 설정)를 먼저 하세요."
[[ "$KEEP" =~ ^[1-9][0-9]*$ ]] || die "JOHNNYSTUDIO_KEEP 은 1 이상의 정수여야 합니다: $KEEP"

# 1. 검사: 통과하지 못하면 배포하지 않는다
"$ROOT/scripts/check.sh" || die "검사 실패. 배포를 중단합니다."

# 2. 커밋 정보 (src/ 에 커밋되지 않은 변경이 있으면 경고한다)
commit="$(git -C "$ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
dirty=""
if [[ -n "$(git -C "$ROOT" status --porcelain -- src 2>/dev/null)" ]]; then
  dirty=" +커밋 안 된 변경"
  echo "⚠ src/ 에 커밋되지 않은 변경이 있습니다. 지금 상태 그대로 배포합니다."
fi

# 3. 새 릴리스로 복사 (같은 초에 두 번 배포하면 mkdir 이 실패해서 멈춘다)
mkdir "$TARGET"
cp -a "$ROOT/src/." "$TARGET/"

# 릴리스 정보. 숨김 파일이라 nginx 가 외부에 내주지 않는다
cat > "$TARGET/.release" <<EOF
release=$STAMP
commit=$commit$dirty
deployed_at=$(date -Iseconds)
deployed_by=$(id -un)@$(hostname)
EOF

chmod -R u=rwX,go=rX "$TARGET"   # nginx(www-data) 가 읽을 수 있게

# 4. current 링크 교체. 임시 링크를 만든 뒤 mv 로 한 번에 바꿔서, 링크가 비는 순간이 없다
previous="$(readlink "$BASE/current" 2>/dev/null || true)"
ln -sfn "$TARGET" "$BASE/.current.tmp"
mv -Tf "$BASE/.current.tmp" "$BASE/current"

# 5. 오래된 릴리스 정리 (최근 KEEP 개만 남긴다. 방금 만든 릴리스가 가장 최근이다)
mapfile -t all < <(find "$RELEASES" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)
excess=$(( ${#all[@]} - KEEP ))
for (( i = 0; i < excess; i++ )); do
  rm -rf -- "${RELEASES:?}/${all[$i]}"
done

echo "✓ 배포 완료: $STAMP (commit $commit$dirty)"
if [[ -n "$previous" ]]; then
  echo "  이전 릴리스: $(basename "$previous")  (되돌리기: ./deploy/rollback.sh)"
fi
