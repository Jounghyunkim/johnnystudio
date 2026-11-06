# ADR-0007: 회원 기능은 매직 링크 + FastAPI(/api/)로, 웹은 정적 내보내기를 유지하고 CSP 는 해시로 조인다

- **상태**: 일부 대체됨: 결정 1의 "비밀번호는 없다"는 [ADR-0008](0008-password-login.md) 이 대체했다 (가입은 메일 인증, 로그인은 이메일 + 비밀번호). 나머지 결정은 유효하다
- **날짜**: 2026-11-05
- **관련**: [ADR-0004](0004-nextjs-static-export.md) (그 안의 "Phase 2 에서 서버 모드 + nonce CSP" 계획을 대체한다), [ADR-0006](0006-cloudflare-tunnel.md),
  [ideation.md](../../ideation.md) §5 · R2 · R4 · R8, [ARCHITECTURE.md](../ARCHITECTURE.md) §8

## 맥락

- 사용자가 "로그인과 이메일 인증을 통한 회원 가입"을 요청했다 (2026-11-05). 로드맵상 Phase 2 의 일이다.
- 기획안(ideation §5)의 Phase 2 계획에는 다섯 가지가 들어 있었다: Next.js 서버 모드 + nonce CSP, FastAPI 단일 인증 권위, PostgreSQL, Docker Compose, Google OAuth + 이메일 매직 링크.
- ADR-0004 는 "로그인을 도입하기 전에 서버 모드 + nonce CSP 로 바꾼다"고 정했다.
  이유는 정적 내보내기의 CSP 에 `script-src 'unsafe-inline'` 이 필요해서다. 로그인이 생기면 XSS 의 피해가 커진다.
- 서버 사정
  - M8 에 PostgreSQL 18 이 돌고 있다 (Arkurator 용). Docker 는 없다.
  - Arkurator 백엔드가 같은 방식(FastAPI + systemd + 작업 폴더 .venv)으로 운영 중이다.
  - Arkurator 는 메일을 dothome PHP `mail()` 로 보낸다. 그 경로를 JohnnyStudio 가 쓸 수는 없다.
- 1인 개발이다 (R1). Phase 1 도 아직 공개 전이다.

## 검토한 선택지

**인증 방식** (사용자 선택: 매직 링크)

| 선택지 | 장점 | 단점 |
|---|---|---|
| **매직 링크** (이메일만, 비밀번호 없음) | 가입 = 로그인 링크 한 번. 비밀번호 저장·재설정·유출 위험이 없다. 기획안과 같다 | 로그인할 때마다 메일이 필요하다. 메일 발송이 멈추면 아무도 로그인할 수 없다 |
| 이메일 + 비밀번호 + 인증 메일 (Arkurator 방식) | 익숙하다. 메일 없이 로그인된다 | 해시·재설정·잠금 흐름이 더 필요하다. 지켜야 할 비밀이 늘어난다 |
| 둘 다 | 사용자가 고른다 | 만들고 검사할 것이 두 배다 |

**웹 구조** (사용자 선택: 정적 사이트 + API)

| 선택지 | 장점 | 단점 |
|---|---|---|
| **정적 내보내기 유지 + FastAPI 를 /api/ 에** | 배포는 여전히 파일 복사다. 새로 상주하는 프로세스가 하나(API)뿐이다. 공개 페이지는 빠르고 단순하다 | 로그인 상태가 HTML 에 없다 (브라우저에서 `/api/auth/me` 로 묻는다). nonce 를 쓸 수 없다 |
| Next.js 서버 모드 + nonce CSP (기획안) | 서버에서 로그인 상태로 렌더링한다. nonce CSP | 모든 페이지가 요청마다 렌더링된다. Node 프로세스가 하나 더 상주한다. 배포·설정(sudo)이 늘어난다 |

**CSP**: 정적 파일에는 nonce 를 넣을 수 없다. 하지만 인라인 스크립트의 내용이 빌드할 때 정해지므로 **해시**는 쓸 수 있다.

## 결정

1. **매직 링크로 가입·로그인한다.** 비밀번호는 없다. 받는 개인정보는 이메일 주소 하나다 (R8: 최소 수집).
   - `POST /api/auth/request {email}` 이 메일로 `/login/verify/#t=<토큰>` 링크를 보낸다. 가입 여부와 상관없이 응답이 같다 (계정 존재 여부를 드러내지 않는다).
   - 링크를 여는 것만으로는 로그인되지 않는다. 화면의 **로그인 완료** 버튼을 눌러야 `POST /api/auth/verify` 가 불린다.
     메일 보안 검사기가 링크를 미리 열어 토큰을 써 버리는 일을 막는다. 토큰을 `#` 뒤에 두어 서버 로그·Referer 에 남지 않게 한다.
   - 계정은 링크를 눌렀을 때 만든다. 인증되지 않은 계정은 생기지 않는다.
   - 링크는 15분 동안 한 번만 쓸 수 있다. 로그인하면 같은 주소로 보낸 다른 링크도 무효가 된다.
   - Google OAuth 는 이번에 넣지 않는다. 필요해지면 같은 API 에 붙인다.
