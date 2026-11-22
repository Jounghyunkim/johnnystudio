# JohnnyStudio 포털 로드맵

> **Last Updated**: 2026-11-22
> 제품 단계(Phase 1~4)는 [ideation.md](ideation.md) §6 을 따른다.

## 현재 위치

**Phase 1 (공개 허브) 구현 완료, 공개 준비 중.** 화면·뷰어·콘텐츠 체계·검사·배포 도구는 갖췄다.
**Phase 2 의 회원 가입(이메일 인증)·로그인(이메일 + 비밀번호)을 먼저 구현했다** ([ADR-0007](04_architecture/adr/0007-magic-link-auth-api.md), [ADR-0008](04_architecture/adr/0008-password-login.md)). 로컬에서 동작을 확인했고, 서버 설정과 메일 발송 설정이 남았다.
코드는 GitHub `Jounghyunkim/johnnystudio` 에 올렸다 (2026-11-06). CI 는 아직 없다.
**작품 등록·관리 도구**를 만들었다 (2026-11-09, [ADR-0009](04_architecture/adr/0009-local-portfolio-manager.md)): `dev.sh` 의 관리 화면 `/admin/` 과 CLI 로 작품을 만들고, 채우고, 공개한다. 콘텐츠 채우기(아래 2번)는 이 도구로 한다.
**JohnnyStore 를 흡수하기로 했다** (2026-11-22, [통합 문서](02_planning/features/johnnystore-integration.md), [ADR-0011](04_architecture/adr/0011-absorb-johnnystore.md)). 파일을 올리는 사람은 운영자뿐이다. 스토어의 Windows 앱 9개를 작품으로 옮겨 공개했다 (공개 작품 10개). 스토어 서비스와 저장소(`../johnnystore`)는 보관본을 남기고 지웠다. 다음은 설치 파일 분석·ClamAV 검사(S2) (아래 "JohnnyStore 통합").
남은 일은 다음 네 가지다.

1. ideation §9 열린 질문에 답한다 (§9-6 큰 파일 배포 채널은 답함: 홈 서버만)
2. **실제 콘텐츠**를 채운다 (작품은 10개 공개. 서비스, 연락처, 개인정보처리방침의 운영자·연락처가 남았다)
3. **도메인 + Cloudflare Tunnel** 로 공개한다
4. 로그인을 쓰려면 **메일 발송 방법**을 정하고 회원 API 를 서버에 설치한다 ([deploy/README.md](../deploy/README.md) §3)

---

## 기반 ✅

### Phase 0: 개발 준비 ✅

- [x] 개발 폴더 구조, AI 작업 가이드(`AGENTS.md`·`CLAUDE.md`·`/worklog`·`/adr`), git 저장소

### 비전·기획 ✅ (사용자 확인 남음)

- [x] 사용자 원안 검토 → [ideation.md](ideation.md) v2 (네 구역, 원칙별 실천 기준, 리스크 10건, 스택 도입 시점)
- [x] [PHILOSOPHY.md](01_vision/PHILOSOPHY.md) 초안 v1, [SITEMAP.md](02_planning/SITEMAP.md), [CONTENT_GUIDE.md](02_planning/CONTENT_GUIDE.md), [DESIGN_SYSTEM.md](03_design/DESIGN_SYSTEM.md)
- [x] ADR-0004 (Next.js 정적 내보내기), ADR-0005 (파일 콘텐츠), ADR-0006 (Cloudflare Tunnel)
- [ ] **사용자 확인**: ideation §9 열린 질문 7개, PHILOSOPHY 의 `[확인 필요]` 항목

## Phase 1: 공개 허브 (Showcase) ⏳

### 구현 ✅

- [x] Next.js 16 + TypeScript + Tailwind 4 (`web/`), 다크 디자인 시스템, Pretendard 자체 호스팅
- [x] 콘텐츠 체계: `content/` + zod 스키마 + 초안·샘플 처리 + 완성도 검사
- [x] 페이지: 홈, Library(검색·유형 필터·정렬, 주소에 상태 저장), 작품 상세, Life Log, About, Work with me, My Studio(브라우저 저장 즐겨찾기), 404
- [x] 홈을 랜딩페이지로 다시 구성 (2026-11-06): 다루는 작품 보드, 이렇게 쓰세요, 원칙, 함께 일하는 방식, 자주 묻는 질문 (`profile.yaml` 의 `landing`)
- [x] 유형별 뷰어: 실행, 다운로드(SHA-256·검증 방법·서명 안내), 웹 패키지(샌드박스 자리), YouTube 라이트 임베드, 사진 갤러리, 원문 링크
- [x] 검사 파이프라인 (`check.sh`: 타입·린트·웹 테스트 108개·API 테스트 55개·출시 빌드·빌드 결과 검사, 2026-11-09 기준)
- [x] 배포 도구: 출시 빌드 배포, `/files/`, nginx(127.0.0.1:8081, CSP, 캐시), Cloudflare Tunnel 설정 예시, `file-meta.sh`

