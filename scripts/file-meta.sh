#!/usr/bin/env bash
# 다운로드 파일의 크기·SHA-256 을 구해서 content/assets/<slug>.md 의 downloads 에 붙여 넣을 YAML 을 보여 준다.
#
#   ./scripts/file-meta.sh <파일> <slug>
#   예) ./scripts/file-meta.sh ~/build/hw-monitor-1.2.0-setup.exe hardware-monitor
#
# 파일 자체는 git 에 넣지 않는다. 서버의 /opt/johnnystudio/files/<slug>/ 에 둔다 (ADR-0005).
set -euo pipefail

die() { echo "✗ $*" >&2; exit 1; }

[[ $# -eq 2 ]] || die "사용법: ./scripts/file-meta.sh <파일> <slug>"
file="$1"
slug="$2"
[[ -f "$file" ]] || die "파일이 없습니다: $file"
[[ "$slug" =~ ^[a-z0-9]+(-[a-z0-9]+)*$ ]] || die "slug 는 영문 소문자·숫자·하이픈만 씁니다: $slug"

name="$(basename "$file")"
size="$(stat -c %s "$file")"
sha="$(sha256sum "$file" | cut -d' ' -f1)"

cat <<EOF
  - label: <예: Windows 설치 파일>
    file: /files/$slug/$name
    version: <버전>
    os: [windows]
    size: $size
    sha256: $sha
    released: $(date +%F)
    signed: false
EOF

{
  echo
  echo "서버에 올리기:"
  echo "  install -D -m 644 \"$file\" /opt/johnnystudio/files/$slug/$name"
} >&2
