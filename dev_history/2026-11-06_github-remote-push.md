# 2026-11-06: GitHub 원격 저장소 연결과 첫 push

> **작업자**: 사용자 + Claude Code (Claude Opus 5.5)
> **관련**: 커밋 `910cc97`, 원격 `git@github.com:Jounghyunkim/johnnystudio.git`

## 목표

사용자가 만든 GitHub 저장소 `Jounghyunkim/johnnystudio` 에 지금까지의 작업을 모두 올린다.

## 한 일

- 커밋하지 않았던 변경을 모두 한 커밋으로 묶었다: `910cc97 feat: Next.js 정적 포털과 회원 API 로 전환 — Phase 1 공개 허브 구현과 Phase 2 로그인 준비`
  - 164개 파일, +18228 / −826. `web/`, `api/`, `content/`, ADR-0004~0008, deploy 템플릿(cloudflared·systemd·`api.env.example`), 문서·스크립트 갱신, 예전 `src/` 정적 뼈대 삭제
- 원격 `origin` 을 `git@github.com:Jounghyunkim/johnnystudio.git` 로 추가했다 (이전에는 원격이 없었다)
- `git push -u origin main`: `b871b89`, `910cc97` 두 커밋이 올라갔고, 로컬 `main` 이 `origin/main` 을 추적한다

## 결정 (→ ADR)

- 없음 (원격 저장소 연결은 구조 결정이 아니라서 ADR 을 쓰지 않았다)

## 확인 (어떻게 검증했나)

- `./scripts/check.sh`: 커밋 전에 실행해서 "✓ 모든 검사 통과" (타입 → 린트 → 테스트 → API 테스트 → 출시 빌드 16페이지 → CSP 해시 → 셸 → CRLF)
- 비밀값 제외: `git status --ignored` 로 `api/.env.local`, `api/.venv/`, `api/data/`, `web/node_modules/`, `web/.next/`, `web/out/` 이 무시되는 것을 확인했다. 커밋에 들어간 환경 파일은 값이 빈 예시(`api/.env.local.example`, `deploy/api.env.example`)뿐이다
- 새로 추가되는 파일에서 개인키·토큰·비밀번호처럼 보이는 문자열을 정규식으로 찾았다. 테스트 코드의 가짜 값(`api/tests/test_auth.py`)만 나왔다
- 가장 큰 파일은 `web/package-lock.json` (약 270KB). 큰 바이너리는 없다
- push 결과: `* [new branch] main -> main`, `branch 'main' set up to track 'origin/main'`
- **미검증**: GitHub 저장소의 공개/비공개 여부 (이 서버에 `gh` 가 없다)

## 남은 일 · 다음 세션

- [ ] GitHub 저장소 공개 여부 확인. 공개라면 `AGENTS.md`·`deploy/` 문서의 홈 서버 정보(내부 IP `192.168.0.206`, `johnnyhouse.iptime.org`, 포트 구성)가 노출되므로 비공개로 돌리거나 문서를 다듬을지 정한다
- [ ] CI 로 `scripts/check.sh` 실행 (GitHub Actions 등). ROADMAP Phase 1 "공개" 항목

## 메모

- 이 서버에는 `gh` CLI 가 없다. 저장소 설정 확인·PR 작업은 웹에서 하거나 `gh` 를 설치해야 한다 (설치에 sudo 필요할 수 있음 [확인 필요])
- 커밋 `910cc97` 에는 2026-11-05 세션 작업과 함께 ROADMAP 에 2026-11-06 로 적힌 "홈을 랜딩페이지로 다시 구성" 작업도 들어 있다. 이 작업의 별도 작업 로그는 `dev_history/` 에 없다
- 2026-11-05 작업 로그의 "관련: 커밋 전" 은 그때 기준이다. 실제 커밋은 `910cc97` 이다 (작업 로그는 고치지 않는 규칙이라 여기에 적는다)
