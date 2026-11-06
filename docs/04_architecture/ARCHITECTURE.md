# 아키텍처

> **Last Updated**: 2026-11-06
> 결정 배경: [ADR-0004](adr/0004-nextjs-static-export.md) (Next.js 정적 내보내기), [ADR-0005](adr/0005-file-based-content.md) (파일 콘텐츠),
> [ADR-0002](adr/0002-deploy-home-server-nginx.md) · [ADR-0006](adr/0006-cloudflare-tunnel.md) (배포·공개), [ADR-0007](adr/0007-magic-link-auth-api.md) (회원 API·해시 CSP),
> [ADR-0008](adr/0008-password-login.md) (비밀번호 로그인)

## 1. 한눈에 보기

```
 개발 (M8: ~/workspace/JohnnyStudio)                     운영 (M8)
 ┌──────────────────────────────┐                        ┌────────────────────────────────────────────┐
 │ content/  (작품·기록·문구)    │                        │ /opt/johnnystudio/                         │
 │     │ zod 검증               │   deploy/deploy.sh     │   releases/<시각>/  ← web/out 복사         │
 │     ▼                        │ ─────────────────────▶ │   current → releases/…   (nginx root)      │
 │ web/  Next.js → next build   │  (검사 통과 시에만)     │   files/<slug>/…    ← exe·zip (/files/)    │
 │     ▼                        │                        │                                            │
 │ web/out  (정적 HTML·JS·CSS)  │                        │ nginx 127.0.0.1:8081 ◀── cloudflared ◀──┐  │
 └──────────────────────────────┘                        └─────────────────────────────────────────│──┘
                                                                                       Cloudflare (HTTPS)
                                                                                                  ▲
                                                                                               방문자

 nginx 127.0.0.1:8081 ─┬─ /            → /opt/johnnystudio/current (정적 파일)
                       ├─ /files/      → /opt/johnnystudio/files
                       └─ /api/        → FastAPI 127.0.0.1:8082 (systemd: johnnystudio-api, 작업 폴더 api/.venv)
                                            └─ PostgreSQL 127.0.0.1:5432, DB·역할 johnnystudio (Arkurator DB 와 따로)
                                            └─ SMTP (로그인 메일, 업체 미정)
```

- 공개 페이지는 모두 미리 만든 정적 파일이다. 서버에서 도는 코드는 회원 API(`/api/`) 하나뿐이다.
- 같은 nginx 의 Arkurator 백엔드(80/443 → 127.0.0.1:8000)와 포트·DB 가 분리되어 있다.

## 2. 저장소 구조

```
JohnnyStudio/
├── web/                    Next.js 앱 (프론트엔드)
│   ├── src/app/            페이지 (App Router): /, library, library/[slug], log, about, work, studio,
│   │                       login, login/verify, account, privacy, not-found
│   ├── src/components/     화면 조각. viewers/ 는 유형별 뷰어, auth/ 는 로그인·계정
│   ├── src/lib/            schema(콘텐츠 형식) · content(읽기·검증, 서버 전용) · auth(회원 API 클라이언트) · filter · bookmarks …
│   ├── scripts/            inject-csp.mjs (빌드 뒤 페이지마다 CSP 해시 <meta>)
│   ├── public/             robots.txt, media/<slug>/ 이미지
│   └── out/                빌드 결과 (git 에 넣지 않음)
├── api/                    회원 API (FastAPI, Python 3.14, uv)
│   ├── app/                main(앱·CSRF 검사) · auth(엔드포인트) · db(테이블) · security · mailer · config
│   └── tests/              pytest (SQLite 기본, JOHNNYSTUDIO_TEST_DATABASE_URL 로 PostgreSQL)
├── content/                콘텐츠 원본: assets/*.md, lifelog.yaml, profile.yaml, pages/*.md
├── deploy/                 deploy.sh · rollback.sh · nginx/ · cloudflared/ · systemd/ · api.env.example
├── scripts/                dev.sh · preview.sh(+preview_server.py) · _api.sh · check.sh · check_site.py · file-meta.sh
└── docs/ · dev_history/    문서 · 작업 로그
```

## 3. 렌더링 원칙

