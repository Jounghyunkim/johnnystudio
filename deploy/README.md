# 배포 가이드: 홈 서버 M8 (nginx)

> **Last Updated**: 2026-11-05
> **상태**: 서버 설정 전. 도메인이 정해지면 §2 를 진행한다.
> 결정 배경: [ADR-0002](../docs/04_architecture/adr/0002-deploy-home-server-nginx.md)

## 1. 구조

```
[방문자] → iptime 공유기 (80/443) → M8 (192.168.0.206) nginx
                                     ├─ johnnyhouse.iptime.org → Arkurator 백엔드 (기존, 건드리지 않는다)
                                     └─ <도메인>              → /opt/johnnystudio/current

/opt/johnnystudio/
├── releases/
│   ├── 20261105-153000/     ← deploy.sh 가 src/ 를 복사해서 만든 릴리스 (최근 5개 보관)
│   └── 20261106-101500/
└── current → releases/20261106-101500    ← nginx root. 이 링크만 바꿔서 배포·롤백한다
```

| 파일 | 역할 |
|---|---|
| `deploy.sh` | 검사 → 새 릴리스로 복사 → `current` 교체 → 오래된 릴리스 정리 |
| `rollback.sh` | `current` 를 이전 릴리스(또는 지정한 릴리스)로 되돌린다 |
| `nginx/johnnystudio.conf` | nginx 사이트 설정 템플릿. `__DOMAIN__` 을 실제 도메인으로 바꿔서 쓴다 |

## 2. 서버 1회 설정

> sudo 가 필요하다. **사용자가 직접** 터미널에서 실행한다. (AI 도구는 실행하지 않는다)

### 2-0. 먼저 정할 것: 도메인

`*.iptime.org` 에는 공인 인증서를 받을 수 없어서 자기 도메인이 필요하다. DNS 연결 방식은 ADR-0002 의 "미결정" 항목을 본다.

### 2-1. 배포 폴더

```bash
sudo mkdir -p /opt/johnnystudio/releases
sudo chown -R jounghyun-kim:jounghyun-kim /opt/johnnystudio
```

### 2-2. 첫 배포 (`current` 링크가 생긴다)

```bash
cd ~/workspace/JohnnyStudio
./deploy/deploy.sh
```

### 2-3. nginx 사이트 추가

```bash
DOMAIN=example.com    # ← 실제 도메인으로 바꾼다
sed "s/__DOMAIN__/$DOMAIN/g" deploy/nginx/johnnystudio.conf \
  | sudo tee /etc/nginx/sites-available/johnnystudio >/dev/null
sudo ln -s /etc/nginx/sites-available/johnnystudio /etc/nginx/sites-enabled/johnnystudio
sudo nginx -t && sudo systemctl reload nginx
```

- `nginx -t` 가 실패하면 reload 하지 않는다. Arkurator 백엔드도 같은 nginx 를 쓴다.
- 기존 `arkurator-backend` 사이트 파일은 그대로 둔다. 새 서버 블록은 `server_name` 이 달라서 서로 영향을 주지 않는다.
  IP 로 바로 들어오는 요청은 지금처럼 Arkurator 블록이 받는다 (`default_server` 가 없으면 먼저 읽힌 블록이 기본이 된다).

### 2-4. DNS 연결 확인

```bash
dig +short "$DOMAIN"          # 공유기의 공인 IP 가 나와야 한다
curl -I "http://$DOMAIN/"     # 200 이 나와야 한다
```

### 2-5. HTTPS (Let's Encrypt)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --redirect
```

certbot 은 `/etc/nginx/sites-available/johnnystudio` 에 443 설정과 HTTP→HTTPS 리다이렉트를 추가하고, 자동 갱신 타이머를 등록한다.

> ⚠️ 이후에는 **서버의 사이트 파일이 기준**이다. 템플릿을 고친 뒤 §2-3 의 `tee` 로 다시 덮어쓰면 certbot 이 추가한 443 설정이 사라진다.
> 설정을 바꿀 때는 서버 파일을 직접 고치고, 같은 내용을 템플릿에도 반영해 둔다.

## 3. 일상 배포

```bash
./deploy/deploy.sh
```

- 배포 전에 `scripts/check.sh` 가 자동으로 실행된다. 검사가 실패하면 배포하지 않는다.
- `src/` 에 커밋되지 않은 변경이 있으면 경고만 하고 배포한다. 되도록 커밋한 뒤 배포한다 (릴리스의 `.release` 파일에 커밋 해시가 남는다).
- 정적 파일이라 nginx reload 는 필요 없다.

## 4. 롤백

```bash
./deploy/rollback.sh --list             # 릴리스 목록 (▶ = 현재)
./deploy/rollback.sh                    # 바로 이전 릴리스로
./deploy/rollback.sh 20261105-153000    # 지정한 릴리스로
```

## 5. 출시 체크리스트

- [ ] 자리표시 콘텐츠를 실제 콘텐츠로 교체 (`grep -rn "TODO(" src/` 결과 0건)
- [ ] `src/robots.txt` 를 `Allow: /` 로 바꾸고 `Sitemap: https://<도메인>/sitemap.xml` 추가
- [ ] `src/sitemap.xml` 작성
- [ ] 페이지마다 `<link rel="canonical">` 과 Open Graph 메타 태그
- [ ] HTTPS 동작, HTTP → HTTPS 리다이렉트 확인
- [ ] 브라우저 개발자 도구 콘솔에 CSP 위반 경고가 없는지 확인
- [ ] 모바일 화면 확인 (가로 스크롤 없음)
- [ ] (선택) 검색엔진 등록: Google Search Console, 네이버 서치어드바이저

## 6. 문제 해결

| 증상 | 확인할 것 |
|---|---|
| 403 Forbidden | `ls -ld /opt/johnnystudio /opt/johnnystudio/current/`: 다른 사용자에게 읽기(r)·실행(x) 권한이 있는가 |
| 바뀐 CSS 가 안 보인다 | CSS·JS 캐시는 1시간이다. 강력 새로고침(Ctrl+Shift+R) |
| Arkurator 응답이 나온다 | 요청한 주소가 `server_name` 과 맞는가, 사이트 파일이 `sites-enabled` 에 링크되어 있는가 |
| 로그 | `sudo tail -f /var/log/nginx/johnnystudio.error.log` |
