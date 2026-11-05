# ADR-0002: 홈 서버 M8 의 nginx 로 배포한다 (릴리스 폴더 + current 링크)

- **상태**: 채택됨 (도메인 미결정)
- **날짜**: 2026-11-05
- **관련**: [ADR-0001](0001-static-html-stack.md), [deploy/README.md](../../../deploy/README.md)

## 맥락

- 사용자가 홈 서버 GMKtec M8 (Ubuntu 26.04) 에 배포하기로 했다.
- M8 의 nginx 는 이미 Arkurator 백엔드(`johnnyhouse.iptime.org`, 80/443)를 운영하고 있다. 그 설정을 건드리면 안 된다.
- nginx(`www-data`)는 `/home/jounghyun-kim`(권한 750) 안을 읽을 수 없다. 그래서 웹 파일은 홈 디렉터리 밖에 둬야 한다.
- `*.iptime.org` 에는 공인 인증서(Let's Encrypt)를 발급받을 수 없다 (iptime.org 의 CAA 레코드가 막고 있다.
  Arkurator `docs/BACKEND_SERVER_OPS.md` §4-3 참고). 공개 포털에 자체서명 인증서는 쓸 수 없다.

## 결정

1. 같은 nginx 에 **새 사이트 파일**(`/etc/nginx/sites-available/johnnystudio`)을 추가하고, `server_name` 으로 Arkurator 와 구분한다.
   템플릿은 `deploy/nginx/johnnystudio.conf` 이다.
2. 배포 위치는 `/opt/johnnystudio/` 다 (Arkurator 의 `/opt/arkurator` 관례를 따른다).
   - `deploy/deploy.sh` 가 `src/` 를 `releases/<YYYYMMDD-HHMMSS>/` 로 복사한 뒤 `current` 심볼릭 링크를 새 릴리스로 바꾼다.
   - nginx 의 `root` 는 `current` 다. 정적 파일이라서 nginx reload 없이 바로 반영된다.
   - 롤백은 링크만 되돌리면 된다 (`deploy/rollback.sh`). 릴리스는 최근 5개만 남긴다.
3. HTTPS 는 **자기 도메인 + certbot(Let's Encrypt)** 으로 한다.

## 미결정

- [ ] **도메인 이름.** 정해지면 DNS 연결 방식도 정한다. 선택지는 아래와 같다 `[확인 필요]`.
  - A 레코드 → 공유기 공인 IP. 단순하지만 공인 IP 가 바뀌면 직접 갱신해야 한다.
  - 하위 도메인(`www` 등)을 `johnnyhouse.iptime.org` 로 CNAME. iptime DDNS 가 IP 변동을 따라간다.
    루트 도메인에는 CNAME 을 걸 수 없고, 이 구성에서 certbot 발급이 되는지는 실제로 확인해야 한다.
  - **Cloudflare Tunnel** ([ideation.md](../../ideation.md) 의 제안). M8 의 `cloudflared` 가 Cloudflare 로 나가는 연결을 맺고,
    Cloudflare 가 HTTPS 를 처리한 뒤 M8 nginx 로 넘긴다. 포트포워딩·certbot·공인 IP 변동 문제가 없어진다.
    대신 도메인 DNS 를 Cloudflare 에 맡겨야 한다. 이 방식을 고르면 결정 2(릴리스 + current)는 그대로 두고, 결정 3(certbot)만 새 ADR 로 대체한다.

## 결과

- **좋아지는 점**: 추가 비용이 없다. 배포와 롤백이 몇 초 안에 끝난다. Arkurator 와 서로 영향을 주지 않는다.
- **감수할 점**: 가정용 회선과 정전에 가용성이 묶인다. 서버 1회 설정에 sudo 가 필요하다 (사용자가 직접 실행).

## 재검토 조건

- 가용성이나 트래픽이 중요해지면 Cloudflare Pages 같은 정적 호스팅으로 옮긴다. `src/` 를 그대로 올리면 된다.