### 작품 관리 도구 ✅ (2026-11-09)

- [x] 검토·설계: [기능 명세](02_planning/features/portfolio-manager.md) (운영 관리자 화면·외부 CMS·라우트 핸들러를 검토하고 로컬 관리 도구로 결정)
- [x] 관리 화면 `/admin/` (개발 서버 전용): 현황·검사, 새 작품, 편집, 이미지·설치 파일 올리기(조각, SHA-256), 공개·초안·삭제
- [x] 관리 서버(127.0.0.1, 토큰) + CLI(`npm --prefix web run admin -- …`), 출시 빌드에 `/admin/` 이 없는지 검사
- [x] 개발 미리보기가 콘텐츠 변경을 바로 반영 (캐시 무효화), 완성도 검사가 본문 `TODO(` 도 잡음
- [x] 개발 미리보기에서 `/files/` 내려받기 (2026-11-22, 관리 서버가 읽기 전용으로 내준다)
- [ ] 2단계 (필요해지면): Life Log·서비스 편집, 이미지 크기(px) 경고, 바뀐 파일·검사 실행 보기, 출시 빌드 미리보기(`preview.sh`)의 `/files/`

### 콘텐츠 ⏳

- [x] 대표 작품 5~10개 등록 (2026-11-22): JohnnyStore 의 Windows 앱 9개를 옮겨 공개 작품이 10개가 됐다 (Arkurator 포함). 초안 '하드웨어 모니터링'·'SSH 터미널'은 CMG Monitor·WLT 로 대신했다
- [ ] 남은 초안 2개(Skill Hub, 로봇)의 내용 채우기, 대표 작품(`featured`) 고르기 (관리 화면 `/admin/` 으로)
- [ ] 앱 9개의 설치 파일(180MB, 지금 `.local/files/`)을 서버 설정(deploy/README §2-1) 뒤 `/opt/johnnystudio/files/` 로 옮기기: `rsync -a .local/files/ /opt/johnnystudio/files/`
- [ ] 작품 이미지 (webp), 다운로드 파일 업로드
- [ ] `profile.yaml` 의 서비스 목록·연락처, About 운영자 소개 (`grep -rn "TODO(content)"`)
- [ ] 실제 작품이 생기면 `sample-*` 정리

### 품질 ⏳

- [ ] 브라우저 상호작용 테스트를 저장소에 넣는다 (임시 Playwright 스크립트로 확인만 함: 2026-11-05 사이트 18개, 2026-11-09 관리 화면 23개)
- [ ] Lighthouse(성능·접근성) 점검, 스크린리더 확인

### 공개 ⏳

- [ ] 도메인 결정 → DNS 를 Cloudflare 로 ([ADR-0006](04_architecture/adr/0006-cloudflare-tunnel.md))
- [ ] 서버 1회 설정 + Tunnel ([deploy/README.md](../deploy/README.md) §2, §4, sudo 필요: 사용자)
- [ ] 출시 체크리스트 ([deploy/README.md](../deploy/README.md) §7): 색인 허용, sitemap, canonical, OG 이미지
- [x] GitHub 원격 저장소 연결 (2026-11-06, `Jounghyunkim/johnnystudio`, `main` push 완료. 공개 여부 확인 전)
- [ ] CI 로 `scripts/check.sh` 실행

## JohnnyStore 통합 ⏳ (결정 완료, 구현 전)

> [통합 문서](02_planning/features/johnnystore-integration.md) · [ADR-0011](04_architecture/adr/0011-absorb-johnnystore.md): JohnnyStudio 기준으로 흡수하고, 파일을 올리는 사람은 운영자뿐이다.
> S1 이 위 "콘텐츠"의 데스크톱 앱을 채운다 (초안 `ssh-terminal`·`hardware-monitor` 는 스토어의 WLT·CMG Monitor 로 대신한다).

