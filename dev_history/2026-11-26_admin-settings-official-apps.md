# 2026-11-26: 운영자 관리·설정 화면·공식 앱 DB 이전·화면 다듬기

> **작업자**: 사용자 / Claude Code (Claude Opus 5.5)
> **관련**: [ADR-0014](../docs/04_architecture/adr/0014-official-apps-in-store-db.md) (새로, 제안됨), [ADR-0012](../docs/04_architecture/adr/0012-member-store.md) 결정 8·12 (보탬), 커밋 `beae0dd` (브랜치 `feat/store-showroom-admin-settings`),
> [설정 화면 명세](../docs/02_planning/features/settings.md), [Store](../docs/02_planning/features/store.md) · [Showroom](../docs/02_planning/features/showroom.md) · [소개 자료](../docs/02_planning/features/listing.md) 명세

## 목표

사용자 요청을 차례로 처리했다 (한 세션, 요청 30여 건).

- Store·Showroom 버튼 배치, 상세 화면의 '편집'·중복 버튼 정리, 운영자가 모든 앱·서비스를 고치고 지우기
- Store 업로드 413 오류 원인 찾기, JohnnyStudio 자체의 Showroom 소개 자료(zip) 만들기
- 설정 화면(사용자 현황·앱 설정·캐시 지우기·표시 이름), 운영자 전체 현황 차트, 지금 쓰는 DB 알려 주기
- 운영자가 올린 공식 앱·서비스를 DB 로 옮기기
- 홈 히어로 문구·이름 글꼴, 밝은 테마 색, Library 4칸·유형별 칸, Arkurator 아이콘, 초안 2개 지우기, JohnnyStudio 를 Library 에

## 한 일

**Store·Showroom 화면**
- Store '앱 올리기'·'검토', Showroom '서비스 등록'(← '서비스 소개하기')·'검토' 버튼을 머리글 설명 아래로 (`PageHeader` 에 `actions`), 가로줄과의 간격 줄임
- 상세 화면 즐겨찾기 옆에 '편집'(소개 꾸미기 화면) 버튼, '소개 꾸미기' 버튼은 뺌
- 상세 옆 칸의 겹치는 버튼('정보 고치기'·'아이콘 바꾸기'·'검토 화면') 뺌. 남긴 것: 새 버전 올리기, 앱·서비스 지우기, 신고, 내 서비스
- 검토 화면의 Store 앱 줄 '고치기'(정보 대화상자) → '편집'(소개 꾸미기 `/store/listing/?app=`), Showroom 줄에도 편집·지우기
- 소개 꾸미기 화면의 저장 막대를 화면 아래에 고정 (진행·서버 오류도 막대 안에, 휴대폰은 얇게)

**운영자 권한 (ADR-0012 결정 12 에 보탬)**
- Showroom API `_editable` 이 운영자도 받는다 (고치기·아이콘·그림·소개 자료). 운영자가 고치면 검토 상태를 바꾸지 않는다 (주소를 바꿔도 다시 검토 대기로 돌리지 않음)
- 약관 제5조 5 에 소개 자료·서비스 주소를 더하고 `TERMS_VERSION` 을 `2026-11-26` 으로 (올리는 회원이 다시 동의)

**설정 화면 `/settings/`** (바닥글 오른쪽 아래 '설정' 버튼)
- 사용자 현황: 내 계정, **표시 이름 바꾸기**(`PATCH /api/store/me/publisher`, 약관 다시 동의 없음, 이용 제한 중에는 이름 변경 거절 — POST 로 바꾸는 것도 막음)
- 운영자 전체 현황: 개수 타일 + **차트**(가입 추이 30·90일, 마지막 로그인 분포, 앱·서비스 상태 나눔 막대, 내려받기 상위 앱). API `api/app/site.py` (`GET /api/site/admin/stats` 의 `trends`, 개수만)
- 앱 설정: 테마, 로그인 이메일 기억(잊기), 운영 설정(읽기 전용)
- 일반 설정: 캐시 지우기(`POST /api/site/clear-cache` → `Clear-Site-Data: "cache"`), 이 브라우저의 `johnnystudio:` 저장 값 골라 지우기
- 차트 계산은 `web/src/lib/chart.ts`, 화면은 `components/settings/admin-charts.tsx`. 상태 색 토큰 `--color-chart-*` (dataviz 검사기로 고름)

