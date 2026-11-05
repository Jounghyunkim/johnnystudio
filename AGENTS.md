# AGENTS.md — JohnnyStudio AI 작업 가이드

> 이 저장소에서 일하는 **모든 AI 코딩 도구**(Claude Code, Codex, Gemini, Cursor 등)의 공통 규칙이다.
> Claude Code 는 `CLAUDE.md` 가 이 파일을 불러온다. 규칙을 바꿀 때는 **이 파일만** 고친다. ([ADR-0003](docs/04_architecture/adr/0003-ai-collaboration-docs.md))
>
> **Last Updated**: 2026-11-05

## 1. 프로젝트 요약

JohnnyStudio 의 **포털(허브) 웹사이트**. 스튜디오의 철학을 소개하고, 스튜디오가 만드는 프로젝트(첫 번째: [Arkurator](https://arkurator.net))로 이어 주는 관문이다.

- **현재 단계**: Phase 0(개발 준비) 완료 → Phase 1(철학·비전 정의) 대기. 진행 상황은 [docs/ROADMAP.md](docs/ROADMAP.md).
- **철학과 콘텐츠는 아직 정해지지 않았다.** [docs/01_vision/PHILOSOPHY.md](docs/01_vision/PHILOSOPHY.md) 가 확정되기 전에는
  소개 문구·슬로건·브랜드 요소를 지어내지 않는다. 자리표시와 `TODO(vision)` 주석을 그대로 둔다.
- 사용자가 쓴 상위 기획안은 [docs/ideation.md](docs/ideation.md) 에 있다. Phase 1 의 입력 자료이고 확정된 결정이 아니다.
  기획안이 ADR 과 다르면 ADR 이 우선한다. 기획안대로 바꾸려면 새 ADR 을 쓴다.

## 2. 작업 시작 전에 읽을 것 (순서대로)

1. [docs/ROADMAP.md](docs/ROADMAP.md): 지금 어느 단계인지, 다음에 할 일이 무엇인지
2. `dev_history/` 에서 가장 최근 파일 1~2개: 직전 세션에서 한 일과 남은 일
3. 작업과 관련된 문서: [docs/README.md](docs/README.md) 의 목록에서 찾는다

## 3. 디렉터리 지도

| 경로 | 용도 |
|---|---|
| `src/` | **웹 루트.** 이 폴더가 그대로 서버에 배포된다 |
| `docs/` | 기획·설계 문서. "지금 어떻게 되어 있나"를 쓴다 (항상 최신으로 고쳐 쓴다) |
| `docs/04_architecture/adr/` | 결정 기록(ADR). "왜 이렇게 정했나"를 쓴다 |
| `dev_history/` | 세션별 작업 로그. "언제 무엇을 했나"를 쓴다 (쓰고 나면 고치지 않는다) |
| `deploy/` | 배포 스크립트, nginx 설정 템플릿, 배포 가이드 |
| `scripts/` | 로컬 개발 도구 (미리보기 서버, 검사) |
| `.claude/commands/` | Claude Code 슬래시 명령 (`/worklog`, `/adr`) |

## 4. 명령어

```bash
./scripts/dev.sh        # 로컬 미리보기 → http://127.0.0.1:8080
./scripts/check.sh      # 커밋·배포 전 검사 (HTML·링크·CSP 위반·JSON·셸 문법·CRLF)
./deploy/deploy.sh      # 배포: 사용자가 요청했을 때만 실행
./deploy/rollback.sh    # 직전 릴리스로 되돌리기: 사용자가 요청했을 때만 실행
```

## 5. 기술 규칙

- **빌드 없는 정적 사이트**: HTML + CSS + 바닐라 JS(ES 모듈). npm·번들러·프레임워크를 들이려면 먼저 ADR 을 쓴다.
  ([ADR-0001](docs/04_architecture/adr/0001-static-html-stack.md) 의 재검토 조건 참고)
- **콘텐츠는 HTML 에 직접 쓴다.** JS 로 콘텐츠를 그리지 않는다 (검색엔진 색인, JS 꺼진 환경). JS 는 보조 기능에만 쓴다.
- **외부 CDN·트래커 금지**: 폰트·스크립트·이미지는 `src/assets/` 에 둔다. 예외가 필요하면 ADR 을 쓴다.
- **인라인 금지**: `<script>`·`<style>` 블록, `style=""`·`onclick=""` 속성을 쓰지 않는다. 운영 nginx 의 CSP 가 막는다.
- **CSS 값은 토큰으로**: 색·간격·글꼴·글자 크기는 `src/assets/css/tokens.css` 의 CSS 변수만 쓴다.
  파일 역할은 `tokens` → `base` → `layout` → `components` 순서다.
- **경로**: 루트 기준 절대경로(`/assets/...`). 새 페이지는 `src/<이름>/index.html` → 주소 `/<이름>/`.
- **HTML**: 시맨틱 태그, `lang="ko"`, 페이지마다 `<title>`·`<meta name="description">`·`<meta name="viewport">`.
- **접근성**: 모든 `<img>` 에 `alt`, 키보드만으로 모든 기능 사용 가능, 색 대비는 WCAG AA 기준.
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
  - 예: `feat(hub): 프로젝트 카드에 상태 배지 추가 — 운영 중/개발 중 구분`
- 커밋 전에 `./scripts/check.sh` 를 통과시킨다.
- 커밋과 푸시는 사용자가 요청할 때만 한다.

## 8. 서버 주의사항 (중요)

- 이 저장소는 **홈 서버 GMKtec M8** (`jounghyun-kim-M8`, Ubuntu 26.04, 유선 `192.168.0.206`) 위에 있다.
  같은 nginx 가 **Arkurator 백엔드**(`johnnyhouse.iptime.org`, 80/443 → `127.0.0.1:8000`)를 운영 중이다.
- 기존 `/etc/nginx/sites-*/arkurator-backend`, `/etc/nginx/snippets/arkurator-*`, `/opt/arkurator/`, `127.0.0.1:8000` 은 **절대 건드리지 않는다.**
- `sudo` 가 필요한 작업(nginx 사이트 추가·reload, `/opt` 디렉터리 생성, certbot)은 직접 실행하지 않는다.
  명령을 정리해서 사용자가 자기 터미널에서 실행하도록 안내한다.
- 비밀값(`.env`, 개인키, 인증서)은 커밋하지 않는다.
