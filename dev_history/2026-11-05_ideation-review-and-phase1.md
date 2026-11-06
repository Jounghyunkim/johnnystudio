# 2026-11-05: 기획안 검토와 Phase 1 (공개 허브) 구현

> **작업자**: 사용자 + Claude Code (Claude Opus 5.5)
> **관련**: [ideation.md](../docs/ideation.md) v2, ADR-0004 · 0005 · 0006 (0001 대체, 0002 일부 대체). 커밋 전

## 목표

사용자가 다시 정리한 컨셉(docs/ideation.md 원안)을 검토해서 완성도를 높이고, 그것을 바탕으로 문서를 갱신한 뒤 실제 구현까지 진행한다.

## 한 일

- **기획 검토**: 원안을 [docs/archive/ideation-v1-2026-11-05.md](../docs/archive/ideation-v1-2026-11-05.md) 에 그대로 보관하고, ideation.md 를 v2 로 다시 썼다.
  - 네 구역 구조, 원칙별 실천 기준, 신뢰(Trust by Design) 원칙 추가
  - 에셋 유형표와 콘텐츠 모델, Client Room 의 GitHub 대응표, Work with me 추가
  - 리스크 10건, 스택 도입 시점(MinIO·Redis·WebSocket 은 뒤로, 인증은 FastAPI 단일 권위 제안, JohnnyBot 은 Arkurator 재사용)
  - 성공 지표, 하지 않을 것, 열린 질문 7개
- **도구 설치**: Node.js v26.13.0 LTS 를 `~/.local/opt` 에 설치했다 (nodejs.org, SHA-256 확인, `~/.local/bin` 에 링크).
- **구현** (`web/`, Next.js 16.4.2 정적 내보내기, TypeScript 6.0.3, Tailwind 4.3.3)
  - 페이지: 홈, Library(검색·유형 필터·정렬, 주소에 상태 저장), 작품 상세, Life Log, About, Work with me, My Studio(localStorage 즐겨찾기), 404
  - 유형별 뷰어: 실행, 다운로드(SHA-256·검증 명령·서명 안내·복사), 웹 패키지(샌드박스 자리 + zip), YouTube 라이트 임베드, 사진 갤러리(`<dialog>`), 원문 링크
  - 다크 디자인 시스템(`@theme` 토큰, 대비 AA 이상), Pretendard 자체 호스팅, lucide 아이콘
- **콘텐츠** (`content/`): zod 스키마, 초안·샘플 처리, 완성도 검사(`missingFields`)
  - 실제 콘텐츠: Arkurator 1건(arkurator 저장소의 README·로고), Life Log 4건(Arkurator 첫 커밋 2025-12-19, 이름 변경 2026-06-01, M8 이전 2026-10-03, JohnnyStudio 시작)
  - 초안 4건(원안에 언급된 하드웨어 모니터링 앱, SSH 터미널, Skill Hub, 로봇): 내용 없음
  - 뷰어 예시 `sample-*` 5건: 출시 불가
  - `profile.yaml` 의 서비스 목록은 추정 초안이다 (`TODO(content)`)
- **검사·배포**
  - `check.sh`: tsc → eslint → vitest → 출시 빌드 → `check_site.py --built` → 셸 → CRLF
  - `deploy.sh`: web/out 배포, `SHOW_DRAFTS=1` 이면 거부
  - nginx 템플릿: `127.0.0.1:8081`, CSP, `/files/`, `/_next/static` 장기 캐시, `absolute_redirect off`, `real_ip`
  - 그 밖에 cloudflared 설정 예시, `preview.sh`, `file-meta.sh`
- **문서**: PHILOSOPHY 초안 v1, SITEMAP, CONTENT_GUIDE(새로 만듦), DESIGN_SYSTEM, ARCHITECTURE, ADR 3건, ROADMAP, AGENTS.md, README 를 갱신했다. 옛 `src/` 정적 뼈대는 지웠다 (`git rm`).

## 결정 (→ ADR)

