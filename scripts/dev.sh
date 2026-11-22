#!/usr/bin/env bash
# 개발 미리보기: 초안(draft)·샘플까지 보이고, 코드를 고치면 바로 반영된다. 회원 API 도 함께 뜬다.
#
#   ./scripts/dev.sh                → http://localhost:3000  (회원 API 는 127.0.0.1:3001, /api/ 로 연결됨)
#   PORT=3100 ./scripts/dev.sh      → 포트 바꾸기 (API_PORT 로 API 포트도 바꿀 수 있다)
#   HOST=0.0.0.0 ./scripts/dev.sh   → 같은 네트워크의 다른 PC·휴대폰에서 http://192.168.0.206:3000 으로 접속
#                                     (서버 방화벽에서 3000 을 열어야 한다: sudo ufw allow from 192.168.0.0/24 to any port 3000 proto tcp)
#   PUBLIC_URL=http://johnnyhouse.iptime.org:3000 ./scripts/dev.sh
#                                   → 공유기 포트포워딩으로 인터넷에서 접속 (잠깐 시험할 때만. 아래 경고 참고)
#   NO_API=1 ./scripts/dev.sh       → 회원 API 없이 화면만
#   NO_ADMIN=1 ./scripts/dev.sh     → 작품 관리 서버 없이 (관리 화면 /admin/ 이 '연결할 수 없음'으로 보이고, /files/ 다운로드도 안 된다)
#
# 작품 관리 화면: 터미널에 찍히는 http://…/admin/#k=<토큰> 으로 연다 (ADR-0009, docs/02_planning/CONTENT_GUIDE.md §0).
#   관리 서버는 127.0.0.1:3002(ADMIN_PORT) 에서 content/ 와 web/public/media 를 고친다. 출시 빌드에는 관리 화면이 없다.
#   PUBLIC_URL 로 인터넷에 열 때도 켠다 (ADR-0010). 이때 토큰은 실행할 때마다 새로 만들고(이번 실행에만 유효),
#   다운로드 파일은 운영 폴더가 아니라 .local/files 에 둔다. 끄려면 NO_ADMIN=1.
#
# 로그인 메일은 실제로 보내지 않고 이 터미널에 찍힌다. api/.env.local 에 메일 설정이 있으면 진짜로 보낸다.
# 실제로 배포될 모습(초안 제외)은 ./scripts/preview.sh 로 본다.
# /files/ 다운로드: 관리 서버가 다운로드 보관 폴더(.local/files 또는 /opt/johnnystudio/files)에서 읽기 전용으로 내준다 (운영은 nginx).
#   출시 빌드 미리보기(preview.sh)에는 아직 없다.
#
# 접속 주소가 중요한 이유 (세 곳이 모두 그 주소를 알아야 한다):
#   1. Next 개발 서버: 모르는 주소로 열면 HMR 연결을 막고, 그러면 화면의 JavaScript 가 붙지 않아 버튼이 동작하지 않는다
#      → JOHNNYSTUDIO_DEV_HOSTS (next.config.ts 의 allowedDevOrigins)
#   2. 회원 API 의 CSRF 검사: 모르는 출처의 요청을 거부한다 → JOHNNYSTUDIO_EXTRA_ORIGINS
#   3. 로그인 메일의 링크: 메일을 여는 기기에서 열리는 주소여야 한다 → JOHNNYSTUDIO_SITE_URL
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${PORT:-3000}"
HOST="${HOST:-127.0.0.1}"
API_PORT="${API_PORT:-3001}"
ADMIN_PORT="${ADMIN_PORT:-3002}"
PUBLIC_URL="${PUBLIC_URL:-}"
export NEXT_TELEMETRY_DISABLED=1