**공식 앱·서비스를 DB 로 (ADR-0014)**
- `api/app/import_official.py` + 작품 관리 CLI `official-export`·`official-link` + `scripts/import-official.sh` (여러 번 돌려도 된다, `--dry-run`, `--fix-files`)
- API 응답에 `official` (주인이 운영자 계정이면 true), 카드·상세에 '공식' 표시·"JohnnyStudio가 직접 만든 앱입니다" 안내
- 작품 파일 스키마에 `storeApp`·`showroomService`. Library 상세는 'Store에서 내려받기'·'Showroom 소개'로 잇는다. 코드가 있는 작품은 작품 파일에서 다시 합치지 않는다
- 개발 DB 에서 실행: 새로 10개, My Claude Inspector 는 Store 에 소개 자료 zip 이 잘못 올라가 있어 `--fix-files` 로 진짜 설치 파일(126MB exe)로 바꿈, Arkurator 는 이미 있던 서비스에 이음. 작품 파일 12개에 코드 한 줄씩. 옮기기 전 DB 백업 `.local/backup/`
- 그 전에 만든 '공식 항목 지우기'(개발 서버, `components/store/official-delete.tsx`)는 코드가 없는 작품에만 남는다

**홈·Library·테마**
- 히어로 제목: `content/profile.yaml` 의 새 칸 `landing.greeting` (최종 "당신이 상상했던 것을 Johnny와 함께 마음껏 펼치세요!"). 한 줄 정의(tagline)는 바닥글·About 에 그대로
- '{ JohnnyStudio }': 각진 글꼴 Oxanium(굵기 800), 그라데이션·빛이 흐르는 `.brand-wordmark`, 크기는 줄 폭에 맞춤(`cqw`), 남은 자리 가운데 정렬
- 밝은 테마 토큰: 쿨톤 바탕·짙은 남색 글자·맑은 초록 강조색 (예전 강조색은 떠 있는 면에서 4.4:1 로 AA 에 조금 못 미쳤다)
- Library: 1280px 부터 4칸 (1024px 에서 4칸이면 카드가 넘쳐 3칸), 유형(웹 서비스·데스크톱 툴)별 칸과 칸 사이 가로 점선, 카드 아래 줄 한 줄 고정. 관리자 작품만 보인다는 시험 추가
- Arkurator: 잘려 보이던 검은 바탕 로고 대신 Showroom 아이콘을 둥글게 다듬어 `icon` 으로 (`logo.webp` 는 쓰지 않음, 남겨 둠)
- 초안 2개(Skill Hub·로봇 프로젝트) 지움 → `.local/trash` (작품 관리 CLI 에 `remove` 명령 추가)
- JohnnyStudio 를 Library 작품으로 등록(`content/assets/johnnystudio.md`, Showroom 소개의 글·아이콘). 시작한 날은 첫 작업 로그 날짜 2026-11-05. Showroom 서비스 주인을 운영자 계정으로 옮김 (사용자 승인 뒤, DB 백업)

**그 밖**
- 413: johnnystudio.net nginx 사이트에 `client_max_body_size` 가 없어 기본 1m → 8MB 조각이 막힘. 사용자가 고침, 2MB 요청이 413 → 403(출처 검사)으로 바뀐 것 확인. `scripts/dev.sh` 머리말에 메모
- JohnnyStudio 소개 자료 `.local/listing/johnnystudio-listing.zip` (git 제외). 출시 빌드로 찍은 화면 그림
- 지금 쓰는 DB: 개발 SQLite `api/data/dev.sqlite3` (운영 PostgreSQL 은 아직 없음)
- 지난 세션 로그 `2026-11-24_member-store-showroom.md` 의 운영자 이메일을 커밋 전에 가림
- 커밋 `beae0dd` 를 새 브랜치 `feat/store-showroom-admin-settings` 로 푸시 (main 은 그대로 `f97b112`). 11-25 의 소개 자료 키트(ADR-0013) 변경도 이 커밋에 함께 들어갔다 (그날 작업 로그는 없다)

## 결정 (→ ADR)

- 공식 앱·서비스도 Store·Showroom DB 에서 관리, 설치 파일·버전은 DB 한 곳, Library 소개 글은 작품 파일, 운영자 계정 = '공식' → **ADR-0014** (제안됨, ADR-0012 결정 8 일부 대체)
- 운영자가 Showroom 을 고치면 검토 상태 그대로 → ADR-0012 결정 12 에 보탬
- 표시 이름: 이용 제한 중에는 바꾸지 못한다 (ADR 없음, store.md 명세)
- 운영 설정은 화면에서 바꾸지 않는다 (환경 변수가 원본). 바꾸려면 설정 테이블과 ADR 이 먼저 (ADR 없음, settings.md 미결정)
- Library 는 관리자 작품(작품 파일)만 보인다 (사용자 확인, 시험으로 지킨다)
- 새 의존성 `@fontsource-variable/oxanium` 5.3.0 (정확한 버전 고정, 2026-07-19 공개로 2주 이상 지남): 사용자가 '각지게' 요청했는데 Pretendard 로는 안 되고, 외부 글꼴 CDN 은 CSP·규칙상 못 써서 자체 호스팅 패키지로 (SIL OFL, 라틴 글자만, 히어로 이름에만)
- 커밋은 기본 브랜치가 아닌 새 브랜치로 (작업 규칙)

