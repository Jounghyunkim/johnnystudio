# shellcheck shell=bash
# dev.sh · preview.sh 가 불러 쓰는 도우미: 뒤에서 띄운 프로세스(회원 API, 작품 관리 서버)를 스크립트가 끝날 때 함께 끈다.
#
#   track_background <pid>
#
# _api.sh · _admin.sh 가 각자 불러도 한 번만 정의된다.
if [[ -z "${_JOHNNYSTUDIO_BG_LOADED:-}" ]]; then
  _JOHNNYSTUDIO_BG_LOADED=1
  BG_PIDS=()

  stop_background() {
    local pid
    for pid in "${BG_PIDS[@]}"; do kill "$pid" 2>/dev/null || true; done
    for pid in "${BG_PIDS[@]}"; do wait "$pid" 2>/dev/null || true; done
  }

  track_background() {
    BG_PIDS+=("$1")
    trap stop_background EXIT
    trap 'exit 130' INT TERM
  }
fi