if [[ -n "$PUBLIC_URL" ]]; then
  PUBLIC_URL="${PUBLIC_URL%/}"
  [[ "$PUBLIC_URL" =~ ^https?://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] \
    || { echo "✗ PUBLIC_URL 은 http(s)://주소[:포트] 형식이어야 합니다: $PUBLIC_URL"; exit 1; }
  HOST=0.0.0.0 # 밖에서 들어오려면 모든 주소로 들어야 한다
fi

[[ -d "$ROOT/web/node_modules" ]] || npm --prefix "$ROOT/web" ci --no-fund --no-audit

# ── 이 개발 서버를 부를 수 있는 주소 ──
site="http://localhost:$PORT"
hosts=("127.0.0.1") # localhost 는 Next 가 기본으로 받아 준다
origins=("http://localhost:$PORT" "http://127.0.0.1:$PORT")
if [[ "$HOST" != "127.0.0.1" && "$HOST" != "localhost" ]]; then
  read -ra ips <<< "$(hostname -I 2>/dev/null || true)"
  for ip in "${ips[@]}"; do
    [[ "$ip" == *:* ]] && continue # IPv6 는 건너뛴다
    hosts+=("$ip")
    origins+=("http://$ip:$PORT")
  done
  hosts+=("$(hostname)")
  origins+=("http://$(hostname):$PORT")
  # 메일 링크도 다른 기기에서 열리도록 이 PC 의 네트워크 주소로 만든다 (localhost 는 그 기기 자신을 가리킨다)
  (( ${#ips[@]} )) && site="http://${ips[0]}:$PORT"
fi
if [[ -n "$PUBLIC_URL" ]]; then
  public_host="${PUBLIC_URL#*://}"
  hosts+=("${public_host%%:*}")
  origins+=("$PUBLIC_URL")
  site="$PUBLIC_URL"
  cat <<EOF
⚠ 개발 서버를 인터넷에 엽니다: $PUBLIC_URL
  - 초안 작품과 오류 상세(코드 위치)가 누구에게나 보입니다. 인터넷 스캐너가 이미 3000 번을 찾아오고 있습니다.
  - api/.env.local 에 메일 설정이 있으면, 누구나 로그인 링크 요청으로 내 메일 계정에서 메일이 나가게 할 수 있습니다.
  - 작품 관리 화면도 열립니다. 토큰 없이는 쓸 수 없지만, http 주소라면 토큰이 암호화되지 않은 채 오갑니다.
    공용 와이파이에서는 쓰지 말고, 끝나면 바로 끄세요 (토큰은 이번 실행에만 유효합니다).
  - 시험이 끝나면 Ctrl+C 로 끄고, 방화벽(sudo ufw delete allow 3000/tcp)과 공유기 포트포워딩을 닫으세요.
EOF
fi
JOHNNYSTUDIO_DEV_HOSTS="$(IFS=,; echo "${hosts[*]}")"
export JOHNNYSTUDIO_DEV_HOSTS

if [[ "${NO_API:-}" != "1" ]]; then
  # shellcheck source=scripts/_api.sh
  source "$ROOT/scripts/_api.sh"
  # Next 개발 서버의 /api/ 프록시는 방문자가 보낸 X-Real-IP 헤더를 그대로 넘긴다. 믿으면 요청 제한을 우회할 수 있다
  export JOHNNYSTUDIO_TRUST_PROXY_IP=0
  start_api "$API_PORT" "$site" "${origins[@]}"
  echo "  접속 주소: $site   (로그인 링크도 이 주소로 만든다)"
  export JOHNNYSTUDIO_API_ORIGIN="http://127.0.0.1:$API_PORT"
fi

if [[ "${NO_ADMIN:-}" != "1" ]]; then
  # shellcheck source=scripts/_admin.sh
  source "$ROOT/scripts/_admin.sh"
  if [[ -n "$PUBLIC_URL" ]]; then
    start_admin "$ADMIN_PORT" --public
  else
    start_admin "$ADMIN_PORT"
  fi
  export JOHNNYSTUDIO_ADMIN_ORIGIN="http://127.0.0.1:$ADMIN_PORT"
  echo "  작품 관리: $site/admin/#k=$ADMIN_TOKEN"
  if [[ -n "$PUBLIC_URL" ]]; then
    echo "             (인터넷 공개 중: 이 토큰은 이번 실행에만 유효합니다. 이 주소를 아는 사람은 작품 파일을 고칠 수 있습니다)"
  else
    echo "             (이 주소를 아는 사람은 작품 파일을 고칠 수 있습니다. 공유하지 마세요)"
  fi
fi

# exec 하지 않는다: 끝날 때 API·관리 서버도 꺼야 한다 (_bg.sh 의 trap)
npm --prefix "$ROOT/web" run dev -- --hostname "$HOST" --port "$PORT"
