# JohnnyStudio 포털 로드맵

> **Last Updated**: 2026-11-05

## 현재 위치

**Phase 0 (개발 준비) 완료.** 다음은 **Phase 1 (철학·비전 정의)** 다.
사용자가 쓴 상위 기획안 [ideation.md](ideation.md) 를 바탕으로 [01_vision/PHILOSOPHY.md](01_vision/PHILOSOPHY.md) 의 질문에 답하는 것부터 시작한다.

---

## Phase 0: 개발 준비 ✅

- [x] 개발 폴더 구조 (`docs/`, `dev_history/`, `deploy/`, `scripts/`, `src/`)
- [x] AI 작업 가이드 (`AGENTS.md`, `CLAUDE.md`, `/worklog`·`/adr` 명령)
- [x] 기술 스택 결정 ([ADR-0001](04_architecture/adr/0001-static-html-stack.md)), 배포 방식 결정 ([ADR-0002](04_architecture/adr/0002-deploy-home-server-nginx.md))
- [x] 포털 뼈대 페이지 (자리표시 콘텐츠), 로컬 미리보기, 검사 스크립트
- [x] 배포·롤백 스크립트, nginx 설정 템플릿 (서버에는 아직 적용하지 않음)
- [x] git 저장소 초기화와 첫 커밋

## Phase 1: 철학·비전 정의 ⏳ 다음

- [ ] [ideation.md](ideation.md) 검토: 확정할 것, 보류할 것, 버릴 것을 나눈다
- [ ] ideation.md 와 현재 결정의 차이를 정리한다. 바꾸기로 하면 새 ADR 을 쓴다
  - 프론트엔드: ideation 은 React/Next.js + Tailwind, [ADR-0001](04_architecture/adr/0001-static-html-stack.md) 은 빌드 없는 정적 사이트.
    ideation Phase 1(정적 큐레이션 갤러리)은 ADR-0001 범위 안이고, Phase 2 이후(API 연동·AI 에이전트)는 ADR-0001 재검토 조건에 해당한다
  - 배포: ideation 은 Docker + Cloudflare Tunnel, [ADR-0002](04_architecture/adr/0002-deploy-home-server-nginx.md) 는 포트포워딩 + certbot (도메인 미결정)
  - 테마: ideation 은 다크 테마 기본, 현재 구현은 OS 설정을 따른다
- [ ] 한 문장 정의, 미션, 비전
- [ ] 핵심 가치 3~5개 (각 가치가 실제 행동으로 어떻게 드러나는지 포함)
- [ ] 하는 일의 영역 (현재 프로젝트와 앞으로의 방향)
- [ ] 대상 방문자, 그리고 방문자가 포털에서 얻어 가야 할 것
- [ ] 톤앤매너 (말투, 인상, 피하고 싶은 인상)
- [ ] 포털의 성공 기준

## Phase 2: 기획

- [ ] 사이트맵과 페이지별 역할 확정 ([02_planning/SITEMAP.md](02_planning/SITEMAP.md))
- [ ] 페이지별 콘텐츠·문구 초안
- [ ] 프로젝트 소개 항목 (이름, 한 줄 소개, 상태, 링크, 이미지)
- [ ] 언어 정책 (한국어만 / 한·영), 연락 수단

## Phase 3: 디자인

- [ ] 브랜드 색, 글꼴, 로고·워드마크 → `tokens.css` 확정 ([03_design/DESIGN_SYSTEM.md](03_design/DESIGN_SYSTEM.md))
- [ ] 주요 화면 시안 (모바일 / 데스크톱)
- [ ] 이미지·일러스트·모션 원칙

## Phase 4: 구현

- [ ] 페이지 구현, 자리표시 콘텐츠를 실제 콘텐츠로 교체
- [ ] 메타 태그 (Open Graph, canonical), 파비콘 세트
- [ ] 접근성·성능 점검

## Phase 5: 배포·출시

- [ ] 도메인 결정과 DNS 연결 ([ADR-0002](04_architecture/adr/0002-deploy-home-server-nginx.md) 미결정 사항)
- [ ] 서버 1회 설정 ([deploy/README.md](../deploy/README.md) §2)
- [ ] HTTPS 인증서 (certbot)
- [ ] 출시 체크리스트 ([deploy/README.md](../deploy/README.md) §5): 색인 허용, sitemap 등
- [ ] GitHub 원격 저장소 연결, 필요하면 CI 로 `scripts/check.sh` 실행