- **ADR-0004**: Next.js + TS + Tailwind, Phase 1 정적 내보내기 (ADR-0001 대체)
  - CSP 는 `script-src 'unsafe-inline'`(Next 인라인 RSC) + `style-src 'self'`. Phase 2 에서 nonce 로 바꾼다
  - 의존성은 정확한 버전으로 고정하고, 2주 이상 된 버전 중 최신을 쓴다
- **ADR-0005**: 공개 콘텐츠는 `content/` 파일 + zod. 큰 파일은 `/opt/johnnystudio/files`
- **ADR-0006**: Cloudflare Tunnel 로 공개하고, nginx 는 127.0.0.1:8081 에서만 듣는다 (ADR-0002 결정 1·3 대체)

## 확인 (어떻게 검증했나)

- `./scripts/check.sh` 전체 통과: 테스트 31개, 출시 빌드 HTML 10개 검사, 문서 내부 링크 0건 깨짐.
- **개발 서버 + Playwright(임시, scratchpad)로 상호작용 18개 항목 통과, 콘솔 오류 없음**
  - 즐겨찾기: 별 → localStorage → 헤더 개수 → My Studio
  - Library: 검색·유형 필터 → 주소 반영 → 새로고침 후 유지 → 초기화
  - 사진 확대 보기: 열기 → → 키 → Esc
  - YouTube: 클릭 전에는 iframe 없음, 클릭 후 nocookie iframe
  - 체크섬 복사
  - 모바일 390px: 가로 스크롤 없음, 메뉴 이동 후 닫힘, aria-current
  - 첫 Tab 이 "본문으로 건너뛰기"
- **출시 빌드 + nginx 템플릿(사용자 권한, 포트 18082)**
  - 확인한 것: 보안 헤더·CSP, 캐시(HTML no-cache, `_next` 최대, 이미지 30일, `/files/` 7일), 404 페이지, `.release` 차단
  - 브라우저: CSP 위반 없음. 하이드레이션·클라이언트 이동·검색·즐겨찾기가 동작하고, 출시 빌드에 초안 0건, Pretendard 가 로드됨
  - **발견·수정**: 슬래시 없는 주소의 301 이 `http://도메인:포트/…` 로 나가던 문제 → `absolute_redirect off` 로 상대 경로 리다이렉트
- 스크린샷: 홈(데스크톱·모바일), Library, 상세(다운로드 패널), Arkurator, Life Log, Work, About.
- **미검증**
  - 실제 운영 nginx 적용, Cloudflare Tunnel, 도메인 (서버 설정 전)
  - Lighthouse 점수, 실제 스크린리더 사용
  - Playwright 스크립트는 저장소에 넣지 않았다

## 남은 일 · 다음 세션

- [ ] 사용자: ideation §9 열린 질문 7개에 답한다 (도메인, 우선순위, 대표 작품, 서비스·연락처, 코드 서명, 큰 파일 채널, 소개 범위)
- [ ] 초안 4건의 실제 내용 채우기, 작품 이미지, 다운로드 파일
- [ ] 상호작용 테스트를 저장소에 넣기 (playwright-core devDependency 또는 별도 스크립트)
- [ ] 도메인 → Cloudflare → 서버 1회 설정(sudo, 사용자) → 공개
- [ ] 이번 변경 커밋 (사용자 요청 시)

## 메모

- 의존성 선택 이유
  - ESLint 10 은 eslint-config-next 16.4 의 플러그인 peer(`^9`)와 충돌해서 9.39.5 를 쓴다 (지원 종료 경고는 감수)
  - TypeScript 7(Go 버전)은 도구 호환을 확인하지 못해서 6.0.3 을 쓴다
- `npm audit`: 운영 의존성 0건, 개발 의존성 중간 8건(typescript-eslint → minimatch ReDoS). 우리 소스만 처리해서 감수한다.
- 함정 두 가지를 ARCHITECTURE §3 에 기록했다
  - 정적 내보내기에서 `useSearchParams` 를 쓰면 빌드된 HTML 에 목록이 빠진다
  - `"use client"` 파일에서 내보낸 값은 서버 컴포넌트에서 참조로만 보인다 (빌드 오류로 실제로 겪었다)
- 한국어(`ko`) 정렬에서는 한글이 영문보다 앞에 온다. 이름순 정렬 테스트를 그에 맞췄다.
