# ADR-0006: 외부 공개는 Cloudflare Tunnel 로 하고, nginx 사이트는 127.0.0.1:8081 에서만 듣는다

- **상태**: 채택됨 (적용은 도메인 확정 후)
- **날짜**: 2026-11-05
- **대체**: [ADR-0002](0002-deploy-home-server-nginx.md) 의 결정 1(80 포트 server_name 공유)과 결정 3(certbot)
- **관련**: [ideation.md](../../ideation.md) §5, [deploy/README.md](../../../deploy/README.md) §4

## 맥락

- 사용자의 기획안이 Docker + **Cloudflare Tunnel** 로 외부 도메인을 연결하자고 했다.
- `*.iptime.org` 에는 공인 인증서를 받을 수 없다 (ADR-0002). 자기 도메인이 필요하다.
- M8 의 80/443 은 공유기 포트포워딩으로 Arkurator 백엔드가 쓰고 있다. 같은 포트를 나눠 쓰면 설정이 서로 엮인다.

## 결정

1. 방문자 → **Cloudflare (HTTPS)** → **Tunnel** → M8 의 `cloudflared` → **nginx `127.0.0.1:8081`** → `/opt/johnnystudio/current`.
2. JohnnyStudio nginx 사이트는 **`127.0.0.1:8081` 에서만** 듣는다. 외부에서 직접 닿을 수 없고, Arkurator(80/443)와 포트부터 다르다.
3. HTTPS·HTTP→HTTPS 리다이렉트·HSTS 는 Cloudflare 에서 처리한다. 서버에는 인증서가 없다.
4. 터널 뒤에서 생기는 문제를 nginx 설정으로 막는다.
   - `absolute_redirect off`: nginx 가 디렉터리 리다이렉트에 자기 주소(`http://도메인:8081/…`)를 넣지 않게 한다 (2026-11-05 시험에서 실제로 확인한 문제).
   - `real_ip_header CF-Connecting-IP` (`set_real_ip_from 127.0.0.1`): 로그에 방문자 실제 IP 를 남긴다.

## 결과

- **좋아지는 점**: 포트를 새로 열지 않는다. 인증서 발급·갱신과 공인 IP 변동을 신경 쓰지 않아도 된다. Arkurator 와 완전히 분리된다.
- **감수할 점**:
  - 도메인 DNS 를 Cloudflare 에 맡긴다. Sovereignty 원칙과는 타협이다. **빠지는 길**: ADR-0002 방식(포트포워딩 + certbot)으로 되돌릴 수 있게
    nginx 설정은 일반적인 형태로 유지한다.
  - 큰 파일을 Cloudflare 를 거쳐 내줄 때의 약관 제한을 확인해야 한다 `[확인 필요]` (ideation R7). 문제가 되면 큰 파일은 GitHub Releases 로 옮긴다.

## 미결정

- [ ] 도메인 이름 (ideation §9-1, 후보 `johnnystudio.net`)
