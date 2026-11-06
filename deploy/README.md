# 배포 가이드: 홈 서버 M8 (nginx + Cloudflare Tunnel)

> **Last Updated**: 2026-11-06
> **상태**: 서버 설정 전. 도메인이 정해지면 §2 → §3 → §4 순서로 진행한다. 로그인을 쓰지 않을 동안은 §3 을 미뤄도 된다.
> 결정 배경: [ADR-0002](../docs/04_architecture/adr/0002-deploy-home-server-nginx.md) (릴리스 + current),
> [ADR-0006](../docs/04_architecture/adr/0006-cloudflare-tunnel.md) (Cloudflare Tunnel), [ADR-0007](../docs/04_architecture/adr/0007-magic-link-auth-api.md) · [ADR-0008](../docs/04_architecture/adr/0008-password-login.md) (회원 API)

## 1. 구조

```
[방문자] ─HTTPS─▶ Cloudflare ─Tunnel─▶ cloudflared (M8) ─▶ nginx 127.0.0.1:8081 ─┬▶ /opt/johnnystudio/current
                                                               (Arkurator 의 80/443 과 따로 논다) └▶ /api/ → 127.0.0.1:8082 (johnnystudio-api)
                                                                                                    └▶ PostgreSQL DB johnnystudio

/opt/johnnystudio/
├── releases/
│   ├── 20261105-153000/     ← deploy.sh 가 web/out 을 복사해서 만든 릴리스 (최근 5개 보관)
│   └── 20261106-101500/
├── current → releases/20261106-101500    ← nginx root. 이 링크만 바꿔서 배포·롤백한다
├── files/                   ← 다운로드 파일 (exe·zip·사진). 배포와 상관없이 유지된다 → /files/
└── api.env                  ← 회원 API 운영 설정·비밀값 (권한 600, 커밋하지 않는다)
```

| 파일 | 역할 |
|---|---|
| `deploy.sh` | 검사·출시 빌드 → 새 릴리스로 복사 → `current` 교체 → 오래된 릴리스 정리 |
| `rollback.sh` | `current` 를 이전 릴리스(또는 지정한 릴리스)로 되돌린다 |
| `nginx/johnnystudio.conf` | nginx 사이트 설정 템플릿 (`__DOMAIN__` 을 실제 도메인으로 바꿔서 쓴다) |
| `cloudflared/config.yml.example` | Cloudflare Tunnel 설정 예시 |
| `systemd/johnnystudio-api.service` | 회원 API 서비스 (작업 폴더의 `api/.venv` 에서 uvicorn, 127.0.0.1:8082) |
| `api.env.example` | 회원 API 운영 설정 예시 → `/opt/johnnystudio/api.env` |

## 2. 서버 1회 설정

> sudo 가 필요하다. **사용자가 직접** 터미널에서 실행한다. (AI 도구는 실행하지 않는다)

### 2-1. 배포 폴더

```bash
sudo mkdir -p /opt/johnnystudio/releases /opt/johnnystudio/files
sudo chown -R jounghyun-kim:jounghyun-kim /opt/johnnystudio
```

### 2-2. 첫 배포 (`current` 링크가 생긴다)

```bash
cd ~/workspace/JohnnyStudio
./deploy/deploy.sh
```

### 2-3. nginx 사이트 추가

```bash
DOMAIN=johnnystudio.net    # ← 실제 도메인으로 바꾼다 [확인 필요: ideation §9-1]
sed "s/__DOMAIN__/$DOMAIN/g" deploy/nginx/johnnystudio.conf \
  | sudo tee /etc/nginx/sites-available/johnnystudio >/dev/null
sudo ln -s /etc/nginx/sites-available/johnnystudio /etc/nginx/sites-enabled/johnnystudio
sudo nginx -t && sudo systemctl reload nginx

# 확인: 서버 안에서 직접 요청
curl -sI -H "Host: $DOMAIN" http://127.0.0.1:8081/ | head -5
```

- `nginx -t` 가 실패하면 reload 하지 않는다. Arkurator 백엔드도 같은 nginx 를 쓴다.
- 이 사이트는 `127.0.0.1:8081` 에서만 듣는다. 기존 `arkurator-backend`(80/443)와 포트가 달라서 서로 영향을 주지 않는다.

## 3. 회원 API (로그인) 1회 설정