## 확인 (어떻게 검증했나)

- `./scripts/check.sh` 통과 (마지막: 웹 테스트 18파일 154개, API 테스트 146 통과 · 1 건너뜀, 출시 빌드·CSP 해시·셸·CRLF)
- API 테스트 추가: 운영자 Showroom 고치기·지우기, 표시 이름 바꾸기, `/api/site` (캐시 지우기 머리글·운영자 현황·추이), 공식 앱 옮기기 4개 (실제 PE 분석·아이콘 다시 그리기 포함)
- 웹 테스트 추가: 저장 값 목록, 차트 계산, 유형별 칸, `storeApp`·`showroomService` 스키마, Library 가 Store·Showroom API 를 부르지 않는다
- 헤드리스 Chromium(Playwright 1.65, 저장된 1248 브라우저)으로 화면 확인 — 출시 빌드 + 임시 DB(임시 API 8190·미리보기 8180), 또는 개발 서버(4000) 비회원 보기
  - 운영자 편집·지우기 25항목, 설정 화면 36항목, 표시 이름 15항목, 검토 화면 편집 6항목, 저장 막대 14항목, 전체 현황 차트(두 테마·휴대폰), 상세 중복 버튼 8항목: 모두 통과
  - 캐시 지우기: 127.0.0.1 에서 캐시된 그림(48KB)이 지운 뒤 서버에서 다시 받아짐
  - 공식 항목 지우기: 저장소 **사본**의 개발 서버(4100~4102)에서만 시험 (원본 content 그대로). 사본에서는 없는 작품 주소가 500, 원본 개발 서버는 404 — 이 변경과 무관
  - 옮긴 뒤 개발 서버 13항목 (Store 11개 모두 공식, Library 'Store에서 내려받기', Showroom 중복 없음)
- `scripts/import-official.sh --dry-run`: 13개 모두 "이미 있음", 문제 0
- 미검증: 실제 운영자 계정으로 johnnystudio.net 에 로그인한 화면 (임시 DB 의 시험 계정으로만 봄), HTTPS 주소에서의 캐시 지우기와 Safari·Firefox, 운영 DB(PostgreSQL)에서의 옮기기, 실제 메일 발송

## 남은 일 · 다음 세션

- [ ] 사용자: 브랜치 `feat/store-showroom-admin-settings` 를 main 에 합치기 (또는 합쳐 달라고 요청)
- [ ] 사용자: ADR-0013·ADR-0014 확정, 약관 제5조 5 문안 확인 (판 `2026-11-26`)
- [ ] 운영 서버 설치 뒤 `scripts/import-official.sh` 한 번 (deploy/README §3-8)
- [ ] JohnnyStudio 소개 자료의 `[확인 필요]` 값: 가격, 지원 브라우저, 라이선스, 지원 연락처, 분류, Microsoft Store 분류, GitHub 링크
- [ ] JohnnyStudio 작품의 시작한 날(2026-11-05) 확인, 아이콘 원본(320px 로고를 키운 것)
- [ ] 쓰지 않는 `web/public/media/arkurator/logo.webp` 지울지
- [ ] 대표 작품(`featured`) 고르기
- [ ] (원하면) 운영 설정을 화면에서 바꾸기, 넓은 화면에서 '{ JohnnyStudio }' 를 더 크게(히어로 전체 폭)
- [ ] 이 작업 로그와 ROADMAP 갱신 커밋 (`/worklog` 는 커밋하지 않는다)

## 메모

- `pkill -f <패턴>` 이 자기 셸까지 죽인다 (명령줄에 패턴이 있어서, 이번에 두 번). 서버는 `ss -ltnp` 로 PID 를 찾아 끈다
- 이 저장소에는 prettier 설정이 없다. `npx prettier` 를 돌리면 80칸으로 다시 짜인다 (한 번 그래서 되돌렸다)
- 저장소 사본에서 `node_modules` 를 심볼릭 링크로 두면 Turbopack 이 Next 를 못 찾는다 (실제로 복사해야 한다)
- CSP 가 `style` 속성을 막으므로 차트·툴팁 위치는 SVG 속성(`x`·`width`·`transform`)으로만 정한다
- `PUBLIC_URL` 로 띄운 관리 서버는 실행마다 토큰이 새로 생겨 `.local/admin-token` 과 다르다. 작품을 지울 때는 CLI `admin remove` 를 쓴다 (dev.sh 터미널의 '토큰이 맞지 않는 요청' 경고 2건은 이번 시도였다)
- 다른 계정의 DB 데이터를 바꾸는 명령은 자동 모드가 막는다. 사용자가 명시적으로 승인한 뒤 실행했다
- 개발 SQLite 는 스키마가 바뀌면 다시 만들어진다. 그러면 `scripts/import-official.sh` 를 다시 돌리면 같은 코드로 되살아난다 (설치 파일은 `.local/files` 에서)