- [x] 검토: 두 서비스 비교, 철학 충돌(누가 올리나), 일원화 방식, 구조, 보안·운영, 단계 계획 (2026-11-22)
- [x] 결정 (2026-11-22): 올리기는 운영자만(Q1), 겹치는 앱 2개는 같은 앱(Q3), 상태·날짜는 스토어와 같게(Q4: 운영 중, 2026-11-16) → ADR-0011
- [x] 스토어(4000)가 공인 주소로 열려 있고 가입이 `open` 이던 것을 닫았다 (Q8, 통합 문서 §5 X1)
- [x] 나머지 결정 (2026-11-22): 이름 "JohnnyStore" 는 남기지 않음(Q2), 옛 링크 리다이렉트 없음(Q5), 검사는 로컬 ClamAV 만(Q6), 설치 파일은 홈 서버에서만(Q7), 저장소 제거(Q9)
- [x] 스토어 종료·저장소 제거: 전체를 `~/workspace/backup/johnnystore/johnnystore-20261122.tar.gz` 로 보관·확인한 뒤 지웠다 (통합 문서 §3-3)
- [x] S0 준비: JohnnyStudio 미커밋 작업 커밋 (2026-11-22, 작품 관리 `f336188` + 통합 문서)
- [x] S1 콘텐츠 이관 (2026-11-22): 보관본의 앱 9개 → `content/assets/` → 공개 (운영 중, 2026-11-16). 설치 파일 SHA-256 9개 일치. S2 의 앱 아이콘(`icon`)도 앞당겨 넣었다
- [ ] S2 배포 엔진: 설치 파일 분석(`api/app/binaries/`)·ClamAV 검사를 관리 도구에, 상세 화면에 아키텍처·검사 결과, OG (ADR-0012). 먼저 사용자가 `sudo apt install clamav`. 앱 9개는 ClamAV 설치 뒤 한 번에 검사
- [ ] S3 공유 키트: `/d/<slug>/`, 배지, QR (도메인 확정 뒤)
- [x] GitHub 저장소 삭제 (2026-11-22, 먼저 bundle 로 보관)
- [ ] 마무리: S2 이식 뒤 보관본(tar.gz·bundle) 삭제. 공유기 4000 포트는 JohnnyStudio 개발 서버가 쓴다 (인터넷 공개 개발을 끝내면 닫는다)
- 비공개 공유(테스터·의뢰인)는 Phase 3 Client Room 에서, 누구나 업로드는 하지 않는다 (ADR-0011)

## Phase 1.5: 웹 패키지 샌드박스 (선택)

- [ ] 별도 출처(`play.<도메인>`)에서 zip 패키지 서빙, CSP `frame-src` 에 추가
- 로그인이 생겼으므로 웹 패키지는 **절대 포털과 같은 출처**(`<도메인>/…`)에 두지 않는다 (ideation R4: 패키지 안의 스크립트가 로그인 세션으로 API 를 부를 수 있다). 지금은 `playUrl` 을 쓰는 작품이 없고, CSP `frame-src` 가 YouTube 만 허용한다

## Phase 2: 회원과 My Studio ⏳

### 회원 가입·로그인 ✅ (2026-11-05, 서버 설치 전)

- [x] ADR-0007: 매직 링크 + FastAPI(`api/`, 인증 단일 권위), 웹은 정적 유지, CSP 는 페이지별 해시 `<meta>` (서버 모드·nonce·Docker 는 보류)
- [x] API: 링크 요청·확인(=가입), 세션 쿠키, 로그아웃, 모든 기기 로그아웃, 탈퇴. 요청 제한, Origin 검사. pytest 55개 (SQLite·PostgreSQL 18 모두 통과)
- [x] 화면: `/login/`, `/login/verify/`, `/account/`, 헤더의 로그인/계정, `/privacy/` (초안)
- [x] ADR-0008 (2026-11-06): 가입은 이메일 인증 → 비밀번호 설정, 로그인은 이메일 + 비밀번호(scrypt), `/signup/`·`/login/reset/`, 비밀번호 변경, 실패 횟수 제한
- [x] 배포 도구: nginx `/api/`, systemd 유닛, `api.env.example`, `app.check_config`, `dev.sh`·`preview.sh` 가 API 도 띄움
- [ ] 메일 발송 방법 결정 (SMTP 업체, SPF·DKIM) `[확인 필요]`
- [ ] 서버 설치: PostgreSQL 역할·DB, `api.env`, systemd ([deploy/README.md](../deploy/README.md) §3, sudo: 사용자)
- [ ] 개인정보처리방침: 운영자·연락처·발송 업체·백업 보관 기간 (`TODO(content)`), 법률 검토 여부 `[확인 필요]`
- [ ] DB 백업 (`pg_dump` 주기, 외부 사본). 비밀번호 해시가 들어 있으므로 백업 파일도 암호화한다
- [ ] 운영 DB 에 처음 설치하기 전에 Alembic 기준 마이그레이션 만들기 (ADR-0008 결정 9)
- [ ] (Phase 3 전) 2단계 인증 검토

### 그 밖의 Phase 2

- [ ] 브라우저 즐겨찾기 → 서버 동기화 (로그인하면 localStorage 목록을 가져옴)
- [ ] (필요하면) Google OAuth
- [ ] 문의 폼

## Phase 3: Client Room

- [ ] 초대·권한, MinIO 비공개 저장소, 만료형 다운로드 링크
- [ ] 결과물 버전 → 검수 요청 → 승인 → 납품, 요청·피드백 스레드
- [ ] 이메일 알림, 감사 로그, 암호화 백업

## Phase 4: 자동 Life Log + JohnnyBot

- [ ] 외부 피드(GitHub, 블로그, YouTube) 수집
- [ ] Arkurator RAG 재사용으로 JohnnyBot (공개 콘텐츠만)
- [ ] 쿠키 없는 셀프 호스팅 분석
