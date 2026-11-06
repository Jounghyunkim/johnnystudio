# AGENTS.md — JohnnyStudio AI 작업 가이드

> 이 저장소에서 일하는 **모든 AI 코딩 도구**(Claude Code, Codex, Gemini, Cursor 등)의 공통 규칙이다.
> Claude Code 는 `CLAUDE.md` 가 이 파일을 불러온다. 규칙을 바꿀 때는 **이 파일만** 고친다. ([ADR-0003](docs/04_architecture/adr/0003-ai-collaboration-docs.md))
>
> **Last Updated**: 2026-11-06

## 1. 프로젝트 요약

JohnnyStudio 의 **포털(허브) 웹사이트**다. 정현 님이 만든 모든 것(소프트웨어·영상·사진·글·하드웨어)을 한곳에 모아 보여 주고,
바로 써 보게 하고, 함께 일하는 셀프 호스팅 스튜디오의 관문이다.

- **현재 단계**: Phase 1(공개 허브) 구현 완료. Phase 2 의 회원 가입·로그인(매직 링크, `api/`)을 구현했고 서버 설치·메일 설정이 남았다.
  남은 일은 실제 콘텐츠 채우기와 도메인·Tunnel 공개다. 진행 상황은 [docs/ROADMAP.md](docs/ROADMAP.md).
- **기획의 기준**: [docs/ideation.md](docs/ideation.md) v2 (네 구역·원칙·리스크·단계 계획)와 [docs/01_vision/PHILOSOPHY.md](docs/01_vision/PHILOSOPHY.md) 초안 v1.
  둘 다 사용자 확인 전이다. 기획안이 ADR 과 다르면 ADR 이 우선한다. 바꾸려면 새 ADR 을 쓴다.
- **콘텐츠를 지어내지 않는다.** 작품 정보·서비스·연락처·운영자 소개는 사용자가 준 사실만 쓴다. 모르는 곳은 `draft: true` 와 `TODO(content)` 로 남긴다.

## 2. 작업 시작 전에 읽을 것 (순서대로)

1. [docs/ROADMAP.md](docs/ROADMAP.md): 지금 어느 단계인지, 다음에 할 일이 무엇인지
2. `dev_history/` 에서 가장 최근 파일 1~2개: 직전 세션에서 한 일과 남은 일
3. 작업과 관련된 문서: [docs/README.md](docs/README.md) 의 목록에서 찾는다

## 3. 디렉터리 지도

| 경로 | 용도 |
|---|---|
| `web/` | **Next.js 앱.** `src/app` 페이지, `src/components` 화면 조각(`viewers/` 유형별 뷰어, `auth/` 로그인·계정), `src/lib` 스키마·콘텐츠 읽기·로직, `scripts/inject-csp.mjs`, `public/` 이미지 |
| `api/` | **회원 API (FastAPI, Python 3.14, uv).** `app/` 엔드포인트·DB·메일·설정, `tests/` pytest. 구조: [ADR-0007](docs/04_architecture/adr/0007-magic-link-auth-api.md) |
| `content/` | **콘텐츠 원본.** `assets/<slug>.md`(작품), `lifelog.yaml`, `profile.yaml`, `pages/<slug>.md`(개인정보처리방침 등). 형식: `web/src/lib/schema.ts` |
| `docs/` | 기획·설계 문서. "지금 어떻게 되어 있나"를 쓴다 (항상 최신으로 고쳐 쓴다) |
| `docs/04_architecture/adr/` | 결정 기록(ADR). "왜 이렇게 정했나"를 쓴다 |
| `dev_history/` | 세션별 작업 로그. "언제 무엇을 했나"를 쓴다 (쓰고 나면 고치지 않는다) |
| `deploy/` | 배포·롤백 스크립트, nginx·cloudflared·systemd 설정 템플릿, `api.env.example`, 배포 가이드 |
| `scripts/` | 개발 도구 (미리보기, 검사, 파일 메타) |
| `.claude/commands/` | Claude Code 슬래시 명령 (`/worklog`, `/adr`) |