- **서버 컴포넌트가 기본**이다. 빌드할 때 `content/` 를 읽어 HTML 을 만든다. 모든 작품 카드가 HTML 에 들어 있다.
- **클라이언트 컴포넌트는 상호작용에만** 쓴다.

  | 컴포넌트 | 하는 일 |
  |---|---|
  | `nav-links` | 현재 메뉴 표시, 모바일 메뉴 닫기 |
  | `library-browser` | 검색·유형 필터·정렬 (주소의 `?q=&type=&sort=`) |
  | `star-button` · `studio-link` · `studio-view` | 즐겨찾기 (localStorage) |
  | `youtube-lite` | 누를 때 iframe 로드 |
  | `photo-gallery` | `<dialog>` 확대 보기, 화살표 키 |
  | `copy-button` | 체크섬 복사 |
  | `account-link` · `auth/*` | 로그인 상태 표시, 비밀번호 로그인, 메일 링크 요청·확인, 비밀번호 설정, 계정·탈퇴 (`/api/` 호출) |
  | `auth/login-form` + `lib/remember-email` | 아이디(이메일) 기억하기 (localStorage, 로그인 성공 때만 저장·삭제, 탈퇴하면 삭제) |
  | `theme-toggle` + `lib/theme` | 테마 바꾸기 (헤더 버튼·휴대폰 메뉴·바닥글). 처음 값은 `<head>` 인라인 스크립트(`lib/theme-script.ts`)가 그리기 전에 붙인다 |

- **함정 두 가지** (실제로 겪었다)
  1. `useSearchParams()` 를 정적 내보내기에서 쓰면 빌드된 HTML 에 목록 대신 Suspense 대체 화면이 들어간다. 그래서 `useSyncExternalStore` 로 `location.search` 를 직접 읽는다 (`lib/use-location-search.ts`).
  2. `"use client"` 파일에서 내보낸 **값**(배열 등)은 서버 컴포넌트에서 실제 값이 아니라 참조로 보인다. 양쪽에서 쓰는 값은 `lib/` 에 둔다 (`lib/nav.ts`).
- 브라우저 저장소는 `try/catch` 로 감싸고, 서버 스냅샷(빈 목록)과 다를 때를 `useSyncExternalStore` 로 처리한다 (하이드레이션 불일치 없음).

- **로그인 상태는 HTML 에 없다.** 세션 쿠키는 httpOnly 라서 스크립트가 읽지 못한다. `lib/auth.ts` 의 `useSession()` 이 처음 구독될 때 `GET /api/auth/me` 를 한 번 부르고,
  모든 컴포넌트가 그 결과를 함께 본다 (`useSyncExternalStore`).
- 클라이언트 컴포넌트는 `lib/schema.ts` 를 가져오지 않는다 (zod 가 번들에 들어가고, zod 의 `eval` 시험이 CSP 위반으로 기록된다). 값이 필요하면 `lib/asset-types.ts` 처럼 zod 없는 파일에 둔다.

## 4. 회원 (가입은 이메일 인증, 로그인은 이메일 + 비밀번호: ADR-0007, ADR-0008)

```
가입      /signup/ ── POST /api/auth/request {email, purpose:signup} ──▶ 링크 토큰(256비트) 해시 저장, 15분 ──▶ 메일
          메일: <사이트>/login/verify/#t=<토큰>  (가입 여부와 상관없이 같은 응답)
          /login/verify/ ── [계속하기] ── POST /api/auth/verify ──▶ 토큰 1회 사용 ──▶ 처음이면 계정 생성 ──▶ 세션(method=link)
                         ── 같은 화면에서 POST /api/account/password {password} ──▶ scrypt 해시 저장 = 가입 완료
로그인    /login/ ── POST /api/auth/login {email, password} ──▶ 세션(method=password)
재설정    /login/reset/ ── purpose:reset 링크 ──▶ /login/verify/ ──▶ 새 비밀번호 (현재 비밀번호 없이: 링크 세션 15분 안, 한 번)
계정      GET /api/auth/me · POST /api/account/password {password, current_password} · POST /api/auth/logout(-all) · DELETE /api/account
세션      쿠키 __Host-johnnystudio_session (httpOnly, Secure, SameSite=Lax, 30일), DB 에는 해시만
```

