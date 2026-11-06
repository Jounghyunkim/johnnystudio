# JohnnyStudio 포털 로드맵

> **Last Updated**: 2026-11-06
> 제품 단계(Phase 1~4)는 [ideation.md](ideation.md) §6 을 따른다.

## 현재 위치

**Phase 1 (공개 허브) 구현 완료, 공개 준비 중.** 화면·뷰어·콘텐츠 체계·검사·배포 도구는 갖췄다.
**Phase 2 의 회원 가입(이메일 인증)·로그인(이메일 + 비밀번호)을 먼저 구현했다** ([ADR-0007](04_architecture/adr/0007-magic-link-auth-api.md), [ADR-0008](04_architecture/adr/0008-password-login.md)). 로컬에서 동작을 확인했고, 서버 설정과 메일 발송 설정이 남았다.
코드는 GitHub `Jounghyunkim/johnnystudio` 에 올렸다 (2026-11-06). CI 는 아직 없다.
남은 일은 다음 네 가지다.

1. ideation §9 열린 질문에 답한다
2. **실제 콘텐츠**를 채운다 (대표 작품, 서비스, 연락처, 개인정보처리방침의 운영자·연락처)
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
- [x] 검사 파이프라인 (`check.sh`: 타입·린트·테스트 31개·출시 빌드·빌드 결과 검사)
- [x] 배포 도구: 출시 빌드 배포, `/files/`, nginx(127.0.0.1:8081, CSP, 캐시), Cloudflare Tunnel 설정 예시, `file-meta.sh`

### 콘텐츠 ⏳

- [ ] 대표 작품 5~10개 등록: 초안 4개(하드웨어 모니터링, SSH 터미널, Skill Hub, 로봇)의 내용을 채우거나 새로 추가
- [ ] 작품 이미지 (webp), 다운로드 파일 업로드
- [ ] `profile.yaml` 의 서비스 목록·연락처, About 운영자 소개 (`grep -rn "TODO(content)"`)
- [ ] 실제 작품이 생기면 `sample-*` 정리

### 품질 ⏳

- [ ] 브라우저 상호작용 테스트를 저장소에 넣는다 (2026-11-05 에 임시 Playwright 스크립트로 18개 항목 확인함)
- [ ] Lighthouse(성능·접근성) 점검, 스크린리더 확인

### 공개 ⏳

- [ ] 도메인 결정 → DNS 를 Cloudflare 로 ([ADR-0006](04_architecture/adr/0006-cloudflare-tunnel.md))
- [ ] 서버 1회 설정 + Tunnel ([deploy/README.md](../deploy/README.md) §2, §4, sudo 필요: 사용자)
- [ ] 출시 체크리스트 ([deploy/README.md](../deploy/README.md) §7): 색인 허용, sitemap, canonical, OG 이미지
- [x] GitHub 원격 저장소 연결 (2026-11-06, `Jounghyunkim/johnnystudio`, `main` push 완료. 공개 여부 확인 전)
- [ ] CI 로 `scripts/check.sh` 실행

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