> sudo 가 필요한 줄은 **사용자가 직접** 실행한다. 도메인이 정해진 뒤에 한다 (메일 링크와 CSRF 검사에 사이트 주소가 들어간다).
> 이 절을 하기 전에는 로그인 화면에 "회원 서버에 연결할 수 없습니다"가 나온다. 나머지 페이지는 그대로 동작한다.

### 3-1. PostgreSQL 역할·DB 만들기

M8 에서 돌고 있는 PostgreSQL 에 **JohnnyStudio 전용** 역할과 DB 를 만든다. Arkurator 의 역할·DB 는 건드리지 않는다.

```bash
DB_PW="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE ROLE johnnystudio LOGIN PASSWORD '$DB_PW'"
sudo -u postgres createdb -O johnnystudio johnnystudio
echo "$DB_PW"    # 3-2 의 DATABASE_URL 에 넣는다
```

테이블은 API 가 처음 시작할 때 만든다.

### 3-2. 설정 파일

```bash
cd ~/workspace/JohnnyStudio
install -m 600 deploy/api.env.example /opt/johnnystudio/api.env
nano /opt/johnnystudio/api.env       # 도메인, JOHNNYSTUDIO_SECRET, DATABASE_URL 의 비밀번호, SMTP (3-5)

# 확인: 설정 검사 + DB 연결 (비밀값은 찍지 않는다)
(cd api && uv sync --frozen && .venv/bin/python -m app.check_config /opt/johnnystudio/api.env)
```

- `JOHNNYSTUDIO_SECRET` 만들기: `python3 -c "import secrets; print(secrets.token_urlsafe(48))"`
- 이 파일은 셸에서 `source` 하지 않는다. `MAIL_FROM` 의 `<` 가 리다이렉션이 된다. 확인은 `app.check_config` 로 한다.

### 3-3. 서비스 설치·시작

```bash
sudo install -m 644 deploy/systemd/johnnystudio-api.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now johnnystudio-api
systemctl status johnnystudio-api --no-pager
curl -s http://127.0.0.1:8082/api/health        # {"ok":true}
```

- 서비스는 `jounghyun-kim` 사용자로, 작업 폴더의 `api/.venv` 에서 돈다 (Arkurator 백엔드와 같은 방식). 포트(8082)와 DB 가 따로다.
- 운영 설정이 틀리면 시작하지 않는다. 이유는 `journalctl -u johnnystudio-api -n 30` 에 나온다.

### 3-4. nginx 연결

§2-3 의 템플릿에 `/api/` 가 이미 들어 있다. 이 템플릿보다 예전 것으로 설치했다면 §2-3 을 다시 한다.

```bash
curl -s -H "Host: $DOMAIN" http://127.0.0.1:8081/api/health    # {"ok":true}
```

### 3-5. 메일 발송 (SMTP) `[확인 필요]`

로그인은 메일로만 한다. 메일이 나가지 않으면 아무도 로그인할 수 없다. 발송 방법을 정한다.

| 방법 | 장점 | 주의 |
|---|---|---|
| 개인 메일 계정의 SMTP (앱 비밀번호) | 바로 쓸 수 있다 | 보내는 주소가 개인 메일 주소가 된다. 하루 발송 한도가 있다 `[확인 필요]` |
| 메일 발송 서비스 (SMTP 를 지원하는 곳) | `noreply@도메인` 으로 보낸다. 도달률이 좋다 | 가입이 필요하다. 도메인 DNS(Cloudflare)에 SPF·DKIM 레코드를 추가한다 |

- 가정용 회선에서 25번 포트로 직접 보내는 방식은 쓰지 않는다. 대개 막혀 있고 스팸으로 분류된다. 발송 서비스의 제출 포트(587 STARTTLS 또는 465 SSL)를 쓴다.

**개발 PC 에서 먼저 시험하기** (서버 설정 전에도 된다)

```bash
install -m 600 api/.env.local.example api/.env.local   # 복사 (git 에 올라가지 않는다)
nano api/.env.local                                    # Gmail 또는 네이버 칸의 # 을 지우고 채운다
(cd api && .venv/bin/python -m app.check_config .env.local --no-db --send-test 받을주소@example.com)
./scripts/dev.sh                                       # 다시 띄우면 로그인 메일이 진짜로 나간다
```