## 4. 명령어

Node.js 는 `~/.local/bin/node` (v26 LTS) 다. 의존성은 `npm --prefix web ci` 로 설치한다.
Python 은 시스템 3.14, 패키지 관리는 `uv` 다. API 의존성은 `uv sync --frozen --directory api` (스크립트가 알아서 한다).

```bash
./scripts/dev.sh        # 개발 미리보기 (초안 포함) → http://localhost:3000, 회원 API 127.0.0.1:3001 (로그인 메일은 터미널에)
                        # 다른 기기에서: HOST=0.0.0.0 / 인터넷에서(잠깐만): PUBLIC_URL=http://주소:3000 (주소 처리는 dev.sh 머리말)
./scripts/preview.sh    # 출시 빌드 미리보기 (초안 제외, CSP 헤더 + /api/) → http://127.0.0.1:8080
./scripts/check.sh      # 커밋·배포 전 검사: 타입 → 린트 → 테스트 → API 테스트 → 출시 빌드 → 빌드 결과(CSP 해시) → 셸 → CRLF
(cd api && uv run pytest)   # API 테스트만
./scripts/file-meta.sh <파일> <slug>   # 다운로드 파일의 size·sha256 YAML
./deploy/deploy.sh      # 배포: 사용자가 요청했을 때만 실행
./deploy/rollback.sh    # 되돌리기: 사용자가 요청했을 때만 실행
```

## 5. 기술 규칙

### 스택 ([ADR-0004](docs/04_architecture/adr/0004-nextjs-static-export.md))

- Next.js 16 App Router + TypeScript(strict) + Tailwind CSS 4. **웹은 정적 내보내기**(`output: "export"`)다.
  서버가 필요한 기능(API 라우트, 미들웨어, ISR, `next/image` 최적화, `cookies()`·`headers()`)은 쓰지 않는다.
- 서버가 필요한 일(회원·인증)은 **`api/` 의 FastAPI 만** 맡는다 (인증 단일 권위). 웹은 같은 출처의 `/api/` 를 `fetch` 로 부른다 ([ADR-0007](docs/04_architecture/adr/0007-magic-link-auth-api.md)).
- Python 의존성도 정확한 버전으로 고정한다. `api/pyproject.toml` 의 `exclude-newer` 가 "2주 이상" 규칙을 지킨다.
- 새 의존성은 꼭 필요할 때만 들인다. **정확한 버전으로 고정**하고, **나온 지 2주 이상 된 버전 중 최신**을 고른다. 추가한 이유는 dev_history 에 쓴다.
- Next.js 사용 통계는 끈다 (`NEXT_TELEMETRY_DISABLED=1`, 스크립트에 이미 들어 있다).

### 렌더링

- **서버 컴포넌트가 기본**이다. `"use client"` 는 상호작용(검색·필터, 즐겨찾기, 영상, 사진 확대, 복사, 메뉴)에만 쓴다.
- **콘텐츠는 빌드된 HTML 에 들어 있어야 한다.** 클라이언트에서 콘텐츠를 불러오지 않는다. 정적 내보내기에서 `useSearchParams` 를 쓰지 않는다
  (`lib/use-location-search.ts` 를 쓴다).
- `"use client"` 파일에서 **값**(배열·객체)을 내보내 서버 컴포넌트에서 쓰지 않는다. 공유할 값은 `src/lib/` 에 둔다.
- `src/lib/content.ts` 는 서버 전용(fs)이다. 클라이언트 컴포넌트에는 `AssetSummary` 같은 가벼운 타입만 넘긴다.
- 클라이언트 컴포넌트는 `src/lib/schema.ts` 에서 **값**을 가져오지 않는다 (zod 가 번들에 들어가고 CSP 위반이 기록된다). 필요한 상수는 `lib/asset-types.ts` 처럼 zod 없는 파일에 둔다.
- 로그인 상태는 `lib/auth.ts` 의 `useSession()` 으로만 읽는다. 빌드된 HTML 에는 로그인 상태가 없다.
- 브라우저 저장소(localStorage)는 `try/catch` 로 감싸고 `useSyncExternalStore` 로 읽는다. `useEffect` 안에서 `setState` 하지 않는다 (React Hooks 린트 규칙).