| 테이블 | 열 | 비고 |
|---|---|---|
| `users` | id, email(유일), password_hash, password_changed_at, created_at, last_login_at | 이메일과 비밀번호 해시 말고는 받지 않는다 |
| `login_tokens` | token_hash, email, ip_hash, next_path, purpose, created_at, expires_at, used_at | 만료 하루 뒤 삭제. 요청 횟수 제한에도 쓴다 |
| `sessions` | token_hash, user_id, method(link·password), created_at, expires_at, last_seen_at | 만료되면 삭제. 비밀번호를 바꾸면 다른 세션 삭제 |
| `login_failures` | email, ip_hash, created_at | 비밀번호 실패. 하루 뒤 삭제 |

- 비밀번호: `hashlib.scrypt` N=2^17·r=8·p=1 (`api/app/passwords.py`), 10~128자, 흔한 것·이메일과 비슷한 것 거부
- 요청 제한: 메일 링크는 같은 이메일 15분 3회·같은 IP 1시간 10회, 비밀번호 실패는 같은 이메일 15분 5회·같은 IP 1시간 20회 (앱), IP 당 분당 30회 (nginx)
- 없는 이메일·틀린 비밀번호·비밀번호 없는 계정은 같은 응답이고, 해시 계산 시간도 같게 쓴다 (가입 여부를 드러내지 않는다)
- 스키마: 운영 DB 설치 전이라 그대로 고친다. 개발 SQLite 는 스키마가 다르면 다시 만들고, 운영 DB 는 시작을 멈춘다 (설치 뒤부터 Alembic)
- 개발: `./scripts/dev.sh` 가 API(127.0.0.1:3001, SQLite `api/data/dev.sqlite3`)도 띄운다. 메일은 터미널에 찍힌다(`api/.env.local` 에 SMTP 를 적으면 진짜로 보낸다). Next 개발 서버의 rewrites 가 `/api/` 를 넘긴다.
  - 접속 주소는 세 곳이 알아야 한다: Next 의 `allowedDevOrigins`(모르면 HMR 을 막아 **화면이 하이드레이션되지 않는다**), API 의 허용 출처(CSRF), 메일 링크 주소. `dev.sh` 가 `HOST`·`PUBLIC_URL` 로 셋을 함께 맞춘다.
  - Next 개발 프록시는 방문자가 보낸 `X-Real-IP` 를 그대로 넘기므로 개발 API 는 그 헤더를 믿지 않는다 (`JOHNNYSTUDIO_TRUST_PROXY_IP=0`).
- 설정: 환경 변수 `JOHNNYSTUDIO_*` (`api/app/config.py`). 운영 값은 `/opt/johnnystudio/api.env` (예시 `deploy/api.env.example`)

## 5. 콘텐츠 파이프라인

```
content/assets/*.md ──▶ 머리말 분리 ──▶ YAML 파싱 ──▶ zod 스키마(유형별, 모르는 필드 거부) ──▶ Markdown → HTML
                                                     │ 실패: 파일명·필드와 함께 빌드 중단
초안(draft) 처리: 개발 = 포함, 출시 빌드 = 제외 (SHOW_DRAFTS=1 이면 포함, 배포는 거부)
완성도(missingFields): 초안이 아니면 날짜·유형별 필수값·실제 체크섬·TODO( 없음 → 테스트가 확인
```

## 6. 보안

| 항목 | 내용 |
|---|---|
| CSP (헤더) | `default-src 'self'`, `script-src 'self' 'unsafe-inline'`, `style-src 'self'`, `img-src 'self' data: https://i.ytimg.com`, `connect-src 'self'`, `frame-src https://www.youtube-nocookie.com`, `frame-ancestors 'none'` |
| CSP (페이지 `<meta>`) | `script-src 'self' 'sha256-…'`: 그 페이지의 인라인 스크립트 해시만 허용한다 (테마 스크립트 포함). 헤더와 함께 적용되므로 실제로는 `'unsafe-inline'` 이 없는 것과 같다 (ADR-0007) |
| 회원 | 비밀번호는 scrypt 해시, 세션·링크 토큰은 SHA-256 해시만 저장, 쿠키 `__Host-…; HttpOnly; Secure; SameSite=Lax`, 상태를 바꾸는 요청은 `Origin` 검사 + JSON 만, IP 는 HMAC 만 하루 보관, 비밀번호 실패 횟수 제한 |
| 그 밖의 헤더 | `X-Content-Type-Options`, `X-Frame-Options DENY`, `Referrer-Policy`, `Permissions-Policy` |
| 외부 링크 | 모두 `target="_blank" rel="noopener noreferrer"` |
| 웹 패키지 | 별도 출처(샌드박스 도메인)의 iframe, `sandbox` 에 `allow-same-origin` 없음 (Phase 1.5) |
| 숨김 파일 | `/.` 로 시작하는 경로는 404 (`.release` 등). `/.well-known/` 만 예외 |
| 추적 | 추적 쿠키·분석 스크립트 없음. 쿠키는 로그인 세션 하나뿐. Next.js 사용 통계 전송 끔 |

