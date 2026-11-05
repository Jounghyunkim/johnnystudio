# 2026-11-05: 개발 폴더 구조와 포털 개발 준비

> **작업자**: 사용자 + Claude Code (Claude Opus 5.5)
> **관련**: [ADR-0001](../docs/04_architecture/adr/0001-static-html-stack.md), [ADR-0002](../docs/04_architecture/adr/0002-deploy-home-server-nginx.md), [ADR-0003](../docs/04_architecture/adr/0003-ai-collaboration-docs.md), 첫 커밋

## 목표

빈 `JohnnyStudio/` 폴더를 AI 도구로 개발하기 좋은 구조로 만들고, JohnnyStudio 포털(허브)을 개발 준비 단계까지 진행한다.
철학과 콘텐츠는 다음 단계에서 정한다.

## 한 일

- **사전 조사**
  - 이 기기가 홈 서버 **M8** (`jounghyun-kim-M8`) 임을 확인했다.
  - nginx 가 Arkurator 백엔드(`johnnyhouse.iptime.org`, 80/443 → 127.0.0.1:8000)를 운영 중임을 확인했다.
  - Node.js 는 없고 Python 3.14 와 git 2.53 은 있다. 비대화형 sudo 는 쓸 수 없다.
- **사용자 결정**: 정적 HTML/CSS/JS, 홈 서버 M8 nginx 배포, git init 과 첫 커밋
- **폴더 구조**: `docs/`(01_vision · 02_planning · 03_design · 04_architecture/adr · templates), `dev_history/`, `deploy/`, `scripts/`, `src/`
- **AI 작업 가이드**: `AGENTS.md`(공통 규칙 단일 원본), `CLAUDE.md`(`@AGENTS.md` import), `.claude/commands/` 의 `/worklog`·`/adr`
- **문서**: ROADMAP(Phase 0~5), PHILOSOPHY(다음 단계용 질문지), SITEMAP 초안, DESIGN_SYSTEM(임시 토큰), ARCHITECTURE, ADR 3건, 템플릿 3종
- **포털 뼈대**: `src/index.html`(헤더 · 히어로 · Projects 카드 · About · 푸터, 자리표시 문구는 `TODO(vision)`), `404.html`, `robots.txt`(출시 전 색인 차단), CSS 토큰 체계, `main.js`, 임시 파비콘
- **개발 도구**: `scripts/dev.sh`(python http.server), `scripts/check.sh` + `scripts/check_site.py`
- **배포 준비**: `deploy/deploy.sh`(릴리스 폴더 + current 링크), `deploy/rollback.sh`, `deploy/nginx/johnnystudio.conf`(보안 헤더 · CSP · 캐시), `deploy/README.md`

## 결정 (→ ADR)

- ADR-0001: 빌드 없는 정적 사이트로 시작한다. 콘텐츠는 HTML 에 직접 쓰고, 외부 CDN 과 인라인 스크립트·스타일은 쓰지 않는다.
- ADR-0002: M8 nginx 에 새 사이트를 추가하고 `/opt/johnnystudio/releases` + `current` 링크로 배포한다. 도메인은 미결정이다.
- ADR-0003: AGENTS.md · docs · dev_history · ADR 로 역할을 나눈다.

## 확인 (어떻게 검증했나)

- `./scripts/check.sh` 통과 (HTML 2 · CSS 5).
- 일부러 망가뜨린 사본(scratchpad)에서 문제 17건을 모두 잡았다.
  lang · title · meta 누락, style · 인라인 script · onclick, alt 누락, 외부 CSS, 없는 앵커 · 파일, 웹 루트 밖 경로, CSS 의 없는 @import · 외부 url, JSON 문법.
  허용해야 할 canonical · 외부 `<a>` · JSON-LD 는 통과시켰다.
- `scripts/dev.sh` 로 페이지와 에셋 전부 200, 없는 주소는 404 를 확인했다.
- `deploy.sh`·`rollback.sh` 를 scratchpad 배포 위치(`JOHNNYSTUDIO_DEPLOY_BASE`)로 시험했다.
  - releases 가 없으면 안내 후 중단한다. 오래된 릴리스는 5개만 남기고 정리한다. 파일 권한은 644/755 다.
  - `--list`, 이전 릴리스로 롤백, 지정 릴리스로 롤백, 잘못된 이름 거부, "이미 현재", "앞선 릴리스 없음"을 모두 확인했다.
- nginx 템플릿: scratch 설정으로 `nginx -t` 통과. 사용자 권한으로 테스트 포트(18081)에 띄워 확인했다.
  - 모든 응답에 보안 헤더와 CSP 가 붙는다. HTML 은 `no-cache`, CSS 는 1시간, 이미지는 30일 캐시다.
  - 없는 주소는 404.html 을 보여 준다. `.release`·`.git/` 은 404, `/.well-known/acme-challenge/` 는 통과(200), gzip 이 동작한다.
- 헤드리스 Chromium 스크린샷으로 데스크톱(1280) · 모바일(390, 가로 스크롤 없음) · 다크 모드 렌더링을 확인했다.
- **미검증**: 실제 운영 nginx 적용, 도메인·DNS·certbot (서버 설정 전이라 하지 않았다).

## 남은 일 · 다음 세션

- [ ] **Phase 1**: `docs/01_vision/PHILOSOPHY.md` 의 질문에 답하며 철학·비전을 정의한다
- [ ] 도메인 결정 (ADR-0002 미결정 항목)
- [ ] GitHub 원격 저장소 연결 여부 결정

## 메모

- 작업 도중 사용자가 `docs/ideation.md`(통합 허브 상위 기획안)를 추가했다. 파일 내용은 고치지 않았다.
  docs 목록, ROADMAP Phase 1, AGENTS.md §1 에 입력 자료로 연결했다.
  ADR-0001/0002 와 다른 점(스택, Cloudflare Tunnel, 다크 기본)은 ROADMAP Phase 1 에 정리 항목으로 올렸다.
  Cloudflare Tunnel 은 ADR-0002 미결정 항목에 선택지로 추가했다.
- git 사용자 정보는 Arkurator 저장소와 같은 값(`gadians2001`)으로 **이 저장소에만** 설정했다. 다르게 쓰려면 `git config user.name/user.email` 로 바꾼다.
- 운영 nginx 는 Arkurator 와 같이 쓰므로, 서버 설정 단계에서는 반드시 `nginx -t` 를 통과한 뒤에 reload 한다.
