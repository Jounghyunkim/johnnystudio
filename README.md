# JohnnyStudio

> JohnnyStudio 의 포털(허브) 웹사이트: 스튜디오의 철학을 소개하고, 스튜디오가 만드는 프로젝트로 이어 준다.

**현재 단계**: Phase 0 개발 준비 완료 → Phase 1 철학·비전 정의 ([로드맵](docs/ROADMAP.md))

## 빠른 시작

```bash
./scripts/dev.sh      # 로컬 미리보기 → http://127.0.0.1:8080
./scripts/check.sh    # 검사 (커밋·배포 전)
```

필요한 것: Python 3, Bash. 빌드 도구는 필요 없다.

## 폴더 구조

```
JohnnyStudio/
├── AGENTS.md            AI 도구 공통 작업 규칙 (단일 원본)
├── CLAUDE.md            Claude Code 진입점 (AGENTS.md 를 불러온다)
├── src/                 웹 루트 (배포 대상)
├── docs/                기획·설계 문서 (현재 상태)
│   ├── ROADMAP.md       단계별 진행 상황 (세션을 시작하면 먼저 읽는다)
│   ├── 01_vision/       철학·미션·비전
│   ├── 02_planning/     사이트맵·콘텐츠·기능 명세
│   ├── 03_design/       디자인 시스템
│   ├── 04_architecture/ 시스템 구조 + adr/ (결정 기록)
│   └── templates/       ADR·작업 로그·기능 명세 템플릿
├── dev_history/         세션별 작업 로그
├── deploy/              배포 스크립트·nginx 설정·배포 가이드
├── scripts/             로컬 개발 도구
└── .claude/commands/    Claude Code 슬래시 명령 (/worklog, /adr)
```

## 기술 스택과 배포

- 빌드 없는 정적 HTML/CSS/JS: [ADR-0001](docs/04_architecture/adr/0001-static-html-stack.md)
- 홈 서버 M8 의 nginx 로 배포 (릴리스 폴더 + `current` 링크): [ADR-0002](docs/04_architecture/adr/0002-deploy-home-server-nginx.md), [배포 가이드](deploy/README.md)

## AI 도구로 개발할 때

규칙은 [AGENTS.md](AGENTS.md) 에 있다. 요약하면 다음과 같다.

1. **시작할 때**: `docs/ROADMAP.md` 와 가장 최근 `dev_history/` 를 읽는다
2. **결정할 때**: `docs/04_architecture/adr/` 에 ADR 을 쓴다 (Claude Code: `/adr`)
3. **끝낼 때**: `dev_history/` 에 작업 로그를 쓰고 ROADMAP 을 갱신한다 (Claude Code: `/worklog`)
