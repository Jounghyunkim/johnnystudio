# 문서 안내

> **Last Updated**: 2026-11-05

| 문서 | 내용 | 상태 |
|---|---|---|
| [ROADMAP.md](ROADMAP.md) | 단계별 진행 상황. **세션을 시작하면 먼저 읽는다** | 최신 |
| [ideation.md](ideation.md) | 통합 허브 상위 기획안 (철학·컨셉·기술 스택·단계 계획), 사용자 작성 | 초안. Phase 1 입력 자료 |
| [01_vision/PHILOSOPHY.md](01_vision/PHILOSOPHY.md) | 철학·미션·비전·핵심 가치·톤앤매너 | 작성 전 (Phase 1) |
| [02_planning/SITEMAP.md](02_planning/SITEMAP.md) | 페이지 구성, 연결할 프로젝트 목록 | 가설 |
| [03_design/DESIGN_SYSTEM.md](03_design/DESIGN_SYSTEM.md) | 디자인 토큰·UI 규칙 | 임시값 |
| [04_architecture/ARCHITECTURE.md](04_architecture/ARCHITECTURE.md) | 시스템 구성, 소스 구조, 검사 항목 | 최신 |
| [04_architecture/adr/](04_architecture/adr/README.md) | 결정 기록 (ADR) | 3건 |
| [templates/](templates/) | ADR·작업 로그·기능 명세 템플릿 | |
| [../deploy/README.md](../deploy/README.md) | 배포 가이드 | 서버 설정 전 |

## 폴더 번호의 뜻

`01` → `04` 는 생각하는 순서다. **왜**(비전) → **무엇을**(기획) → **어떻게 보이게**(디자인) → **어떻게 만들지**(구조).
앞 단계 문서가 바뀌면 뒤 단계 문서가 여전히 맞는지 다시 확인한다.

## 작성 규칙

- 한국어로 쓰고, 파일 상단에 `> **Last Updated**: YYYY-MM-DD` 를 단다.
- `docs/` 에는 **현재 상태**를 쓴다. 바뀐 과정과 이유는 `dev_history/`(작업 로그)와 `adr/`(결정)에 남긴다.
- 확인하지 않은 값에는 `[확인 필요]` 를 붙이고, 확인하면 표시를 지운다.
- 기능 단위 명세는 필요해지면 `02_planning/features/<기능>.md` 로 만든다 (템플릿: [templates/FEATURE_SPEC_TEMPLATE.md](templates/FEATURE_SPEC_TEMPLATE.md)).
