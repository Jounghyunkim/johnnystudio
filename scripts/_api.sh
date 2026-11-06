# shellcheck shell=bash
# dev.sh · preview.sh 가 불러 쓰는 함수: 로컬 회원 API(FastAPI)를 뒤에서 띄우고, 스크립트가 끝나면 함께 끈다.
#
#   start_api <포트> <사이트 주소> [추가 출처…]
#
# 개발 설정: DB 는 api/data/dev.sqlite3, 메일은 보내지 않고 이 터미널에 찍는다 (로그인 링크를 여기서 복사한다).
# api/.env.local 이 있으면 그 설정을 쓴다. 메일 설정을 적어 두면 진짜 메일이 나간다 (예시: api/.env.local.example).

start_api() {
  local port="$1" site="$2"
  shift 2
  local extra
  extra="$(IFS=,; echo "$*")"

  command -v uv >/dev/null || { echo "✗ uv 가 없습니다 (https://docs.astral.sh/uv/). 회원 API 없이 계속하려면 NO_API=1"; exit 1; }
  uv sync --frozen --quiet --directory "$API_ROOT" || exit 1

  local env_file="$API_ROOT/.env.local" where="로그인 메일은 이 터미널에 나온다"
  if [[ -f "$env_file" ]]; then
    if grep -q '^JOHNNYSTUDIO_MAIL_BACKEND=smtp' "$env_file"; then
      where="api/.env.local 의 SMTP 로 진짜 메일을 보낸다. 실패하면 이 터미널에 '메일 발송 실패'가 나온다"
    fi
    [[ "$(stat -c %a "$env_file")" == 600 ]] || echo "⚠ api/.env.local 에 비밀번호가 있다면 권한을 줄인다: chmod 600 api/.env.local"
  else
    env_file=""
  fi

  echo "▶ 회원 API → http://127.0.0.1:$port/api/  ($where)"
  (
    cd "$API_ROOT" || exit 1
    JOHNNYSTUDIO_ENV_FILE="$env_file" \
    JOHNNYSTUDIO_ENV=development \
    JOHNNYSTUDIO_SITE_URL="$site" \
    JOHNNYSTUDIO_EXTRA_ORIGINS="$extra" \
    exec .venv/bin/uvicorn --factory app.main:create_app \
      --host 127.0.0.1 --port "$port" --reload --reload-dir app \
      --no-proxy-headers --log-level warning
  ) &
  API_PID=$!
  # shellcheck disable=SC2064
  trap "kill $API_PID 2>/dev/null; wait $API_PID 2>/dev/null" EXIT
  trap 'exit 130' INT TERM
}

API_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../api" && pwd)"
