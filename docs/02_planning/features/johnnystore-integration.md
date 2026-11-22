# 기능: JohnnyStore 통합 (서비스 일원화)

> **상태**: 결정 완료 → [ADR-0011](../../04_architecture/adr/0011-absorb-johnnystore.md) (2026-11-22). 질문은 모두 답했다 (§9). 다음은 §6 의 S0 → S1
> **Last Updated**: 2026-11-22
> **대상**: JohnnyStore. 2026-11-22 에 서비스를 끄고 저장소를 지웠다. 보관본 `~/workspace/backup/johnnystore/johnnystore-20261122.tar.gz`
> (마지막 커밋 `6dc01fe` + 미커밋 24파일 + 데이터, §3-3)
> **바탕**: [ideation.md](../../ideation.md) v2, [PHILOSOPHY.md](../../01_vision/PHILOSOPHY.md) v1, [ARCHITECTURE.md](../../04_architecture/ARCHITECTURE.md),
> [ADR-0004](../../04_architecture/adr/0004-nextjs-static-export.md) ~ [ADR-0011](../../04_architecture/adr/0011-absorb-johnnystore.md), [작품 관리 명세](portfolio-manager.md)

## 0. 요약

- **JohnnyStudio 를 기준으로 흡수한다** (ADR-0011). "JohnnyStore" 이름은 남기지 않는다.
  스토어가 잘하던 것(설치 파일 자동 분석, 버전·검사 결과, 공유 링크·배지·QR)을 JohnnyStudio 의 **데스크톱 앱 배포 기능**으로 옮긴다.
  인증·디자인·배포·검사 체계는 JohnnyStudio 것을 쓴다.
- **파일을 올리는 사람은 운영자뿐이다** (§2-3 의 A).
  다른 사람의 가입·업로드·퍼블리셔 페이지·신고 관리는 만들지 않는다. ideation §8 의 하지 않을 것을 그대로 둔다.
  테스터·의뢰인에게 비공개로 보내는 기능은 Phase 3 Client Room 으로 넘긴다.
- **가장 먼저 할 일은 콘텐츠 이관이다.** 스토어에 있던 운영자 본인의 실제 Windows 앱 9개(설치 파일 180MB, 설명·아이콘·SHA-256)를 작품으로 옮긴다.
  상태·날짜는 스토어와 같게 하고(운영 중, 2026-11-16), WLT·CMG Monitor 는 기존 초안 2개를 대신한다. 원본은 보관본이다.
- **배포·검사**: 설치 파일은 지금처럼 홈 서버(`/files/`)에서만 낸다. 바이러스 검사는 로컬 ClamAV 로 하고 VirusTotal API 는 쓰지 않는다 (§6 S2).
- **스토어 정리 (2026-11-22, 끝남)**
  - 4000 포트가 공인 주소로 열려 있었고, 가입이 `open` 이었다. 먼저 가입을 닫았다
  - 저장소를 지우기로 해서 서비스와 `screen` 세션을 끝냈다
  - 전체를 보관본으로 남겨 확인한 뒤 로컬 저장소를 지웠다 (§3-3, §5 X1)
  - 남은 것은 사용자가 할 일 두 가지다: GitHub 저장소 삭제, 공유기의 4000 포트 전달 삭제

## 1. 두 서비스 (2026-11-22, 제거 전에 확인)

### 1-1. 비교

| 항목 | JohnnyStudio | JohnnyStore |
|---|---|---|
| 정체성 | 정현 님이 만든 모든 것을 모아 보여 주고, 바로 쓰게 하고, 함께 일하는 스튜디오 허브 | 누구나 Windows 프로그램을 드래그 한 번으로 올리고 링크로 공유하는 오픈 앱 스토어 |
| 다루는 것 | 작품 7유형 (웹 서비스, 데스크톱 툴, 웹 패키지, 영상, 사진, 글, 하드웨어) | Windows 설치 파일 (`.exe` `.msi` `.msix` `.zip` `.7z`) |
| 콘텐츠 원본 | git 의 파일 `content/` → 빌드 때 HTML ([ADR-0005](../../04_architecture/adr/0005-file-based-content.md)) | DB 행 + 업로드 파일 (`backend/data/`) |
| 웹 | Next.js 16 정적 내보내기, Tailwind 4 토큰, 다크 기본 + 밝은 테마 | React 19 + Vite 8 SPA (react-router 7), 직접 쓴 CSS 2,821줄, 밝은 기본(종이색 + 코발트) + 다크 |
| API | FastAPI `api/`, Python 3.14, uv, 정확한 버전 고정 + 2주 규칙, 런타임 의존성 4개 | FastAPI `backend/`, pip `>=` 범위, 런타임 의존성 14개 (pefile, icoextract, Pillow, olefile, segno, bcrypt, PyJWT, httpx …) |
| DB | PostgreSQL(운영) · SQLite(개발), 테이블 4개 | SQLite(기본) · PostgreSQL(선택), 테이블 8개, 시작할 때 `create_all` |
| 가입 | 이메일 인증 → 비밀번호 ([ADR-0008](../../04_architecture/adr/0008-password-login.md)) | 이메일 + 비밀번호로 바로 가입 (**이메일 인증 없음**), 약관 동의·만 14세 확인 기록, GitHub·Google OAuth, 가입 정책 open/invite/closed |
| 로그인 상태 | httpOnly `__Host-` 세션 쿠키, DB 에 해시만, Origin 검사 | JWT(7일)를 **localStorage** 에 두고 Bearer 로 보냄, 서명 키 파일 `data/.secret_key` |
| 비밀번호 | scrypt (N=2^17) | bcrypt (SHA-256 선처리) |
| 권한 | 없음 (회원만) | USER / ADMIN (`JS_ADMIN_EMAILS`), 본인 앱만 관리 |
| 올리기 | 운영자만, 개발 서버 전용 관리 도구 (8MB 조각, [ADR-0009](../../04_architecture/adr/0009-local-portfolio-manager.md)) | 로그인한 누구나, 운영 서버에 한 요청으로 스트리밍 (최대 2GB, 하루 20회·5GB) |
| 내려받기 | nginx `/files/<slug>/` 정적, 체크섬은 content 에 기록 | `/d/{코드}` (FastAPI 또는 X-Accel), 다운로드 수, 이어받기, 접근 코드 토큰, 악성 판정 시 차단 |
| 공유 | 작품 상세 주소 | 공유 링크 `/s/`, 바로 받기 `/d/`, QR, SVG 배지, 메신저 봇용 동적 OG |
| 신뢰 표시 | SHA-256·검증 방법·서명 안내 | 위 + PE 서명 블록 유무, VirusTotal 해시 조회 / ClamAV 검사 결과 배지 |
| 운영 문서 | 개인정보처리방침 초안 (운영자·연락처 `TODO`) | 이용약관 + 개인정보처리방침 (VirusTotal 국외 이전, 만 14세, 신고·저작권법 절차), 신고·차단 관리 화면, 백업 스크립트 |
| 보안 헤더 | 페이지별 해시 CSP, `style-src 'self'`, `check_site.py` | CSP 없음, 안내 페이지에 인라인 `<style>` |
| 공개 경로 | Cloudflare Tunnel → nginx `127.0.0.1:8081` → API `8082` ([ADR-0006](../../04_architecture/adr/0006-cloudflare-tunnel.md)) | 예시 설정: nginx `:80` + certbot, uvicorn `127.0.0.1:8000` (**Arkurator 와 같은 포트**) |
| 실행 | 개발: `dev.sh` (3000 · 3001 · 3002) | `screen` 세션 `JohnnyStore` 에서 uvicorn `0.0.0.0:4000`, 공인 주소로도 응답 → 2026-11-22 가입을 닫았다가 껐다 |
| 검사 | `check.sh`: 웹 109 + API 55 + 빌드 결과 | pytest 57 통과 · 1 건너뜀 (2026-11-22 실행), 웹은 `tsc` 빌드만 |
| 코드 양 | — | 백엔드·테스트 4,544줄 + 프런트엔드 7,071줄 |
| git | 커밋 3개 + 미커밋 (작품 관리 기능) | 커밋 2개 + 미커밋 24파일 (신고·탈퇴·정책·백업). 2026-11-22 보관본으로 남기고 제거 |