## 7. 캐시 (nginx)

| 대상 | 캐시 | 이유 |
|---|---|---|
| HTML, RSC 데이터(`.txt`) | `no-cache` (매번 재검증) | 배포가 바로 보이게 |
| `/_next/static/` | 최대 (10년) | 파일명에 해시가 있다 |
| 이미지·폰트 | 30일 | 바꿀 때는 파일명을 바꾼다 |
| `/files/` | 7일 | 버전마다 파일명이 다르다 |
| `/api/` | `no-store` (API 가 붙인다) | 로그인 상태는 캐시하지 않는다 |

## 8. 검사

| 도구 | 범위 |
|---|---|
| `tsc` | 타입 (strict, `noUncheckedIndexedAccess`) |
| `eslint` | Next.js core-web-vitals + TypeScript 규칙 (React Hooks 규칙 포함) |
| `vitest` | 콘텐츠 형식·완성도·이미지 존재, 검색·필터, 형식 변환, 즐겨찾기 저장 형식, 회원 클라이언트(토큰·next·오류), CSP 해시 주입 |
| `pytest` (api/) | 가입·링크 재사용·만료, 비밀번호 설정·로그인·재설정·변경(현재 비밀번호, 다른 세션 끊기), 실패 횟수 제한, 해시 저장·재해시, 요청 제한, Origin·JSON 검사, 쿠키 속성, 설정 검사, 개발 DB 스키마 |
| `next build` | 출시 빌드 (초안 제외) + `inject-csp.mjs` |
| `check_site.py --built` | 빌드 결과: 내부 링크·앵커, `lang`·`title`·`description`·`viewport`, `alt`, 인라인 스타일·이벤트, 외부 리소스, **CSP `<meta>` 와 인라인 스크립트 해시 일치·순서** |
| 셸·줄바꿈 | `bash -n`, CRLF 금지 |

`./scripts/check.sh` 가 위를 순서대로 돌리고, `deploy.sh` 는 이것이 통과해야 배포한다.

> 브라우저 상호작용 검사는 임시 Playwright 스크립트로 확인했고, 아직 저장소에 넣지 않았다 (ROADMAP 의 할 일).
> - 2026-11-05: 즐겨찾기, 필터, 사진 확대, 영상, 모바일 메뉴, CSP 아래 동작
> - 2026-11-05: 회원 가입·로그인·로그아웃·탈퇴 37개 항목 (출시 빌드 + CSP 헤더 + API)

## 9. 이후 구조 (ADR-0007 기준)

```
방문자 → Cloudflare → cloudflared → nginx ─┬─ /           → 정적 파일 (해시 CSP)
                                          ├─ /api/       → FastAPI (인증 단일 권위 ✅, 즐겨찾기 동기화, Client Room)
                                          └─ /files/     → 정적 파일
                                FastAPI ──┬─ PostgreSQL (회원 ✅, 즐겨찾기, 룸·이슈·댓글)
                                          ├─ MinIO       (Phase 3: 의뢰인 결과물, 만료 링크)
                                          └─ Arkurator RAG 백엔드 (Phase 4: JohnnyBot)
```

서버에서 로그인 상태로 렌더링해야 하는 화면이 생기면 Next.js 서버 모드를, 서비스가 셋 이상이 되면 Docker Compose 를 다시 검토한다 (ADR-0007 재검토 조건).
