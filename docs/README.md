# 문서 안내

> **Last Updated**: 2026-11-06

| 문서 | 내용 | 상태 |
|---|---|---|
| [ROADMAP.md](ROADMAP.md) | 단계별 진행 상황. **세션을 시작하면 먼저 읽는다** | 최신 |
| [ideation.md](ideation.md) | 통합 허브 기획안 검토판: 네 구역, 원칙, 콘텐츠 모델, 리스크, 스택 도입 시점, 단계 계획, 열린 질문 | v2 (사용자 확인 전) |
| [archive/](archive/) | 사용자 원안 보관본 | 보관 |
| [01_vision/PHILOSOPHY.md](01_vision/PHILOSOPHY.md) | 한 문장 정의, 미션·비전, 핵심 가치, 대상, 톤앤매너 | 초안 v1 (사용자 확인 전) |
| [02_planning/SITEMAP.md](02_planning/SITEMAP.md) | 페이지·메뉴·콘텐츠 목록 | Phase 1 + 회원 화면 반영 |
| [02_planning/CONTENT_GUIDE.md](02_planning/CONTENT_GUIDE.md) | 작품·기록·문구를 추가하는 방법 (필드, 예시, 파일 올리기) | 최신 |
| [03_design/DESIGN_SYSTEM.md](03_design/DESIGN_SYSTEM.md) | 다크 테마 토큰, 글꼴, 컴포넌트 | v1 (브랜드 색·로고 임시) |
| [04_architecture/ARCHITECTURE.md](04_architecture/ARCHITECTURE.md) | 시스템 구성, 렌더링 원칙, 회원(매직 링크), 콘텐츠 파이프라인, 보안·캐시, 검사, 이후 구조 | 최신 |
| [04_architecture/adr/](04_architecture/adr/README.md) | 결정 기록 (ADR) | 7건 |
| [templates/](templates/) | ADR·작업 로그·기능 명세 템플릿 | |
| [../deploy/README.md](../deploy/README.md) | 배포 가이드 (서버 설정, 회원 API, Tunnel, 일상 배포, 롤백, 출시 체크리스트) | 서버 설정 전 |

## 폴더 번호의 뜻

`01` → `04` 는 생각하는 순서다. **왜**(비전) → **무엇을**(기획) → **어떻게 보이게**(디자인) → **어떻게 만들지**(구조).
앞 단계 문서가 바뀌면 뒤 단계 문서가 여전히 맞는지 다시 확인한다.

## 작성 규칙

- 한국어로 쓰고, 파일 상단에 `> **Last Updated**: YYYY-MM-DD` 를 단다.
- `docs/` 에는 **현재 상태**를 쓴다. 바뀐 과정과 이유는 `dev_history/`(작업 로그)와 `adr/`(결정)에 남긴다.
- 확인하지 않은 값에는 `[확인 필요]` 를 붙이고, 확인하면 표시를 지운다.
- 기능 단위 명세는 필요해지면 `02_planning/features/<기능>.md` 로 만든다 (템플릿: [templates/FEATURE_SPEC_TEMPLATE.md](templates/FEATURE_SPEC_TEMPLATE.md)).