| 계정 | 준비 | SMTP | 비밀번호 |
|---|---|---|---|
| Gmail | 2단계 인증을 켜고 `myaccount.google.com/apppasswords` 에서 앱 비밀번호를 만든다 | `smtp.gmail.com:587` STARTTLS, 계정 = Gmail 주소 | 앱 비밀번호 16자 (띄어쓰기 없이) |
| 네이버 | 메일 환경설정 → POP3/IMAP 설정 → **IMAP/SMTP 사용** 켜기 | `smtp.naver.com:587` STARTTLS (안 되면 465 SSL), 계정 = 아이디 또는 주소 | 2단계 인증을 쓰면 애플리케이션 비밀번호 |

- `MAIL_FROM` 의 주소는 **SMTP 계정 주소와 같아야** 한다. 네이버는 다르면 거부하고, Gmail 은 계정 주소로 바꿔서 보낸다. `check_config` 가 경고한다.
- 위 값은 각 서비스의 사용 안내 글로 확인했다. 서비스 쪽 정책이 바뀔 수 있다 `[확인 필요]`.
- 서버에 설치할 때는 같은 값을 `/opt/johnnystudio/api.env` 에 넣는다 (3-2).
- 정한 뒤 `api.env` 의 `JOHNNYSTUDIO_SMTP_*`·`MAIL_FROM` 을 채우고, 시험 메일을 보낸다.

```bash
(cd api && .venv/bin/python -m app.check_config /opt/johnnystudio/api.env --send-test 내주소@example.com)
sudo systemctl restart johnnystudio-api
```

- 업체를 정하면 개인정보처리방침(`content/pages/privacy.md` §3)의 `TODO(content)` 에 이름을 쓴다.

### 3-6. 확인

1. `https://<도메인>/signup/` 에서 내 주소를 넣는다 → 인증 메일이 온다 (스팸함도 본다)
2. 메일의 링크를 열고 **계속하기** → 비밀번호를 정한다 → "가입을 마쳤습니다"
3. 로그아웃한 뒤 `/login/` 에서 이메일 + 비밀번호로 로그인된다. 이때는 메일이 필요 없다
4. `/login/reset/` 으로 재설정 메일이 오고, 새 비밀번호를 정할 수 있다. `/account/` 에서 비밀번호 변경·로그아웃·탈퇴가 된다

## 4. Cloudflare Tunnel 로 공개

> 먼저 도메인의 DNS(네임서버)를 Cloudflare 로 옮겨 둔다. 명령과 패키지 이름은 Cloudflare 문서로 한 번 더 확인한다 `[확인 필요]`.

```bash
# 1) cloudflared 설치 (Cloudflare 공식 apt 저장소 또는 .deb)
# 2) Cloudflare 계정 로그인: 브라우저가 열린다
cloudflared tunnel login

# 3) 터널 만들기 → TUNNEL_ID 와 인증 파일(~/.cloudflared/<TUNNEL_ID>.json)이 생긴다
cloudflared tunnel create johnnystudio

# 4) DNS 연결 (도메인 → 터널)
cloudflared tunnel route dns johnnystudio "$DOMAIN"
cloudflared tunnel route dns johnnystudio "www.$DOMAIN"

# 5) 설정 파일과 인증 파일을 서비스 위치로
sudo mkdir -p /etc/cloudflared
sed -e "s/__DOMAIN__/$DOMAIN/g" -e "s/<TUNNEL_ID>/실제-ID/g" deploy/cloudflared/config.yml.example \
  | sudo tee /etc/cloudflared/config.yml >/dev/null
sudo cp ~/.cloudflared/실제-ID.json /etc/cloudflared/
sudo cloudflared tunnel ingress validate --config /etc/cloudflared/config.yml

# 6) 서비스로 설치·시작
sudo cloudflared service install
sudo systemctl status cloudflared --no-pager
```

Cloudflare 대시보드에서 다음을 켠다: **Always Use HTTPS**, **HSTS**(동작을 확인한 뒤), 최소 TLS 1.2.

> 대용량 파일(큰 exe·zip)을 Cloudflare 를 거쳐 내줄 때의 약관 제한을 확인한다 (ideation R7) `[확인 필요]`.
> 문제가 되면 큰 파일은 GitHub Releases 에 두고 `file:` 에 그 주소를 쓴다.

## 5. 일상 배포

```bash
./deploy/deploy.sh
```