### 콘텐츠 ([ADR-0005](docs/04_architecture/adr/0005-file-based-content.md), [CONTENT_GUIDE](docs/02_planning/CONTENT_GUIDE.md))

- 콘텐츠를 컴포넌트 안에 하드코딩하지 않는다. 작품은 `content/assets/`, 문구는 `content/profile.yaml` 에 둔다.
- 스키마를 바꾸면 `schema.ts` → `missingFields()` → CONTENT_GUIDE → 테스트를 함께 고친다.
- 큰 파일(exe·zip)은 git 에 넣지 않는다. `/opt/johnnystudio/files/<slug>/` 에 두고 `/files/…` 로 가리킨다.
- 출시 전에 채워야 할 곳에는 `TODO(content)` · `TODO(design)` · `TODO(launch)` 를 남긴다.

### 스타일

- 색·글꼴은 `web/src/app/globals.css` 의 `@theme` 토큰만 쓴다 (`bg-canvas`, `text-fg-muted`, `border-line`, `text-accent` …). 컴포넌트에 `#hex` 를 쓰지 않는다.
  유형별 색 포인트는 `src/lib/type-style.ts` 에만 둔다.
- 테마는 어두운 테마(기본)와 밝은 테마 두 가지다. 토큰은 두 테마 값을 다 갖고 있다. 토큰을 안 거치는 색(Tailwind 팔레트, `shadow-black/…`)을 쓰면
  반드시 `light:` 짝을 단다 (예: `text-emerald-300 light:text-emerald-700`). 흰색 그림은 `light:invert`. 두 테마 모두 대비 AA 를 지킨다 ([DESIGN_SYSTEM](docs/03_design/DESIGN_SYSTEM.md)).
- **인라인 스타일(`style=`)과 `<style>` 블록을 쓰지 않는다.** CSP 가 `style-src 'self'` 다. `scripts/check_site.py` 가 검사한다.
- 오류 문구·되돌릴 수 없는 동작에만 `danger` 토큰을 쓴다.
- 화면 문구는 한국어로 쓰고, 영어 단어 뒤 조사는 붙여 쓴다 ("JohnnyStudio의"). 문서는 기존 관례(띄어 씀)를 따른다.

### 보안·외부 리소스

- 외부 CDN·트래커·외부 이미지 금지. 예외는 CSP 에 허용한 YouTube 썸네일(`i.ytimg.com`)과 재생(`youtube-nocookie.com`)뿐이다.
  새 외부 출처가 필요하면 ADR 을 쓰고 `deploy/nginx/johnnystudio.conf` 의 CSP 와 `check_site.py` 허용 목록을 함께 고친다.
- 외부 링크는 `target="_blank" rel="noopener noreferrer"` 로 연다 (`ExternalButton`).
- 인라인 `<script>` 는 빌드 뒤 `inject-csp.mjs` 가 넣은 페이지별 해시 CSP `<meta>` 로만 허용된다. 빌드 결과를 손으로 고치지 않는다 (`check_site.py` 가 해시를 맞춰 본다).
- 회원 API: 비밀번호는 scrypt 해시(`api/app/passwords.py`), 토큰·세션은 SHA-256 해시만 저장하고, 로그에 이메일·토큰·비밀번호를 남기지 않는다.
  로그인 실패 응답은 "없는 계정"과 "틀린 비밀번호"를 구분하지 않는다 ([ADR-0008](docs/04_architecture/adr/0008-password-login.md)). 상태를 바꾸는 엔드포인트는 Origin 검사(미들웨어)를 거친다. 새 개인정보를 받게 되면 `content/pages/privacy.md` 를 함께 고친다.
