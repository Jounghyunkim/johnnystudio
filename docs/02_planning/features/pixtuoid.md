# 검토: pixtuoid 적용 방안

> **상태**: 검토 완료, 결정 전 (§5 미결정)
> **Last Updated**: 2026-11-23
> **대상**: [pixtuoid/pixtuoid](https://github.com/pixtuoid/pixtuoid) `main` `fa9dd7d` (2026-11-22), 최신 릴리스 v0.23.0 (2026-11-13)
> **바탕**: [ideation.md](../../ideation.md) v2, [ROADMAP.md](../../ROADMAP.md), [ADR-0004](../../04_architecture/adr/0004-nextjs-static-export.md) (정적 내보내기·CSP), AGENTS.md §5 (의존성 2주 규칙, 콘텐츠를 지어내지 않는다)

## 0. 요약

- pixtuoid 는 JohnnyStudio 에 **코드를 가져다 붙일 대상이 아니다.** 쓸모는 두 가지다.
  - 개발할 때 옆에 띄워 두는 **개발 도구** (§3 A)
  - JohnnyStudio 와 거의 같은 문제(정적 사이트, 해시 CSP, AI 와 함께 개발)를 먼저 푼 **참고 프로젝트** (§3 D)
- 사이트에 픽셀 사무실을 넣는 것(§3 B·C)은 기술적으로 되지만 지금은 하지 않는다. C(실시간 보기)는 Phase 4 자동 Life Log 와 함께 다시 본다.
- pixtuoid 는 정현 님 작품이 아니므로 **작품으로 등록하지 않는다.** 기여(PR)를 하면 그 일은 Life Log 에 남길 수 있다.

## 1. pixtuoid 는 무엇인가 (2026-11-23, 저장소를 읽어서 확인. 코드는 실행하지 않음)

| 항목 | 내용 |
|---|---|
| 하는 일 | Claude Code·Codex 등 에이전트 CLI 15종의 세션을 픽셀 사무실의 캐릭터로 보여 주는 터미널 화면(TUI). 일하면 타자, 확인이 필요하면 `?`, 끝나면 졸기 |
| 언어·구성 | Rust (ratatui). 크레이트: `pixtuoid`(TUI), `pixtuoid-hook`(훅), `pixtuoid-core`(상태), `pixtuoid-scene`(그리기), `pixtuoid-web`·`pixtuoid-web-music`(사이트용 WASM). 사이트는 Astro |
| 라이선스 | MIT. 내장 픽셀 글꼴 Fusion Pixel 은 OFL-1.1 |
| 활동 | v0.23.0 (2026-11-13), 별 578, 사실상 1인 관리, 거의 매일 커밋 |
| 동작 방식 | 훅(`pixtuoid-hook`)이 이벤트 한 줄을 이 기기 안의 소켓(소유자만, `0600`)으로 보낸다. 세션 기록(`~/.claude/projects` 등)은 읽기만 한다. 밖으로 나가는 연결은 없다 |
| 네트워크 | `pixtuoid serve` 만 LAN 에서 듣는다 (TLS 1.3, QR 페어링). 페어링한 기기에 상태·모델·사용량·저장소 이름(마지막 폴더 이름)만 보내고, 경로·프롬프트·도구 입력은 보내지 않는다 (`crates/pixtuoid-core/src/remote.rs`) |
| 웹용 WASM | `crates/pixtuoid-web`: pixtuoid.dev 의 데모 사무실. `publish = false` 인 사이트 내부용이라 바뀌지 않는다는 보장이 없다. 크기 원본 2,139,499B, gzip 593,222B (pixtuoid.dev 에서 받아 잼). 훅 한 줄을 넣어 그리는 `Office.send_hook()` 도 있다 |
| 설치 | 릴리스에 Linux 용 미리 빌드된 파일이 없다 (macOS·Windows 만). Linux 는 Homebrew 또는 `cargo install` (Rust 1.100, edition 2024). M8 에는 Rust·Homebrew 가 없다 |
| 한글 | 글꼴에 Galmuri 가 들어 있어 한글 이름도 그려진다 |

## 2. JohnnyStudio 와 닮은 점

- pixtuoid.dev 도 **정적 사이트 + 해시 기반 CSP(`'unsafe-inline'` 없음) + 자체 호스팅 글꼴**이다. WASM 을 위해 `script-src` 에 `'wasm-unsafe-eval'` 을 더했다 (`site/astro.config.mjs`).
- 에이전트용 문서(`AGENTS.md`, 크레이트별 `AGENTS.md`, `REVIEW.md`, `docs/HOW-WE-BUILD.md`)로 AI 와 함께 개발한다.
- 사이트 품질을 CI 에서 숫자로 막는다 (Lighthouse, Playwright, WASM 크기 상한).

## 3. 적용 방안

| | 방안 | 무엇을 하나 | 비용 | 위험 | 판단 |
|---|---|---|---|---|---|
| A | 개발 도구로 쓰기 | M8 에서 에이전트 세션을 터미널로 지켜본다. 저장소는 바뀌지 않는다 | 작음 | 작음 | 원하면 |
| B | 사이트 장식 (데모 사무실) | 홈·About 에 WASM 픽셀 사무실을 넣는다 | 중간 | 중간 | 보류 |
| C | 실시간 "지금 스튜디오" | M8 의 실제 에이전트 활동을 공개 페이지에 보여 준다 | 큼 | 큼 | Phase 4 에서 다시 검토 |
| D | 만드는 방식 참고 | CI·비밀값 검사·브라우저 테스트·Lighthouse 설정을 참고해 우리 스택에 맞게 새로 쓴다 | 작음~중간 | 작음 | **권장** |

### A. 개발 도구로 쓰기

- **설치**: rustup 을 홈 디렉터리에 설치하면 sudo 가 필요 없다. 그다음 `cargo install --locked pixtuoid pixtuoid-hook --version 0.22.0`.
  Linux 용 Homebrew 는 기본 위치(`/home/linuxbrew`)에 설치하려면 sudo 가 필요하다.
- **버전**: v0.23.0 은 2026-11-23 기준 나온 지 10일이다. 프로젝트의 "나온 지 2주 이상" 원칙을 그대로 따르면 v0.22.0 (2026-11-03) 을 쓰거나, 2026-11-27 이후에 v0.23.0 을 설치한다.
- **설정 변경**: 연결하면 Claude Code 의 플러그인 명령으로 pixtuoid 플러그인이 사용자 전역(`~/.claude`)에 설치된다. 저장소의 `.claude/` 는 바뀌지 않는다.
  훅은 실패해도 0 으로 끝나 에이전트를 멈추지 않는다.
- **M8 에서의 한계**: SSH 로 쓰므로 기본 화면(문자 블록)은 나온다. 자세한 단면 화면(cutaway)은 kitty·iTerm2·SIXEL 을 지원하는 터미널에서만 보인다.
  `pixtuoid floating`(데스크톱 창)은 헤드리스 서버라 의미가 없다. `serve` 는 LAN 에 기기 이름을 알리므로 쓰지 않는다.
- **효과**: 에이전트 여러 개를 동시에 돌릴 때 크다. 세션 하나로 작업하면 얻는 것이 적다.

### B. 사이트에 데모 사무실 (보류)

기술적으로는 된다. 그래도 지금은 하지 않는다.

- **콘텐츠 원칙**: 데모에 나오는 에이전트와 장면은 정현 님의 실제 작업이 아니다. "콘텐츠를 지어내지 않는다"와 부딪힌다.
- **보안 정책**: nginx 헤더(`deploy/nginx/johnnystudio.conf`)와 `web/scripts/inject-csp.mjs` 의 메타 CSP 양쪽에 `'wasm-unsafe-eval'` 을 더해야 한다 → ADR 필요.
- **용량**: gzip 593KB. 홈에 바로 넣을 수 없고, 눌러야 켜지는 방식이어야 한다.
- **유지 비용**: 빌드에 Rust, `wasm32-unknown-unknown`, 버전이 정확히 맞는 `wasm-bindgen-cli`, `wasm-opt` 가 필요하다.
  공개 API 가 아니어서 pixtuoid 를 올릴 때마다 JS 연결 코드(사이트의 `office-host.js`·`office-driver.js` 수준: 모듈 worker, OffscreenCanvas, 재시도)가 깨질 수 있다.
- **정체성**: 남의 작품의 외관이 스튜디오 대문에 선다. MIT·OFL 이라 쓰는 것은 허용되지만 출처 표기가 필요하다.

### C. 실시간 "지금 스튜디오" (Phase 4 에서 다시 검토)

"AI 와 함께 일하는 스튜디오"라는 점에서 이 사이트에 가장 어울리는 아이디어다. 지금 하기에는 부담이 크다.

- **원본을 그대로 보낼 수 없다**: 훅 원본에는 경로·프롬프트·도구 입력이 들어 있다.
- **새로 짜야 할 것이 많다**: `serve` 의 전송 형식(버전 고정, 허용 필드만)을 `api/` 가 루프백에서 기기로 페어링해 받고, 필드를 더 줄여 SSE 로 내보낼 수는 있다.
  하지만 웹용 WASM 은 그 형식을 읽지 못하므로(데모 스크립트와 훅 원본 한 줄만 받는다) Rust 로 WASM 을 직접 짜야 한다. SSE 를 위한 nginx 버퍼링 설정도 필요하다.
- **운영 정보 노출**: 운영자가 언제 일하는지, 비공개 저장소 이름이 무엇인지가 드러난다. 저장소 이름은 허용 목록이 필요하다.

### D. 만드는 방식 참고 (권장)

ROADMAP 에 남은 품질 항목과 그대로 맞물린다. 코드를 복사하지 않고 설정을 참고해 우리 스택(Next.js, FastAPI, `check.sh`)에 맞게 새로 쓴다.

| JohnnyStudio 의 남은 일 | 참고할 pixtuoid 파일 |
|---|---|
| CI 로 `check.sh` 실행 (지금 `.github/` 가 없다) | `.github/workflows/ci.yml`, `site.yml` |
| Lighthouse 점검 | `site/lighthouserc.mjs`: 접근성 0.9 이상, 색 대비는 모든 실행에서 1.0, 성능 지표를 숫자 기준으로 강제 |
| 브라우저 상호작용 테스트를 저장소에 넣기 | `site/playwright.config.ts`, `site/tests/e2e/` |
| (지금 없다) 비밀값을 실수로 커밋하지 않게 막기 | `.gitleaks.toml`: `api.env`·토큰을 다루는 저장소라 효과가 크다 |

새 의존성(Playwright, Lighthouse CI, gitleaks)은 정확한 버전으로 고정하고 2주 규칙을 따른다. GitHub Actions 는 저장소 공개 여부에 따라 사용 시간 한도가 다르다 `[확인 필요]`.

## 4. 권장 순서

1. **D**: CI(`check.sh`)와 gitleaks 를 먼저, Playwright·Lighthouse 는 품질 단계에서
2. **A**: 원하면 저장소 밖에서 설치한다
3. **B·C**: 보류. C 는 Phase 4 자동 Life Log 와 함께 다시 본다

## 5. 미결정

- pixtuoid 를 보고 원한 것이 무엇인가: 사이트의 픽셀 분위기(B·C) / 개발 도구(A) / 둘 다. 사이트 쪽이면 B·C 를 더 설계해 ADR 초안으로 만든다
- D 를 언제 시작할지 (CI 는 저장소 공개 여부와 함께 정한다)