- 배포 전에 `scripts/check.sh` 가 자동으로 돈다 (타입·린트·테스트·출시 빌드·빌드 결과 검사). 실패하면 배포하지 않는다.
- 출시 빌드에는 `draft: true` 인 콘텐츠가 들어가지 않는다. `SHOW_DRAFTS=1` 이 켜져 있으면 배포를 거부한다.
- `web/`·`content/` 에 커밋되지 않은 변경이 있으면 경고만 하고 배포한다. 되도록 커밋한 뒤 배포한다 (릴리스의 `.release` 에 커밋 해시가 남는다).
- 정적 파일이라 nginx reload 는 필요 없다.
- **회원 API** 는 작업 폴더의 코드로 돈다. `api/` 를 바꿨다면 `deploy.sh` 가 마지막에 알려 준다. 그때 `sudo systemctl restart johnnystudio-api` 를 실행한다.

### 다운로드 파일 올리기

```bash
./scripts/file-meta.sh ~/build/hw-monitor-1.2.0-setup.exe hardware-monitor   # size·sha256 YAML 출력
install -D -m 644 ~/build/hw-monitor-1.2.0-setup.exe /opt/johnnystudio/files/hardware-monitor/hw-monitor-1.2.0-setup.exe
```

출력된 YAML 을 `content/assets/hardware-monitor.md` 의 `downloads:` 에 붙여 넣고 배포한다. 자세한 방법은 [CONTENT_GUIDE.md](../docs/02_planning/CONTENT_GUIDE.md).

## 6. 롤백

```bash
./deploy/rollback.sh --list             # 릴리스 목록 (▶ = 현재)
./deploy/rollback.sh                    # 바로 이전 릴리스로
./deploy/rollback.sh 20261105-153000    # 지정한 릴리스로
```

## 7. 출시 체크리스트

- [ ] 자리표시 콘텐츠를 실제 콘텐츠로 교체: `grep -rn "TODO(" web/src content` 결과에서 `TODO(launch)` 만 남을 때까지
- [ ] `web/public/robots.txt` 를 `Allow: /` 로 바꾸고, `web/src/app/layout.tsx` 의 `robots` 메타를 색인 허용으로 (`TODO(launch)`)
- [ ] `sitemap.xml`, `<link rel="canonical">`, Open Graph 이미지 (도메인 확정 후)
- [ ] Cloudflare: HTTPS 동작, HTTP → HTTPS 리다이렉트
- [ ] 브라우저 개발자 도구 콘솔에 CSP 위반 경고가 없는지 확인 (특히 영상 재생)
- [ ] 모바일 화면 확인 (가로 스크롤 없음), 키보드만으로 메뉴·검색·즐겨찾기·사진 보기
- [ ] 회원: 메일 발송 설정(§3-5)과 실제 메일 수신 확인, 개인정보처리방침의 운영자·연락처·발송 업체 채우기 (`content/pages/privacy.md`)
- [ ] 회원: DB 백업 방법 정하기 (`pg_dump` 주기, 외부 사본 1부, 보관 기간 → 개인정보처리방침 §4) `[확인 필요]`
- [ ] (선택) 검색엔진 등록: Google Search Console, 네이버 서치어드바이저

## 8. 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 502 (Cloudflare) | `systemctl status cloudflared`, `curl -sI -H "Host: $DOMAIN" http://127.0.0.1:8081/` |
| 403 Forbidden | `ls -ld /opt/johnnystudio /opt/johnnystudio/current/`: 다른 사용자에게 읽기(r)·실행(x) 권한이 있는가 |
| 다운로드 404 | `/opt/johnnystudio/files/<slug>/<파일명>` 이 `file:` 경로와 같은가 |
| 영상이 안 나온다 | 콘솔의 CSP 경고. `frame-src`·`img-src` 에 YouTube 주소가 있는가 |
| 로그인 화면: "회원 서버에 연결할 수 없습니다" | `systemctl status johnnystudio-api`, `curl -s http://127.0.0.1:8082/api/health`, nginx 의 `/api/` 설정(§3-4) |
| 로그인 링크 요청이 403 (`bad_origin`) | `api.env` 의 `JOHNNYSTUDIO_SITE_URL`·`EXTRA_ORIGINS` 가 방문자가 쓰는 주소(https, www 포함)와 같은가 |
| 로그인 메일이 오지 않는다 | `journalctl -u johnnystudio-api` 의 "메일 발송 실패", `app.check_config … --send-test`, 스팸함, SPF·DKIM |
| 429 "요청이 너무 많습니다" | 정상 동작이다 (같은 이메일 15분 3회, 같은 IP 1시간 10회) |
| 로그 | `sudo tail -f /var/log/nginx/johnnystudio.error.log`, `journalctl -u johnnystudio-api -f`, `/var/log/nginx/johnnystudio.api.log` |