2. **FastAPI 가 인증의 유일한 권위다** (R2). 저장소의 `api/` 에 두고, 127.0.0.1:8082 에서 듣는다. nginx 가 `/api/` 를 넘겨준다.
   - 의존성: fastapi 0.159.1, uvicorn 0.54.0, sqlalchemy 2.1.6, psycopg 3.3.6. uv 로 잠그고, `exclude-newer` 로 "2주 이상 된 버전" 규칙을 지킨다.
   - DB: 운영은 PostgreSQL. 기존 인스턴스에 **별도 역할·DB**(`johnnystudio`)를 만든다. 개발·테스트는 SQLite 를 쓴다.
     방언 전용 기능은 쓰지 않고, 두 DB 모두에서 테스트를 돌린다.
   - 스키마는 시작할 때 `create_all` 로 만든다. 처음으로 스키마를 바꿀 때 Alembic 을 들인다.
   - 실행: Arkurator 처럼 systemd 서비스로 작업 폴더의 `.venv` 에서 돌린다 (`deploy/systemd/johnnystudio-api.service`). Docker 는 아직 들이지 않는다.
3. **세션**: 무작위 토큰을 쿠키에 넣고, DB 에는 SHA-256 해시만 둔다. 쿠키 이름은 `__Host-johnnystudio_session` 이다 (`HttpOnly; Secure; SameSite=Lax; Path=/`). 유효 기간은 30일이다.
   로그아웃, 모든 기기에서 로그아웃, 회원 탈퇴(즉시 삭제)를 둔다.
4. **CSRF**: `SameSite=Lax` 에 더해, 상태를 바꾸는 요청은 `Origin` 이 사이트 주소와 같아야 받는다. 본문은 JSON 만 받는다.
5. **남용 방지**
   - 로그인 링크는 같은 이메일로 15분에 3번, 같은 IP 에서 1시간에 10번까지 보낸다. IP 는 비밀값으로 HMAC 한 값만 하루 동안 남긴다.
   - nginx 에서도 IP 당 분당 30회로 `/api/` 를 제한한다.
   - nginx 는 `X-Real-IP`·`X-Forwarded-For` 를 방문자 IP 로 덮어쓴다. uvicorn 은 `--no-proxy-headers` 로 실행한다. 방문자가 보낸 헤더로 IP 를 속일 수 없다.
6. **웹은 정적 내보내기를 유지한다** (ADR-0004 의 결정 2 는 그대로다). 로그인 화면(`/login/`, `/login/verify/`, `/account/`)은 클라이언트 컴포넌트가 `/api/` 를 부른다.
   개발 서버에서는 `next.config.ts` 의 rewrites 가 `/api/` 를 로컬 API 로 넘긴다. 운영과 같은 출처가 된다.
7. **CSP 는 해시로 조인다** (ADR-0004 의 "로그인 전에 nonce CSP" 를 대신한다).
   - `npm run build` 가 `next build` 다음에 `web/scripts/inject-csp.mjs` 를 돌린다.
     이 스크립트는 페이지마다 인라인 스크립트의 SHA-256 을 담은 `<meta http-equiv="Content-Security-Policy" content="script-src 'self' 'sha256-…'">` 를 넣는다.
   - nginx 헤더의 `'unsafe-inline'` 은 그대로 둔다. 브라우저는 두 정책을 모두 지키므로, 실제로는 해시가 맞는 인라인 스크립트만 실행된다.
   - `scripts/check_site.py --built` 가 HTMLParser 로 해시를 따로 계산해서 모든 페이지를 확인한다. 메타가 스크립트보다 앞에 있는지도 본다.
8. **메일 발송은 SMTP** 로 한다 (표준 라이브러리). 어느 발송 서비스든 SMTP 를 지원하면 쓸 수 있다. 업체는 아직 정하지 않았다 `[확인 필요]`.
   개발에서는 메일을 보내지 않고 터미널에 찍는다. 운영 설정 검사는 `console` 을 거부한다.

## 결과

- **좋아지는 점**
  - 배포는 여전히 "웹 = 파일 복사"다. 상주 프로세스는 API 하나뿐이다.
  - 인라인 스크립트 주입(XSS)을 CSP 가 막는다. Phase 1 보다 안전해졌다.
  - 비밀번호가 없어서 유출될 비밀이 적다. 저장하는 것은 이메일, 시각, 해시뿐이다.
  - Library 의 클라이언트 번들에서 zod 를 뺐다 (`lib/asset-types.ts`). zod 가 `eval` 을 시험하면서 나던 CSP 위반 보고도 사라졌다.
- **감수할 점**
  - 로그인 상태를 브라우저가 물어보는 동안 헤더가 잠깐 "로그인"으로 보인다.
  - 메일 발송이 멈추면 아무도 로그인할 수 없다. 발송 업체 선택과 SPF·DKIM 설정이 공개 전에 필요하다.
  - API 를 재시작하려면 sudo 가 필요하다. `deploy.sh` 는 재시작이 필요할 때 알려 주기만 한다.
  - 개발(SQLite)과 운영(PostgreSQL)의 DB 가 다르다. 테스트를 두 DB 에서 모두 돌려 줄인다 (`JOHNNYSTUDIO_TEST_DATABASE_URL`).
  - CSP 헤더 자체에는 여전히 `'unsafe-inline'` 이 있다. 메타가 빠진 HTML 이 생기면 보호가 사라진다. `check_site.py` 가 막는다.

## 재검토 조건

- 서버에서 로그인 상태로 렌더링해야 하는 화면이 생길 때 (Client Room 대시보드 등) → Next.js 서버 모드 재검토
- 비밀번호 로그인이나 Google OAuth 요구가 생길 때
- 처음으로 DB 스키마를 바꿀 때 → Alembic 도입
- 서비스가 셋 이상(MinIO, Redis 등)으로 늘 때 → Docker Compose 재검토
