# shellcheck shell=bash
# dev.sh 가 불러 쓰는 함수: 작품 관리 서버(web/scripts/admin/cli.ts serve)를 뒤에서 띄우고, 스크립트가 끝나면 함께 끈다 (ADR-0009).
#
#   start_admin <포트>            → ADMIN_TOKEN 에 관리 토큰을 넣어 둔다 (관리 화면 주소 #k=… 에 쓴다)
#   start_admin <포트> --public   → 인터넷 공개용 (dev.sh 가 PUBLIC_URL 일 때, ADR-0010)
#
# - 관리 서버는 127.0.0.1 에서만 듣고, 관리 화면은 Next 개발 서버의 /__admin/ 를 거쳐 부른다.
# - 관리 토큰
#   - 보통: .local/admin-token (권한 600, git 제외)에 한 번 만들고 계속 쓴다. 그래서 관리 화면 주소를 북마크해 둘 수 있다.
#     토큰을 바꾸려면 그 파일을 지우고 dev.sh 를 다시 띄운다.
#   - --public: 실행할 때마다 새로 만들고 파일에 남기지 않는다. http 로 오가다 새어 나가도 dev.sh 를 끄면 쓸 수 없다.
# - 다운로드 파일 보관 폴더: JOHNNYSTUDIO_FILES_DIR > /opt/johnnystudio/files (있고 쓸 수 있으면, --public 이면 쓰지 않음) > .local/files

new_admin_token() {
  head -c 32 /dev/urandom | base64 | tr '+/' '-_' | tr -d '=\n'
}

start_admin() {
  local port="$1" public=0
  [[ "${2:-}" == "--public" ]] && public=1
  local local_dir="$ADMIN_REPO_ROOT/.local"
  mkdir -p "$local_dir"
  chmod 700 "$local_dir"

  if (( public )); then
    ADMIN_TOKEN="$(new_admin_token)"
  else
    local token_file="$local_dir/admin-token"
    if [[ ! -s "$token_file" ]]; then
      (umask 077 && new_admin_token > "$token_file")
    fi
    chmod 600 "$token_file"
    ADMIN_TOKEN="$(cat "$token_file")"
  fi

  if [[ -z "${JOHNNYSTUDIO_FILES_DIR:-}" ]]; then
    # 인터넷 공개 중에는 운영 다운로드 폴더에 바로 쓰지 않는다 (토큰이 새면 공개 파일이 바뀔 수 있다). 복사는 사람이 한다
    if (( ! public )) && [[ -d /opt/johnnystudio/files && -w /opt/johnnystudio/files ]]; then
      JOHNNYSTUDIO_FILES_DIR=/opt/johnnystudio/files
    else
      JOHNNYSTUDIO_FILES_DIR="$local_dir/files"
    fi
  fi
  export JOHNNYSTUDIO_FILES_DIR

  (
    cd "$ADMIN_REPO_ROOT/web" || exit 1
    # web/package.json 의 "admin" 스크립트와 같은 명령. npm 을 거치지 않아야 끌 때 신호가 node 에 바로 간다.
    # 토큰은 명령줄(ps 로 누구나 보인다)이 아니라 환경 변수로 넘긴다
    JOHNNYSTUDIO_ADMIN_TOKEN="$ADMIN_TOKEN" JOHNNYSTUDIO_ADMIN_PORT="$port" \
      exec node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/admin/ts-hooks.mjs scripts/admin/cli.ts serve
  ) &
  track_background "$!"
}

ADMIN_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/_bg.sh
source "$(dirname "${BASH_SOURCE[0]}")/_bg.sh"