### 1-2. 실제 데이터

스토어 DB 를 읽기 전용으로 열어 확인했다.

- 회원 1명(운영자), 앱 9개(모두 PUBLIC, 운영자 소유), 신고 0건, 저장 파일 180MB
- 9개 모두 2026-11-16 02:27(KST)에 한꺼번에 등록됐다 (`tools/register_apps.py`). 버전은 앱마다 하나씩이다
- 바이러스 검사는 설정이 없어서 모두 `HASH_ONLY` 다. 9개 모두 x64, 서명 블록 없음, 스크린샷 없음(아이콘만)
- 다운로드 기록 합계 16회. 주소를 밖에 공유한 적은 없다 (Q5, 사용자 확인)
- 앱 목록과 이관 대응은 [부록 A](#부록-a-이관-대상-앱)

JohnnyStudio 의 데스크톱 초안 2개와 **같은 앱**이 있다 (2026-11-22 사용자 확인).
초안은 공개된 적이 없고, Life Log·서비스(`profile.yaml`)도 가리키지 않는다 (확인함). 그래서 스토어 slug 로 바꿔도 깨지는 링크가 없다.

| JohnnyStudio 초안 (지운다) | JohnnyStore 앱 (이 slug 로 만든다) | 스토어 설명 |
|---|---|---|
| `ssh-terminal` SSH 터미널 클라이언트 | `wlt` WLT 0.3.2 | "로컬 셸과 SSH 서버를 탭과 분할 화면으로 함께 쓰는 Windows용 경량 터미널" |
| `hardware-monitor` 하드웨어 모니터링 앱 | `cmg-monitor` CMG Monitor 1.0.0 | "CPU · 메모리 · GPU 사용량을 실시간으로 보여 주는 Windows용 시스템 모니터" |

이미 같았던 것: 로고 파일 3개(스토어의 `JohnnyStudio/*.png` 와 `docs/*.png`, md5 일치), Pretendard 글꼴, React 19, FastAPI + SQLAlchemy 2.x, 한국어 UI.

## 2. 철학 검토

### 2-1. 잘 맞는 곳

| JohnnyStudio 원칙 | JohnnyStore 가 더해 주는 것 |
|---|---|
| User-Centric Accessibility (로그인 없이, 두 번의 클릭) | 로그인 없이 받기, 링크 하나로 받기(`/d/`), QR, README 배지 |
| Trust by Design (체크섬·변경 내역 공개) | 설치 파일 자동 분석(아키텍처·서명 블록), 바이러스 검사 결과와 검사 엔진 표시, 악성 판정 시 차단. ideation R3 의 "바이러스 검사 결과 링크"에 해당한다 |
| Digital Twin & Life Log | 버전마다 릴리스 노트와 날짜 → Life Log 의 `release` 항목과 이어진다 |
| Seamless Collaboration (Phase 3 Client Room) | `UNLISTED`(링크 전용)·`PROTECTED`(접근 코드) 공유와 15분짜리 다운로드 토큰 → Client Room 의 "만료형 다운로드 링크"를 설계할 때 참고 |
| 운영 준비 | 신고·차단 절차, 이용약관·방침 문안, 백업·복구 절차 → JohnnyStudio 에서 비어 있는 운영 문서(방침 `TODO`, DB 백업 미정)의 참고 자료 |

### 2-2. 부딪히는 곳

| # | 쟁점 | JohnnyStudio 기준 | JohnnyStore | 결론 |
|---|---|---|---|---|
| P1 | 누가 올리나 | 하지 않을 것 "의뢰인이 아닌 사람의 파일 업로드는 받지 않는다" (ideation §8) | 누구나 가입해서 올린다 | **운영자만 올린다** (§2-3, ADR-0011) |
| P2 | 정체성 | "정현 님이 만든 모든 것" | "누구나 만든 Windows 앱" (부제는 "JohnnyStudio 앱을 누구나 쉽게 받고 올리는 …") | 운영자 앱만 남고 이름도 남기지 않으므로 정체성이 하나로 모인다 |
| P3 | 커뮤니티 | 하지 않을 것 "범용 SNS·커뮤니티 기능" | 퍼블리셔 프로필 `/@username`, 인기 차트 | 만들지 않는다. 다운로드 수는 내부 지표로만 본다 |
| P4 | 원본의 자리 | 콘텐츠 원본은 git 의 파일 (Sovereignty, ADR-0005) | 원본이 DB | 운영자 앱은 파일이 원본이다 (§4-1) |
| P5 | 신뢰 수준 | httpOnly 쿠키, 이메일 인증, 해시 CSP | localStorage JWT, 이메일 인증 없음, CSP 없음 | JohnnyStudio 쪽으로 맞춘다. 스토어 인증 코드는 가져오지 않는다 |
| P6 | 외부 의존 | 외부 서비스는 배포 채널·관문으로만 | VirusTotal(미국)·GitHub·Google OAuth | 로컬 ClamAV 만 쓴다. VirusTotal API·OAuth 는 가져오지 않는다 (OAuth 는 Phase 2 "필요하면 Google OAuth" 때 참고) |
| P7 | 1인 운영 (ideation R1) | 단계마다 출시 가능한 결과, 기술은 필요할 때 | 신고 처리·법정 통지·할당량·검사가 상시 운영 업무 | 운영자 전용이라 상시 운영 업무가 생기지 않는다 |

### 2-3. 개방 범위: 세 가지 선택지 → A 로 결정

| 선택지 | 누가 올리나 | 누가 받나 | 철학 | 운영 부담 | 법적·평판 위험 |
|---|---|---|---|---|---|
| **A. 운영자 전용** ✅ | 운영자 | 누구나 (공개) | 그대로 맞다 | 낮음 | 낮음 (자기 작품) |
| B. A + 비공개 공유 | 운영자 | 공개 + 링크·접근 코드를 받은 사람(테스터·의뢰인) | 맞다 (Collaboration 강화) | 중간 (만료·접근 기록) | 낮음 |
| C. 오픈 퍼블리싱 | 가입한 누구나 | 누구나 | 하지 않을 것을 바꿔야 한다 | 높음 (신고·검사·할당량·통지) | 높음. 남이 올린 악성코드·불법 복제물의 배포처가 된다 |

**결정 (2026-11-22, 사용자): A. 올리는 사람은 운영자뿐이다.**

- B 는 이 통합에 넣지 않는다. Phase 3 Client Room 의 납품 기능을 설계할 때 스토어의 링크 전용·접근 코드·다운로드 토큰을 참고한다 (§6 S4).
- C 는 하지 않는다. 다시 필요해지면 새 ADR 로 하지 않을 것을 바꾸고, 남이 올린 파일은 **포털과 다른 등록 도메인**에서 내준다 (§6 S5).
  남이 올린 악성 파일 하나 때문에 포털 도메인 전체가 브라우저의 위험 사이트 경고(Safe Browsing 등)를 받을 수 있다. 하위 도메인만으로 평판이 분리되는지는 확인이 필요하다 `[확인 필요]`.

### 2-4. 통합 뒤 철학 문구 (제안. S2 에서 기능이 생기면 PHILOSOPHY · ideation 에 반영)

- **한 문장 정의는 그대로 둔다.** "바로 써 보게 하고"가 스토어의 "쉽게 받고"를 이미 담는다.
- **Trust by Design** 실천 기준 추가: 설치 파일마다 버전·크기·SHA-256·아키텍처·서명 여부·바이러스 검사 결과(엔진·시그니처 날짜)를 보여 준다. 검사에서 위험이 나온 파일은 내보내지 않는다.
- **User-Centric Accessibility** 실천 기준 추가: 링크 하나로 받는다. 앱마다 공유 링크·바로 받기 링크·배지·QR 을 준다.
- **하지 않을 것**: 그대로 둔다 (A). PHILOSOPHY 의 결정 기록에 ADR-0011 을 남겼다.
- **브랜드**: "JohnnyStore" 이름은 남기지 않는다 (Q2). 데스크톱 앱은 Library 안에서 보여 준다.

## 3. 일원화 방식

### 3-1. 선택지 → 흡수 통합

| 방식 | 내용 | 장점 | 단점 | 판단 |
|---|---|---|---|---|
| 나란히 두기 | `store.<도메인>` 에 JohnnyStore 를 그대로 운영하고 링크만 연결 | 일이 가장 적다 | 인증·디자인·배포·검사가 두 벌이다. "하나의 서비스"가 아니다. 스토어의 보안 수준(P5)이 그대로 남는다 | 하지 않음 |
| **흡수 통합** | JohnnyStudio 가 기준. 스토어 기능을 `api/`·`web/`·관리 도구로 옮긴다 | 인증·디자인·배포가 하나다. 원칙(파일 원본, 해시 CSP)을 지킨다 | 스토어 화면은 다시 만들어야 한다 | **결정 (ADR-0011)** |
| 스토어를 기준으로 | JohnnyStudio 를 스토어(SPA + JWT)에 넣는다 | 동적 기능이 이미 있다 | 정적 HTML·검색 노출·CSP·인증 수준이 내려간다. ADR-0004·0007·0008 을 뒤집는다 | 하지 않음 |

### 3-2. 무엇을 가져오고 무엇을 버리나

출처는 모두 보관본이다 (§3-3).

| JohnnyStore 모듈 | 처리 | 어디로 | 단계 |
|---|---|---|---|
| DB 의 앱 9개 + 설치 파일 + 아이콘 | **이관** | `content/assets/<slug>.md`, 다운로드 보관 폴더 `<slug>/`, `web/public/media/<slug>/` | S1 |
| `pe_extractor.py` (582줄) + 테스트 10개 | **가져온다** (거의 그대로) | `api/app/binaries/` | S2 |
| `scanner.py` 의 ClamAV 부분 | `clamscan` 실행 방식으로 고쳐 가져온다 | `api/app/binaries/scan.py` | S2 |
| `scanner.py` 의 VirusTotal 부분 | **버린다** (Q6) | — | — |
| `sharing.py` 배지 SVG | 방식만 가져온다 (TS 로 다시 쓰고 빌드 때 만든다) | `web/` 빌드 단계 | S3 |
| `sharing.py` QR (segno) | 빌드 때 만든다 (도메인이 정해진 뒤) | 빌드 단계 | S3 |
| `routers/share.py` 의 `/d/` (최신 버전 바로 받기) | 방식만 | 정적 `/d/<slug>/` | S3 |
| `sharing.py` 봇 감지 + 동적 OG | **버린다** | 정적 페이지는 빌드 때 OG 를 넣는다 (`generateMetadata`) | S2 |
| `storage.py` (스트리밍 저장 + SHA-256) | 가져오지 않는다 | 관리 도구에 조각 업로드가 이미 있다 | — |
| `models.py` 의 공개 범위·PIN, `share.py` 의 잠금 해제·다운로드 토큰 | 가져오지 않는다 | Phase 3 Client Room 설계 때 참고 | (Phase 3) |
| `routers/auth.py` 가입·로그인·JWT, `security.py`, `deps.py` | **버린다** | 회원 API 가 유일한 인증 | — |
| `routers/auth.py` 의 OAuth 흐름 (검증된 이메일만 기존 계정에 연결) | 참고 | Phase 2 "(필요하면) Google OAuth" 때 쿠키 세션에 맞춰 다시 쓴다 | 필요할 때 |
| `ratelimit.py` (프로세스 메모리) | 버린다 | — | — |
| `routers/report.py` · `admin.py`, 신고 모델, 이용약관 | **버린다** (A: 남의 파일을 받지 않는다) | — | — |
| `LegalPages.tsx` 개인정보처리방침 문안 | 참고 | Phase 2·3 에서 `content/pages/privacy.md` 를 보강할 때 | — |
| `deploy/backup.sh` (하드 링크 스냅숏, 보관 기간, 원격 복제) | 참고 | JohnnyStudio DB 백업 할 일 (ROADMAP Phase 2) | — |
| `frontend/` 전체 (React SPA, CSS) | **버린다**. UX 만 참고 | 드롭해서 채우는 등록 → 관리 도구, 공유 키트 → 상세 화면 | S2·S3 |
| `tools/register_apps.py` 카탈로그, `collect_icons.py` | 이관 입력으로만 | — | S1 |
| `deploy/nginx.conf` · `johnnystore.service` | 버린다 | — | — |

"참고"로 남긴 것(OAuth·방침 문안·백업 스크립트)은 보관본을 지우면 함께 사라진다. 보관본을 지우기 전에 필요한 부분을 옮길지 정한다 (§6 마무리).

### 3-3. 저장소 정리 (2026-11-22)

사용자 결정(Q9)에 따라 johnnystore 저장소를 지웠다. 이관과 코드 이식에 원본이 필요하므로 지우기 전에 전체를 보관했다.

| 순서 | 한 일 | 결과 |
|---|---|---|
| 1 | 스토어 프로세스 종료, `screen` 세션 `JohnnyStore` 종료 | 4000 포트 닫힘 |
| 2 | SQLite WAL 을 DB 파일에 합침 (`wal_checkpoint(TRUNCATE)`, `journal_mode=DELETE`), `integrity_check` | `ok`, 앱 9 · 릴리스 9 · 회원 1. DB 가 파일 하나가 됐다 |
| 3 | 보관: `~/workspace/backup/johnnystore/johnnystore-20261122.tar.gz` (권한 폴더 700, 파일 600, 188MB, `.sha256` 함께) | 소스·`.git`·미커밋 작업·`backend/.env`·`backend/data/` 포함. `.venv`·`node_modules`·`dist`·캐시는 뺐다 (다시 만들 수 있다) |
| 4 | 보관본을 임시 폴더에 풀어서 확인 | 설치 파일 9개 SHA-256·크기가 DB 와 일치, 아이콘 9개, 설명 전체, git 커밋 2개 + 미커밋 변경 |
| 5 | 로컬 저장소 `~/workspace/johnnystore` 삭제 | |
| 6 | GitHub 저장소 `Jounghyunkim/johnnystore` | **사용자가 지운다.** gh 토큰에 `delete_repo` 권한이 없다 |

- 보관본에는 운영자 이메일·비밀번호 해시(bcrypt)·JWT 서명 키가 들어 있다. git 에 넣지 않고, 이식(S1·S2)이 끝나면 지운다.
- 커밋 메시지에는 출처를 `johnnystore 6dc01fe (보관본)` 처럼 쓴다. 스토어 이력은 `git subtree` 로 들이지 않는다.

## 4. 구조

### 4-1. 운영자 작품 한 층

```
운영자 작품 (공개)                    원본: content/ 파일 (git)  →  빌드 때 정적 HTML
Library, 작품 상세, 다운로드           파일: /opt/johnnystudio/files/<slug>/  (nginx 가 바로 내준다)
← 스토어의 앱 9개가 여기로              분석·검사: 서버(M8) 안의 관리 도구에서 올릴 때 하고, 결과를 content 에 기록
```

- 운영자 작품은 지금처럼 git 으로 검토하고 되돌릴 수 있다. 운영 서버에 "작품을 올리는 길"이 생기지 않는다 (ADR-0009 의 판단과 같다).
- 이 통합에는 동적으로 도는 새 서버 코드가 없다. 회원 API 는 바뀌지 않는다.
- 공개하지 않는 배포(DB + 비공개 저장소)는 Phase 3 Client Room 에서 정한다.

### 4-2. 저장소 구조 (통합 후)

```
JohnnyStudio/
├── web/
│   ├── src/app/library/[slug]/        데스크톱 앱 상세 (아이콘, 버전 이력, 검사 결과, 공유)
│   ├── src/app/d/[slug]/              (S3) 바로 받기 페이지 (정적, 최신 파일로 곧바로 이동)
│   ├── src/lib/admin/                 (S2) 관리 도구: 설치 파일을 놓으면 분석 결과로 채운다
│   └── scripts/build-share-kit.mjs    (S3) 배지 SVG · QR 생성
├── api/app/
│   ├── auth.py …                      기존 회원 (바뀌지 않음)
│   └── binaries/                      (S2) pe_extractor · scan(ClamAV) · CLI (python -m app.binaries.inspect). 관리 도구가 부른다. HTTP 엔드포인트는 없다
└── content/assets/<slug>.md           (S1) 이관한 앱 9개
```

### 4-3. 요청 경로

```
방문자 → Cloudflare → cloudflared → nginx 127.0.0.1:8081
   ├─ /library/<slug>/        정적 (데스크톱 앱 상세: 아이콘·버전·검사·공유 키트)
   ├─ /d/<slug>/              정적 (S3) → /files/<slug>/<파일> 로 이동
   ├─ /badge/<slug>.svg       정적 (S3)
   ├─ /files/                 정적 다운로드 (기존)
   └─ /api/                   회원 API (기존, 바뀌지 않음)
```

새 포트가 없고, nginx 설정도 바뀌지 않는다. 스토어의 8000(Arkurator 와 충돌)·4000 은 쓰지 않는다.

### 4-4. 주소 대응 (스토어 → 통합 후)

옛 주소는 밖에 공유한 적이 없어서 리다이렉트를 두지 않는다 (Q5).

| 스토어 | 통합 후 | 비고 |
|---|---|---|
| `/` (탐색·검색·분류) | `/library/?type=desktop-app` | 분류는 태그로 옮긴다. 인기 차트는 두지 않는다 (P3) |
| `/@johnny/<slug>`, `/s/<코드>` | `/library/<slug>/` | |
| `/d/<코드>` | `/d/<slug>/` | |
| `/badge/<코드>.svg` · `/qr/<코드>.svg` | `/badge/<slug>.svg` · 상세 화면의 QR | |
| `/me` (내 앱 관리) | 관리 도구 `/admin/` (개발 서버 전용) | |
| `/privacy` | `/privacy/` | `/terms` 는 없앤다 (남의 업로드를 받지 않는다) |
| `/admin` (신고 관리) | 없음 | |

### 4-5. 인증·권한

- 회원 API(ADR-0007·0008)가 **유일한 인증**이다. 스토어의 JWT·bcrypt·즉시 가입·OAuth 는 가져오지 않는다.
- 스토어 회원은 운영자 1명뿐이라 **옮길 계정이 없다.**
- 이 통합에서는 **권한이 필요 없다.** 운영자 작업은 모두 서버 안의 관리 도구(ADR-0009, 토큰)에서 한다. 관리자 역할·퍼블리셔 핸들은 만들지 않는다.

### 4-6. 데이터·파일

| 무엇 | 어디 | git | 백업 |
|---|---|---|---|
| 앱 설명·버전·체크섬·검사 결과 | `content/assets/<slug>.md` | 예 | git 원격 |
| 앱 아이콘 (256px) | `web/public/media/<slug>/icon.png` (또는 webp) | 예 | git 원격 |
| 공개 설치 파일 | `/opt/johnnystudio/files/<slug>/` (서버 설정 전에는 `.local/files/<slug>/`) | 아니오 | 원본 빌드 폴더 + 서버 사본 `[확인 필요: 외부 사본]` |
| 스토어 보관본 | `~/workspace/backup/johnnystore/` | 아니오 | 이식이 끝나면 지운다 |

### 4-7. 디자인

- 스토어 CSS 는 가져오지 않는다. 화면은 JohnnyStudio 토큰(`globals.css` 의 `@theme`)과 컴포넌트로 다시 만든다.
  검사 결과 배지에 성공·경고 색이 필요하다. 토큰이 없으면 [DESIGN_SYSTEM](../../03_design/DESIGN_SYSTEM.md) 에 두 테마 값으로 더한다.
- 가져올 UX
  - 드롭해서 채우는 등록: 관리 도구의 "새 작품"에 설치 파일을 놓으면 데스크톱 앱 초안이 채워진다 (S2)
  - 공유 키트: 상세 화면의 "공유" 묶음 (링크 복사, 바로 받기 링크, 배지 코드, QR) (S3)
  - 검사 결과 배지: 다운로드 버튼 옆 (S2)
- 데스크톱 앱 카드는 대표 이미지가 없으면 아이콘을 쓴다. 스토어 앱 9개는 스크린샷이 없어서 아이콘이 카드의 얼굴이 된다.

## 5. 보안·운영: 옮기면서 고칠 것

| # | 스토어 | 문제 | 통합 후 |
|---|---|---|---|
| X1 | `0.0.0.0:4000`, `.env` 없음 → 가입 정책 `open`, `JS_BASE_URL` 빈 값 | 공인 주소의 4000 포트로 응답했다 (공유기 주소로 `/api/health` 200, 대조로 Arkurator 443 응답). 누구나 가입해서 하루 5GB 까지 올릴 수 있었다 | **끝남 (2026-11-22)**: 가입을 닫았다가(`/api/v1/meta` → `closed` 확인), 저장소 제거 결정에 따라 서비스를 끄고 지웠다. 4000 은 이제 아무것도 듣지 않는다. 공유기의 4000 포트 전달은 사용자가 지운다 |
| X2 | 운영 설정 예시가 `127.0.0.1:8000` | Arkurator 가 쓰는 포트다 (AGENTS.md §8) | 별도 서비스로 두지 않는다 |
| X3 | JWT 를 localStorage 에 둔다 | XSS 한 번이면 토큰을 가져간다 | 가져오지 않는다 (httpOnly 세션 쿠키가 기존 방식) |
| X4 | 이메일 인증 없이 가입 | 남의 이메일로 가입할 수 있다 | 가져오지 않는다 |
| X5 | 안내·OG 페이지에 인라인 `<style>`, CSP 없음 | JohnnyStudio CSP(`style-src 'self'`) 아래에서 깨진다 | 가져오지 않는다. 모두 정적 페이지 |
| X6 | 한 요청으로 최대 2GB 업로드 | Cloudflare 를 거치는 요청은 본문 크기 한도가 있다 (무료 요금제 100MB `[확인 필요]`) | 운영 서버로 웹 업로드하는 길을 만들지 않는다. 관리 도구는 서버 안에서 8MB 조각으로 올린다 |
| X7 | 요청 제한이 프로세스 메모리에 있다 | 다시 시작하면 풀린다 | 해당 없음 (가져오지 않는다) |
| X8 | 의존성이 `>=` 범위 | 재현이 안 되고 2주 규칙과 맞지 않는다 | `api/pyproject.toml` 에 정확한 버전 + `uv lock`. 스토어 가상환경(Python 3.14.4)에서 pefile 2024.8.26, icoextract 0.3.1, Pillow 13.0.0, olefile 0.47 로 테스트가 통과했다. 고를 때 2주 규칙을 다시 본다 |
| X9 | icoextract 가 "Python 3.19 에서 오류가 된다"는 경고를 낸다 | 오래 쓰면 호환이 깨진다 | 기록만 한다. 필요해지면 Pillow 로 ICO 를 직접 읽는 대안을 본다 |
| X10 | VirusTotal 해시 조회(미국), 설정하면 파일도 보낸다 | 제3자 전송, API 키·외부 의존 | **쓰지 않는다** (Q6). 로컬 ClamAV 만 쓴다. 상세 화면에는 "VirusTotal 에서 이 SHA-256 찾아보기" 외부 링크만 둔다 (방문자가 직접 확인하고, 사이트는 아무것도 보내지 않는다) |
| X11 | 다운로드 수를 DB 에 올린다 (IP 는 저장 안 함) | 문제 없다 | nginx `files.log` 집계 (기존 계획). 화면에 공개하지 않는다 |
| X12 | 서명 표시가 "서명 블록이 있는지"만 본다 | "서명됨"으로 오해할 수 있다 | 화면 문구를 "서명 포함 (유효성은 확인하지 않음)"으로. 유효성 검증은 코드 서명 결정(ideation §9-5) 뒤에 |
| X13 | 큰 파일(CMG Monitor 118MB)을 홈 서버에서 낸다 | 가정 회선 대역폭 (ideation R7) | 그대로 홈 서버에서만 낸다 (Q7). 공개할 때 Cloudflare 경유 대용량 다운로드의 캐시·약관을 확인한다 `[확인 필요]` |

## 6. 세부 구현 계획

각 단계는 따로 출시할 수 있다.

| 단계 | 결과 | 크기 | 먼저 있어야 할 것 |
|---|---|---|---|
| S0 준비 | JohnnyStudio 미커밋 작업 정리 | 작음 | — |
| S1 콘텐츠 이관 | 앱 9개가 Library 에 공개 | 작음~중간 | S0 |
| S2 배포 엔진 | 설치 파일을 놓으면 분석·아이콘·ClamAV 검사까지 자동, 상세 화면에 신뢰 정보·OG | 중간 | S1, ClamAV 설치(사용자) |
| S3 공유 키트 | 바로 받기 링크·배지·QR | 작음 | S2, 도메인(ideation §9-1) |
| 마무리 | 보관본 삭제, GitHub 저장소·공유기 포트 정리 | 작음 | S2 (코드 이식 뒤) |
| ~~S4 비공개 공유~~ | 이 통합에서 뺌 → Phase 3 Client Room | — | — |
| ~~S5 오픈 퍼블리싱~~ | 하지 않음 (ADR-0011) | — | — |

### S0. 준비

- [x] 결정: Q1 ~ Q9 → ADR-0011 (2026-11-22)
- [x] X1: 4000 포트 외부 노출 확인 → 가입 닫음 → 서비스 종료 (2026-11-22)
- [x] johnnystore: 커밋 대신 전체(미커밋 작업·데이터 포함)를 보관본으로 남기고 로컬 저장소를 지웠다 (§3-3)
- [x] JohnnyStudio 의 미커밋 작업을 커밋했다 (2026-11-22: 작품 관리 `f336188`, 이 문서·ADR-0011 은 다음 커밋)

### S1. 콘텐츠 이관

**목표**: 스토어의 앱 9개를 JohnnyStudio 작품(`desktop-app`)으로 옮긴다. 글은 운영자가 쓴 스토어 설명을 그대로 쓰고, 없는 값은 지어내지 않는다.

필드 대응:

| 스토어 | JohnnyStudio | 처리 |
|---|---|---|
| `slug` | 파일 이름 `<slug>.md` | 그대로. `wlt`·`cmg-monitor` 는 초안 `ssh-terminal`·`hardware-monitor` 를 대신한다 (Q3). 초안 2개는 지운다 (관리 도구의 삭제 → `.local/trash/`) |
| `name` | `title` | 그대로 |
| `summary` (160자 이하) | `summary` (140자 이하) | 그대로 (9개 모두 127자 이하, 확인함) |
| `description` (■ 제목, • 목록) | 본문 Markdown | 형식만 바꾼다 (■ → `##`, • → `-`). 내용은 바꾸지 않는다. 설명 안의 필요 환경 문단은 `requirements` 로 옮길 수 있다 |
| `category` | `tags` | 한국어 이름(유틸리티·생산성·개발 도구·미디어·보안·시스템) + `데스크톱`. 지우는 초안의 태그(`SSH`, `모니터링`)는 해당 앱에 더한다 |
| 아이콘 (`icon_file`, 256px PNG) | `icon` (S2 에서 새 필드) | 우선 `web/public/media/<slug>/icon.png` 로 복사만 한다. `cover` 는 가로 이미지 자리라 쓰지 않는다 |
| 최신 릴리스 | `downloads[0]` | `label` "Windows 설치 파일", `file` `/files/<slug>/<파일 이름>`, `version`, `os: [windows]`, `size`, `sha256`, `signed`, `notes` ← 릴리스 노트 |
| 설치 파일 | 다운로드 보관 폴더 `<slug>/` | 관리 도구 규칙대로 `/opt/johnnystudio/files` 가 있으면 그곳, 없으면 `.local/files` (지금은 서버 설정 전이라 없다. 서버 설정 뒤 옮긴다). 복사한 뒤 SHA-256 을 다시 계산해서 DB 값과 맞춰 본다. 파일 이름의 공백은 `-` 로 바꾸기를 권한다 (주소 인코딩 문제 방지. 체크섬은 그대로) |
| (스토어에 공개된 상태) | `status: live` (운영 중) | 스토어와 같게 (Q4). 버전이 0.x 인 앱(Johnny-Dir, SmartFolder Organizer, SentinelLite-AV, WLT)도 같다 |
| 스토어 등록 시각 2026-11-16 02:27 (KST) | `date: 2026-11-16`, `downloads[0].released: 2026-11-16` | 스토어와 같게 (Q4). 스토어에 처음 공개한 날이다 |
| (스크린샷 없음) | `cover` 없음 | 아이콘을 쓴다 (S2) |

할 일:

- [ ] 보관본을 `.local/import/johnnystore/` 에 푼다 (git 제외 폴더). 이관이 끝나면 푼 폴더를 지운다
- [ ] 1회용 이관 스크립트 `web/scripts/admin/import-johnnystore.ts`
  - 스토어 DB 를 **읽기 전용**으로 연다. Node 26 내장 `node:sqlite` 를 쓴다 (새 의존성 없음. 읽기 전용으로 열리는 것을 확인함)
  - `lib/admin/store.ts` 의 만들기·저장 함수를 거쳐 쓴다 (스키마 검사·키 순서·주석 보존을 그대로 탄다). 초안으로 만들고, 확인한 뒤 공개한다
  - 설치 파일·아이콘 복사, SHA-256 재계산·비교, `--dry-run`
  - 끝나면 스크립트는 지우고, 실행 기록은 dev_history 에 남긴다
- [ ] 결과 확인: `npm --prefix web run admin -- check`, 관리 화면에서 9개를 보고 공개한다 (`publish`)
- [ ] Life Log: 2026-11-16 에 앱마다(또는 한 줄로 묶어) `release` 항목을 더할지 (운영자 확인)
- [ ] SITEMAP 콘텐츠 목록, PHILOSOPHY §5 의 등록 대기 목록, ROADMAP Phase 1 콘텐츠 체크박스

완료 기준: 출시 빌드의 Library 에 앱 9개가 보이고, 상세 화면에서 설치 파일을 받으면 SHA-256 이 맞는다. `./scripts/check.sh` 통과.

### S2. 배포 엔진 (관리 도구 + 상세 화면)

**목표**: 스토어의 "30초 등록"을 운영자용으로 가져온다. 설치 파일을 놓으면 이름·버전·아키텍처·아이콘·체크섬·서명 블록·검사 결과가 채워진다.

**바이러스 검사 방식 (Q6, 사용자가 맡긴 판단)**

| 방식 | 판단 | 이유 |
|---|---|---|
| **로컬 ClamAV, 올릴 때 `clamscan` 실행** | **채택** | 파일이 서버 밖으로 나가지 않는다 (Sovereignty). 올리는 일이 가끔이라 실행할 때마다 시그니처를 읽는 시간(수십 초 `[확인 필요]`)을 감수할 만하다 |
| 로컬 ClamAV, 상주 `clamd` | 하지 않음 | 시그니처를 메모리에 계속 올려 둔다 (약 1GB 이상 `[확인 필요]`). M8 은 Arkurator·PostgreSQL 도 돌린다 |
| VirusTotal 해시 조회 (API 키) | 하지 않음 | 새로 빌드한 설치 파일은 대부분 VirusTotal 에 기록이 없어서 "기록 없음"만 나온다. 결과를 얻으려면 파일을 제3자에게 보내야 한다. API 키·외부 의존이 생긴다. 공개 API 의 이용 조건(상업적 이용 제한)도 확인해야 한다 `[확인 필요]` |
| VirusTotal 검색 링크 (상세 화면) | **채택** | 방문자가 원하면 SHA-256 으로 직접 찾아본다. 사이트는 아무것도 보내지 않는다 |

- 설치: 사용자가 `sudo apt install clamav` (시그니처 갱신 `clamav-freshclam` 서비스가 함께 깔린다 `[확인 필요]`)
- ClamAV 가 없으면 "검사 안 함"으로 기록하고 경고만 한다 (공개는 막지 않는다). S1 에서 옮긴 9개는 ClamAV 를 설치한 뒤 한 번에 검사한다
- 악성으로 나오면 공개를 막는다
- 화면 문구는 "ClamAV (<시그니처 날짜> 기준) 탐지 없음"처럼 엔진과 기준일을 함께 쓴다. "안전 보장"처럼 쓰지 않는다

할 일:

- [ ] ADR-0012: 설치 파일 분석·ClamAV 검사는 관리 도구에서 하고 결과를 content 에 기록한다 (api 의 binaries 모듈을 CLI 로 부른다)
- [ ] `api/app/binaries/`: 보관본의 `pe_extractor.py` 를 옮기고, 테스트 10개를 `api/tests/` 로 옮긴다. 의존성 4개를 정확한 버전으로 고정한다 (X8). 추가 이유를 dev_history 에 쓴다
- [ ] CLI: `uv run --directory api python -m app.binaries.inspect <파일> --icon <png> --json`
  - 관리 서버(Node)가 조각 업로드를 마친 뒤 부른다 (`lib/admin/store.ts`)
  - Python 이 없거나 실패하면 지금처럼 크기·SHA-256 만 채운다
- [ ] `app/binaries/scan.py`: `clamscan --no-summary` 실행, 엔진·시그니처 버전·결과를 JSON 으로 (스토어 `scanner.py` 의 ClamAV 부분을 고쳐서)
- [ ] 스키마 (AGENTS.md 의 순서대로: `schema.ts` → `missingFields()` → `lib/admin/fields.ts` → CONTENT_GUIDE → 테스트)
  - `icon?: MediaPath` (공통): 카드·상세·OG 에 쓴다
  - `Download.arch?: "x64" | "x86" | "arm64"`
  - `Download.scan?: { engine: "clamav", result: "clean" | "infected", signature?: 문자열(시그니처 버전·날짜), checked: PartialDate, detail?: 문자열(탐지 이름) }`
  - `missingFields`: 공개된 데스크톱 앱의 최신 다운로드에 `scan` 이 없으면 **경고**, `result: infected` 면 **공개 불가**
- [ ] 관리 화면: "새 작품"에 설치 파일을 놓으면 데스크톱 앱 초안을 만든다. 기존 작품에 새 버전을 놓으면 `downloads` 맨 앞에 더한다
- [ ] 상세 화면 (`viewers/download-panel.tsx`): 아이콘, 아키텍처, 서명 문구(X12), 검사 배지(엔진·기준일), VirusTotal 검색 링크(`ExternalButton`), 이전 버전 접기
- [ ] 카드: 데스크톱 앱은 아이콘 표시
- [ ] `library/[slug]/page.tsx` 의 `generateMetadata` 에 `openGraph`(제목·소개·아이콘 또는 대표 이미지)를 넣는다. 메신저 미리보기를 정적으로 해결해서 스토어의 봇 감지를 대신한다 (ROADMAP 출시 체크리스트의 OG 이미지와 같은 일)
- [ ] PHILOSOPHY · ideation 에 §2-4 의 실천 기준 반영

완료 기준: 실제 설치 파일 하나를 관리 화면에 놓으면 초안이 채워지고, 공개한 뒤 상세 화면에 ClamAV 결과가 보인다. API 테스트에 binaries 테스트가 들어가고 `check.sh` 통과.

### S3. 공유 키트

- [ ] `/d/<slug>/` 정적 페이지: "곧 내려받기가 시작됩니다" + SHA-256 을 보여 주고, `<meta http-equiv="refresh">` 로 최신 파일로 이동한다
  - 스크립트가 없어서 CSP 에 영향이 없고, 서버 코드도 필요 없다. 정적 내보내기에서 `<meta>` 를 넣는 방법은 구현 때 확인한다
  - `curl` 같은 도구에는 `/files/…` 주소를 안내한다. 302 리다이렉트가 꼭 필요해지면, 빌드 때 만든 목록(`downloads.json`)을 API 가 읽어 돌려주는 방식으로 바꾼다
- [ ] 배지: 빌드 때 `/badge/<slug>.svg` 를 만든다 (스토어 `render_badge_svg` 를 TS 로 옮김. 새 의존성 없음)
- [ ] QR: 도메인이 정해진 뒤 빌드 때 SVG 로 만든다. 라이브러리는 그때 고른다 (스토어는 segno 1.6.6)
- [ ] 상세 화면 "공유" 묶음: 링크 복사·바로 받기 링크·배지 Markdown/HTML 복사·QR 보기(`<dialog>`). 기존 `CopyButton` 을 쓴다
- [ ] `check_site.py`: `/d/` 페이지의 이동 대상이 실제 `/files/` 경로인지 검사

완료 기준: 메신저에 상세 주소를 붙이면 아이콘·제목이 보이고, README 에 배지를 붙이면 최신 버전이 보인다.

### 마무리

- [x] 스토어 프로세스·`screen` 세션 종료, 로컬 저장소 삭제 (2026-11-22)
- [ ] 사용자: GitHub 저장소 삭제 — `gh auth refresh -h github.com -s delete_repo` 뒤 `gh repo delete Jounghyunkim/johnnystore --yes` (또는 GitHub 웹의 Settings → Delete this repository)
- [ ] 사용자: 공유기에서 4000 포트 전달 지우기
- [ ] 보관본에서 더 옮길 "참고" 자료(OAuth 흐름, 방침 문안, 백업 스크립트)가 있는지 정한 뒤, S2 이식이 끝나면 보관본을 지운다

### S4. (이 통합에서 뺌) 비공개 공유 — Phase 3 Client Room 설계 때 참고

스토어에서 참고할 것: 공개 범위(링크 전용 · 링크 + 접근 코드), 짧은 코드, 접근 코드 해시, 15분 다운로드 토큰, X-Accel-Redirect 로 nginx 에 전송 맡기기. 코드는 보관본에 있다 (보관본을 지우기 전에 필요하면 옮긴다).
스토어에 없어서 더해야 할 것: 만료일, 접근 기록(언제·어떤 파일, IP 는 HMAC), Cloudflare 한도 아래의 조각 업로드, 비공개 저장소(`/opt/johnnystudio/private/`, nginx `internal`), 암호화 백업, 개인정보처리방침 보강.
먼저 있어야 할 것: 회원 API 서버 설치, Alembic 기준 마이그레이션, 관리자 역할.

### S5. (하지 않음) 오픈 퍼블리싱

ADR-0011 의 재검토 조건이 생기면 다음을 먼저 정한다.

- 새 ADR: 하지 않을 것 변경, 운영 기준(신고 처리 기한, 차단 기준)
- 남이 올린 파일을 내줄 **별도 등록 도메인**과 쿠키 없는 출처
- 이용약관·만 14세·신고·저작권법 절차, 법률 검토
- 검사 필수, 할당량, 가입 정책(초대제부터)
- 남의 앱 페이지를 검색에 노출하려면 정적 내보내기로는 안 된다. Next 서버 모드를 다시 검토한다 (ADR-0004·0007 의 재검토 조건)
- 가정 회선 대역폭, Cloudflare 약관의 대용량 바이너리 배포 조건 `[확인 필요]`

## 7. 리스크

| # | 리스크 | 보완 |
|---|---|---|
| M1 | 범위가 커진다 (1인 개발) | 운영자 전용으로 범위를 줄였다. 단계별로 출시한다. S1 만으로도 가치가 있다. 스토어 화면은 옮기지 않는다 |
| M2 | 보관본을 잃는다 (이관·이식의 유일한 원본) | 권한 600, `.sha256` 함께 보관. 이식이 끝나기 전에는 지우지 않는다. `.local/` 이 아니라 `~/workspace/backup/` 에 둔다 (`.local/` 은 통째로 지운 적이 있다) |
| M3 | 콘텐츠를 지어낸다 | 운영자가 쓴 스토어 설명만 쓴다. 상태·날짜는 운영자 답(Q4)으로 정했다 |
| M4 | JohnnyStudio 공개 전까지 앱을 밖에서 받을 곳이 없다 | 주소를 공유한 적이 없어서 영향이 작다 (Q5). 공개(도메인·Tunnel)는 ROADMAP Phase 1 의 할 일 |
| M5 | 큰 파일과 가정 회선 (ideation R7) | 홈 서버에서만 낸다 (Q7). 공개할 때 Cloudflare 캐시·약관 확인 `[확인 필요]` |
| M6 | ClamAV 는 시그니처 기반이라 새로운 악성코드를 놓칠 수 있다 | 자기 빌드만 올리므로 위험이 낮다. 화면에 엔진·기준일을 쓰고 "안전 보장"이라 쓰지 않는다. VirusTotal 검색 링크로 방문자가 더 확인할 수 있다 |
| M7 | Python 분석 모듈이 Node 관리 도구에 엮인다 | CLI(JSON) 경계 하나만 둔다. Python 이 없으면 기능만 줄어든다 |

## 8. ADR

| 번호 | 제목 | 상태 |
|---|---|---|
| [0011](../../04_architecture/adr/0011-absorb-johnnystore.md) | JohnnyStore 를 JohnnyStudio 로 흡수하고, 파일을 올리는 사람은 운영자뿐이다 | 채택됨 (2026-11-22) |
| 0012 (예정) | 설치 파일 분석·ClamAV 검사는 관리 도구에서 하고 결과를 content 에 기록한다 | S2 시작 때 |

## 9. 질문 (모두 답함, 2026-11-22)

| # | 질문 | 답 | 반영 |
|---|---|---|---|
| Q1 | 개방 범위: A 운영자 전용 / B + 비공개 공유 / C 누구나 업로드 | 본인만 → **A** | §2-3, ADR-0011 결정 2 |
| Q2 | "JohnnyStore" 이름을 남길까 | **남기지 않는다** | §2-4, ADR-0011 결정 9 |
| Q3 | WLT·CMG Monitor 가 초안 2개와 같은 앱인가 | **같은 앱** → 스토어 slug 로 초안을 대신한다 | §1-2, §6 S1 |
| Q4 | 앱 9개의 상태·처음 공개한 날·스크린샷 | **JohnnyStore 와 동일** → 운영 중, 2026-11-16, 스크린샷 없음(아이콘) | §6 S1 |
| Q5 | 스토어 링크를 밖에 공유했나 | **공유한 적 없다** → 리다이렉트 없음 | §4-4 |
| Q6 | 바이러스 검사 방식 | **판단을 맡김** → 로컬 ClamAV(`clamscan`)만, VirusTotal API 는 쓰지 않고 검색 링크만 | §6 S2 |
| Q7 | 큰 설치 파일 배포 채널 (ideation §9-6) | **기존과 같이** → 홈 서버(`/files/`)에서만 | ADR-0011 결정 3, X13 |
| Q8 | 4000 포트의 스토어 | **권장대로** → 밖에서 닿는 것을 확인하고 가입을 닫음 (그 뒤 Q9 로 종료) | X1 |
| Q9 | johnnystore 저장소 | **제거** → 보관본을 남기고 로컬 삭제, GitHub 은 사용자가 삭제 | §3-3 |

## 부록 A. 이관 대상 앱

스토어 DB 를 읽기 전용으로 조회한 값 (2026-11-22). 모두 PUBLIC, x64, 서명 블록 없음, 검사 `HASH_ONLY`, 아이콘 있음, 스크린샷 없음.
이관 뒤 상태는 모두 `live`, 날짜는 모두 `2026-11-16` (Q4).

| slug | 이름 | 버전 | 분류 | 설치 파일 | 크기 (MiB) | 비고 |
|---|---|---|---|---|---|---|
| `johnny-mecro` | Johnny Mecro | 1.0.0 | 생산성 | `Johnny Mecro_1.0.0_x64-setup.exe` | 2.7 | 설명에 Chrome·Ollama 필요 안내 |
| `johnny-dir` | Johnny-Dir | 0.1.1 | 유틸리티 | `Johnny-Dir_0.1.1_x64-setup.exe` | 2.0 | 릴리스 노트 없음 |
| `smartfolder-organizer` | SmartFolder Organizer | 0.1.0 | 유틸리티 | `SmartFolder Organizer_0.1.0_x64-setup.exe` | 4.2 | |
| `screen-rec` | Screen-REC | 1.0.0 | 미디어 | `Screen-REC_1.0.0_x64-setup.exe` | 29.8 | |
| `spacesense-ai` | SpaceSense AI | 1.0.0 | 유틸리티 | `SpaceSense AI_1.0.0_x64-setup.exe` | 2.5 | |
| `takescreenshot` | TakeScreenShot | 1.0.0 | 유틸리티 | `TakeScreenShot_1.0.0_x64-setup.exe` | 0.4 | |
| `sentinellite-av` | SentinelLite-AV | 0.1.0 | 보안 | `SentinelLite_0.1.0_x64-setup.exe` | 14.6 | 요약에 "(초기 버전)" |
| `wlt` | WLT | 0.3.2 | 개발 도구 | `WLT_0.3.2_x64-setup.exe` | 5.2 | 초안 `ssh-terminal` 을 대신한다 (Q3) |
| `cmg-monitor` | CMG Monitor | 1.0.0 | 시스템 | `CMG Monitor Setup 1.0.0.exe` | 117.7 | 초안 `hardware-monitor` 를 대신한다 (Q3), 큰 파일 (X13) |

- 보관본 안의 위치: DB `johnnystore/backend/data/johnnystore.db`, 설치 파일 `johnnystore/backend/data/storage/releases/<키>.bin` (DB 의 `releases.storage_key`), 아이콘 `johnnystore/backend/data/storage/icons/<id>.png` (DB 의 `apps.icon_file`)
- 설명 원문은 DB 의 `apps.description` 이다 (1,037 ~ 1,926자). 7개는 `tools/register_apps.py` 의 카탈로그와 이름·요약·설명이 같다 (대조함). WLT·CMG Monitor 는 DB 에만 있다

## 확인한 방법 (2026-11-22)

- 두 저장소의 README·기획(`서비스구현계획.md`)·소스·배포 설정을 읽었다
- 스토어 DB: `sqlite3` 읽기 전용(`mode=ro`) 조회, Node 26 `node:sqlite` 읽기 전용 열기, 카탈로그(`register_apps.py`)와 글 대조
- 스토어 테스트: `backend/.venv` 에서 `pytest tests -q -p no:cacheprovider` → 57 통과, 1 건너뜀 (임시 데이터 폴더 사용)
- 실행 중인 프로세스·포트: `ss -ltn`, `ps`, `screen -ls` (스토어 uvicorn `0.0.0.0:4000` 은 `screen` 세션 `JohnnyStore` 안, Arkurator `127.0.0.1:8000`)
- 4000 포트 외부 노출: 공유기 공인 주소(`johnnyhouse.iptime.org`)로 요청해서 `/api/health` 200. 대조로 같은 주소의 443(Arkurator)이 응답했다 (공유기가 내부 요청도 되돌려 주므로 포트 전달이 있다고 판단)
- 가입 닫기: `backend/.env` 에 `JS_REGISTRATION=closed` → 다시 띄움 → `/api/v1/meta` 의 `registration` 이 `closed`
- 제거: §3-3 의 순서. 보관본을 풀어서 설치 파일 9개 SHA-256·크기, 아이콘 9개, git 이력을 확인한 뒤 지웠다. 4000 포트가 닫힌 것을 확인했다
- 초안 2개의 참조: `content/`·`web/` 검색. 예시 문구(`hardware-monitor` 를 slug 예로 쓴 곳) 말고는 없다
- **확인하지 않은 것**: 바깥 네트워크에서 직접 4000 에 접속하기, Cloudflare 요금제별 한도·약관, ClamAV 의 메모리·실행 시간과 패키지 구성, VirusTotal 공개 API 이용 조건, 저작권법 책임 제한 요건의 세부