- 웹 패키지 iframe 의 `sandbox` 에 `allow-same-origin` 을 넣지 않는다.

### 접근성

- 모든 이미지에 `alt`, 아이콘에는 `aria-hidden`, 아이콘만 있는 버튼에는 `sr-only` 이름을 단다.
- 키보드만으로 모든 기능을 쓸 수 있어야 한다. 대화상자는 `<dialog>` 를 쓴다. 색 대비는 WCAG AA 기준이다.

### 형식

- 줄바꿈은 LF, 들여쓰기는 2칸 (Python 4칸). `.editorconfig` 를 따른다.

## 6. 문서화 규칙

- 문서는 한국어로 쓴다. 파일 상단에 `> **Last Updated**: YYYY-MM-DD` 를 단다. 확인하지 않은 값에는 `[확인 필요]` 를 붙인다.
- **기술·구조 결정**은 `docs/04_architecture/adr/NNNN-<slug>.md` 로 남긴다. 결정을 뒤집을 때는 기존 ADR 을 고치지 않고 새 ADR 로 대체한다.
- **세션이 끝날 때** `dev_history/YYYY-MM-DD_<slug>.md` 를 쓴다 (형식: `docs/templates/WORKLOG_TEMPLATE.md`).
  실행해서 확인한 것과 확인하지 못한 것을 구분해서 쓴다.
- 할 일을 끝내거나 단계가 바뀌면 [docs/ROADMAP.md](docs/ROADMAP.md) 의 체크박스와 "현재 위치"를 갱신한다.

## 7. Git

- 커밋 메시지: Conventional Commits 형식에 한국어 설명. `type(scope): 무엇을 — 왜`
  - type: `feat` `fix` `docs` `style` `refactor` `chore` `deploy`
  - 예: `feat(library): 유형 필터에 개수 표시 — 검색 결과를 한눈에`
- 커밋 전에 `./scripts/check.sh` 를 통과시킨다.
- 커밋과 푸시는 사용자가 요청할 때만 한다.

## 8. 서버 주의사항 (중요)

- 이 저장소는 **홈 서버 GMKtec M8** (`jounghyun-kim-M8`, Ubuntu 26.04, 유선 `192.168.0.206`) 위에 있다.
  같은 nginx 가 **Arkurator 백엔드**(`johnnyhouse.iptime.org`, 80/443 → `127.0.0.1:8000`)를 운영 중이다.
- JohnnyStudio 사이트는 **`127.0.0.1:8081`** 에서만 듣고, Cloudflare Tunnel 로 공개한다 ([ADR-0006](docs/04_architecture/adr/0006-cloudflare-tunnel.md)).
  배포 위치는 `/opt/johnnystudio/{releases,current,files,api.env}` 다.
- 회원 API 는 **`127.0.0.1:8082`** (systemd `johnnystudio-api`), DB 는 같은 PostgreSQL 의 **별도 역할·DB `johnnystudio`** 다.
  개발용 API 는 3001(dev.sh)·8090(preview.sh) 포트를 쓴다. Arkurator 의 DB·역할은 건드리지 않는다.
- 기존 `/etc/nginx/sites-*/arkurator-backend`, `/etc/nginx/snippets/arkurator-*`, `/opt/arkurator/`, `127.0.0.1:8000` 은 **절대 건드리지 않는다.**
- `sudo` 가 필요한 작업(nginx 사이트 추가·reload, `/opt` 디렉터리 생성, cloudflared 설치)은 직접 실행하지 않는다.
  명령을 정리해서 사용자가 자기 터미널에서 실행하도록 안내한다.
- 비밀값(`.env`, `api.env`, 개인키, 인증서, cloudflared 인증 파일)은 커밋하지 않는다.
