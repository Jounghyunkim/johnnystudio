# 기능: Store (회원이 올린 Windows 앱)

> **상태**: 구현 완료 (개발 서버에서 동작, 운영 서버 설정 전). 결정: [ADR-0012](../../04_architecture/adr/0012-member-store.md) (제안됨, 사용자 확정 전)
> **Last Updated**: 2026-11-27
> **바탕**: [JohnnyStore 통합 검토](johnnystore-integration.md) §2-3·§6 S5, 보관본 `johnnystore 6dc01fe` (분석기·이용약관 문안·분류·신고 사유)

## 왜 (문제와 목적)

- 사용자 요청 (2026-11-24): JohnnyStore 를 JohnnyStudio 의 메뉴 하나로 넣어, 회원도 zip·exe 를 올리고 방문자가 써 볼 수 있게 한다.
- 2026-11-22 에는 "올리는 사람은 운영자뿐"으로 정했다 (ADR-0011). 이번에 하지 않을 것을 바꿨다 (ADR-0012).
- PHILOSOPHY 와의 연결
  - **바로 써 보게**: 로그인 없이 목록·상세·내려받기
  - **Trust by Design**: 올리기 전 검토, 파일마다 SHA-256·아키텍처·서명 블록·ClamAV 결과(엔진·기준일)·VirusTotal 검색 링크
- 원본은 따로다: Library(운영자 작품, `content/` 파일)와 회원 앱(DB + 파일 폴더). Store 목록은 둘을 함께 보여 준다. Library 의 공개된 Windows 앱은 **'공식'** 표시를 달고, 누르면 Library 상세로 간다 (2026-11-24 사용자 요청. 2026-11-26 부터 공식 앱은 DB 에 있고, 2026-11-27 부터 Library 가 이 Store 화면으로 온다, ADR-0014·0015).

## 무엇을 (범위)

- **포함**
  - 회원이 Windows 파일(.exe .msi .msix .zip .7z)을 올린다. 운영자가 승인하면 공개된다 (새 앱·새 버전 모두)
  - 설치 파일 분석: 이름·버전·아키텍처·서명 블록·아이콘을 읽어 양식을 채운다 (JohnnyStore 의 `pe_extractor`)
  - ClamAV 검사 (서버 안, `clamscan`), 탐지되면 자동 반려·삭제
  - 앱 정보 고치기, 아이콘 바꾸기, 새 버전, 버전·앱 지우기, 탈퇴하면 모두 삭제
  - 검색·분류·정렬, 상세(검사 결과·체크섬·확인 방법·VirusTotal 검색 링크·공유 주소 복사)
  - 신고(로그인 없이도), 운영자 검토 화면(승인·반려·다시 검사·숨김·회원 차단·신고 처리)
  - 운영자가 회원 앱의 정보(이름·소개·설명·분류)와 아이콘을 고친다. 검토 상태는 그대로이고, 파일은 못 바꾼다 (2026-11-24 사용자 요청, 약관 제5조 5)
  - 즐겨찾기(☆): 회원 앱 카드·상세에서 넣고, My Studio 의 'Store' 구역에 모인다. 이 브라우저에만 저장한다 (2026-11-24 사용자 요청)
  - My Studio 는 공개 앱 목록(`GET /apps`, 최대 500개)을 한 번 받아 브라우저에서 고른다. 서버는 무엇을 즐겨찾기했는지 모른다. 숨겨지거나 지워진 앱은 건너뛴다
- 올린 사람과 운영자가 앱(모든 버전)이나 버전 하나를 지운다: '내 앱', 앱 상세, 검토 화면. 파일까지 바로 지워지고 되돌릴 수 없다 (2026-11-24 사용자 요청. 운영자 근거는 약관 제10조 1)
  - Store 이용약관 페이지, 개인정보처리방침 보강
- **포함하지 않음**
  - 브라우저에서 실행하는 업로드(웹 zip). 별도 등록 도메인 샌드박스가 먼저다 (ADR-0012 재검토 조건)
  - 링크 전용·접근 코드 같은 비공개 공유 (Phase 3 Client Room, ADR-0011 결정 5)
  - 퍼블리셔 프로필 페이지(`/@이름`), 인기 차트, 다운로드 수 공개 (ideation "범용 SNS·커뮤니티 기능은 만들지 않는다")
  - 공유 키트(바로 받기 `/d/`, 배지, QR): 통합 검토 문서 S3 (운영자 앱 먼저)
  - "JohnnyStore" 이름 (ADR-0011 결정 9 유지. 메뉴는 Store)

- **소개 자료** (2026-11-25, [ADR-0013](../../04_architecture/adr/0013-listing-kit.md), [기능 명세](listing.md)): 기능·화면 그림 10장·사용 방법·질문·만든 이·지원 정보 등 리뷰 글 모양의 소개.
  AI 프롬프트 복사·md/zip 불러오기, 소개 꾸미기(`/store/listing/?app=`), Microsoft Store 제출용 항목. 설명은 10,000자(Markdown 일부), 바뀐 점은 1,500자 (Microsoft Store 한도)

## 화면과 동작

| 주소 | 화면 | 누가 |
|---|---|---|
| `/store/` | 머리글(설명 아래, 가로줄 위)에 **'앱 올리기'**·**'검토'**(운영자만) 버튼. 목록: Library 의 공식 앱(빌드된 HTML 에 들어 있다) + 공개된 회원 앱(API). 검색(이름·소개), 분류 8개, 최신순·이름순은 둘에 같은 규칙. 상태가 주소(`?q=&category=&sort=`)에 남는다. 카드: 아이콘·이름·'공식' 표시·올린 사람(공식은 JohnnyStudio)·분류·소개·버전·크기. 공식 앱에 Microsoft Store 주소(`microsoftStore`)가 있으면 'MS Store' 바로가기. 오른쪽 위 ☆ 즐겨찾기(회원 앱은 `store:<코드>`, 공식 앱은 Library 작품과 같은 slug) | 누구나 |
| `/store/app/?id=<코드>` | 상세: 아이콘·이름·올린 사람, 최신 버전 패널(내려받기, 아키텍처·형식·크기·등록일, 바뀐 점, 검사 배지, VirusTotal 검색 링크, SHA-256 복사·확인 방법, 서명 문구), 소개, 이전 버전(접기), "회원이 올린 앱" 안내, 공유 주소 복사, 신고(`<dialog>`). 공개된 앱이면 즐겨찾기 버튼, 그 옆에 올린 사람·운영자에게 **'편집'**(소개 꾸미기 화면으로). 올린 사람·운영자에게는 앱 지우기·버전마다 '이 버전 지우기'(앱을 지우면 올린 사람은 `/store/mine/`, 운영자는 `/store/manage/` 로), 올린 사람에게 새 버전 올리기. 이름·설명·분류·아이콘은 머리글의 '편집' 하나로 고친다 (2026-11-26: 겹치던 '정보 고치기'·'아이콘 바꾸기'·'검토 화면'을 뺐다) | 누구나 (검토 중인 앱은 올린 사람·운영자만, 남에게는 404) |
| `/store/new/` | 올리기: 로그인 → (처음이면) 표시 이름·약관 동의·만 14세 확인 → 파일 놓기/고르기 → 조각 업로드 진행률 → 분석 결과(아이콘·형식·아키텍처·서명·SHA-256·경고)로 채운 양식 → **검토 요청하기** | 회원 |
| `/store/new/?app=<코드>` | 새 버전 올리기 (버전·아키텍처·바뀐 점만) | 올린 사람 |
| `/store/mine/` | 내 앱: 상태·반려/숨김 사유·검사 결과·내려받기 수, 새 버전·고치기(`<dialog>`)·아이콘 바꾸기·지우기 | 회원 |
| `/store/manage/` | 검토: ClamAV 상태, 검토 대기(파일 정보·올린 사람 이메일, 승인·반려·다시 검사·검토용 내려받기·회원 차단, **편집·아이콘 바꾸기·앱 지우기**), 신고(앱 숨기기·조치함·기각), 최근 공개 앱(편집·숨기기·지우기), 숨긴 앱(편집·다시 공개·지우기). **편집**은 소개 꾸미기 화면(`/store/listing/?app=<코드>`)으로 간다 (2026-11-26, Showroom 줄과 같다. 예전의 정보 고치기 대화상자 대신), 차단한 회원(풀기). 30초마다 새로 읽는다. Store·Showroom 머리글의 **'검토'** 버튼으로 들어온다 (운영자에게만 보인다) | 운영자 |
| `/store/terms/` | Store 이용약관 (`content/pages/store-terms.md`) | 누구나 |

- 페이지는 정적 셸이고, 회원 앱은 브라우저에서 `/api/store/` 로 읽는다 (ADR-0012 결정 8). JavaScript 가 꺼져 있으면 공식 앱만 보인다.
- **공식 앱은 DB 에서 관리한다** (2026-11-26, [ADR-0014](../../04_architecture/adr/0014-official-apps-in-store-db.md)): 운영자 계정이 올린 앱은 API 가 `official: true` 로 내고, 카드·상세에 '공식' 표시와 "JohnnyStudio가 직접 만든 앱입니다" 안내가 붙는다.
  Library 의 데스크톱 앱 11개를 `scripts/import-official.sh` 로 옮겼다 (작품 파일에 `storeApp: <코드>`). 새 버전·고치기·지우기는 회원 앱과 같은 화면에서 한다.
- **Library 의 데스크톱 앱을 누르면 이 Store 앱 화면이 설명 페이지다** (2026-11-27, [ADR-0015](../../04_architecture/adr/0015-library-as-official-view.md)). `/library/<slug>/` 는 이 화면으로 넘겨 주기만 한다.
  Library 목록은 `GET /api/store/apps?official=true` (운영자 계정이 올린 공개 앱만)로 맞춘다. 즐겨찾기는 Library 작품과 이어진 앱이면 slug (Store 목록·상세 모두, `getLibrarySlugs()`)
  My Claude Inspector 0.1.2 는 Store 에 소개 자료 zip 이 잘못 올라가 있어서 `--fix-files` 로 진짜 설치 파일로 바꿨다.
- 작품 파일에서 합치는 공식 앱 (예전 방식, 아직 옮기지 않은 것만): `content.ts` 의 `getOfficialStoreApps()` 가 초안이 아니고 `storeApp` 이 없는 데스크톱 앱 중 Windows 파일이 있는 것을 고른다 (최신 Windows 파일의 버전·크기·공개일, 아이콘 없으면 대표 이미지).
- **공식 항목 지우기** (2026-11-26 사용자 요청: 작품 자체를 지운다): 개발 서버에서 Store 운영자(또는 이 탭에 작품 관리 토큰이 있는 사람)에게 공식 카드마다 휴지통 버튼이 보인다.
  누르면 확인 대화상자(토큰이 없으면 토큰 칸) → 작품 관리 서버(`/__admin/`, ADR-0009)로 초안으로 돌린 뒤 `.local/trash` 로 옮긴다 (관리 화면의 삭제와 같은 규칙). Library 에서도 사라진다.
  Life Log·서비스 소개가 가리키는 작품은 지우지 않고 그 이유를 보인다 (지금 Arkurator). 다운로드 파일은 그대로 둔다. 출시 빌드에는 관리 서버가 없어 버튼이 없다 (`components/store/official-delete.tsx`)
  분류는 작품 태그 중 Store 분류 이름(유틸리티·생산성·개발 도구·미디어·게임·보안·시스템)과 같은 것, 없으면 기타. 합치기·거르기·정렬은 `lib/store.ts` 의 `storeEntries()`
- `/store/new/`·`/store/mine/`·`/store/manage/` 는 색인하지 않는다 (`robots: noindex`).
- 메뉴: Library 다음에 **Store**.

### 상태

```
앱:   검토 대기 ──승인──▶ 공개 ──운영자──▶ 숨김 ──다시 공개──▶ 공개
          └──반려(사유)──▶ 반려 ──새 버전──▶ 검토 대기
버전: 검토 대기 ──승인──▶ 공개        (공개된 앱의 새 버전도 승인해야 내려받기에 보인다. 그동안 이전 버전이 그대로 보인다)
          └──반려·ClamAV 탐지──▶ 반려 (파일은 지우고 기록만 남는다. 같은 버전 번호로 다시 올릴 수 있다)
검사: 검사 대기 → 검사 중 → 탐지 없음 | 악성코드 탐지 | 검사 실패 | 검사 안 함(ClamAV 없음)
```

- 운영은 검사 결과가 '탐지 없음'이어야 승인할 수 있다 (`STORE_REQUIRE_SCAN`, 운영 기본값 켬). 개발 기본값은 끔이라 ClamAV 없이도 승인된다.
- 차단한 회원의 앱은 모두 목록에서 빠지고(404), 그 회원은 새로 올리거나 고칠 수 없다.

## 구조

### API (`api/app/store/`)

| 파일 | 내용 |
|---|---|
| `models.py` | 테이블 5개: `store_publishers`(표시 이름·약관 판·차단) · `store_apps` · `store_releases` · `store_uploads`(조각 업로드·하루 횟수) · `store_reports`. 기존 `users` 는 바꾸지 않는다 |
| `router.py` | `/api/store/` 엔드포인트 (아래) |
| `service.py` | 공개 여부, 응답 모양, 사용량, 반려, 정리, 탈퇴 정리(`purge_user`, `auth.delete_account` 가 부른다), 뒤에서 도는 검사 |
| `analyze.py` | 설치 파일 분석 (JohnnyStore `pe_extractor.py` 를 그대로 옮김) + 아이콘 다시 그리기. **자식 프로세스**에서 돈다 (시간 한도, 메모리 = 파일 크기 + 1.5GB) |
| `scan.py` | `clamscan --no-summary --alert-exceeds-max=yes`, 한 번에 하나 (잠금), 15분 한도. 한도를 넘어 다 보지 못하면 '검사 실패' |
| `files.py` | 파일 폴더: `uploads/`(받는 중·등록 대기, 하루 뒤 지움), `files/<무작위 키>`(버전 파일), `icons/<앱 코드>.png` |

| 엔드포인트 | 누가 | 내용 |
|---|---|---|
| `GET /meta` | 누구나 | 분류·신고 사유·한도·조각 크기·약관 판·업로드 열림·검사 필수·ClamAV 있음 |
| `GET /apps?q=&category=&sort=` | 누구나 | 공개된 앱 카드 (최대 500) |
| `GET /apps/{code}` | 누구나 | 상세. 올린 사람·운영자에게는 상태·사유·검사 상세·내려받기 수도 |
| `GET /apps/{code}/icon` | 누구나 | 256px PNG, `nosniff` |
| `GET /apps/{code}/releases/{id}/download` | 누구나 | 공개 확인 → `X-Accel-Redirect`(운영) 또는 API 가 직접(개발). `attachment`·`octet-stream`·`nosniff`·`CSP: sandbox`. 올린 사람·운영자가 받은 것은 세지 않는다 |
| `POST /apps/{code}/reports` | 누구나 | 사유·내용(10자 이상)·연락처(선택). 같은 IP 1시간 5번 |
| `GET /me`, `POST /me/publisher` | 회원 | 표시 이름(2~30자, 운영자로 오해할 이름 금지)·약관 동의·만 14세, 한도·사용량 |
| `PATCH /me/publisher` | 회원 | 표시 이름만 바꾸기 (설정 화면, 2026-11-26). 이미 정한 회원만(없으면 409), 약관 동의 기록은 그대로. 같은 이름 검사. 이용 제한 중에는 바꾸지 못한다(POST 로 이름을 바꾸는 것도 막는다) |
| `GET /me/apps` | 회원 | 내 앱 전부 |
| `POST /uploads` → `PUT /uploads/{id}?offset=` → `POST /uploads/{id}/complete` | 회원 | 시작(이름·크기, 한도 검사) → 8MB 조각 → 분석(확장자·내용 일치, SHA-256, 같은 파일 경고) |
| `DELETE /uploads/{id}` | 회원 | 취소 (파일 삭제, 하루 횟수에는 남는다) |
| `POST /apps`, `POST /apps/{code}/releases` | 회원 | 새 앱 / 새 버전 (검토 대기, 검사 시작) |
| `PATCH /apps/{code}`, `PUT /uploads/icons/{code}` | 올린 사람 · 운영자 | 글 고치기 / 아이콘 바꾸기(1MB, PNG·JPEG·WebP·ICO → 256px PNG). 아이콘은 nginx 본문 한도 때문에 uploads 경로에 있다. 차단된 회원은 못 고치고, 운영자가 남의 앱을 고치면 로그에 남긴다(응답에 올린 사람 포함) |
| `DELETE /apps/{code}`, `DELETE /apps/{code}/releases/{id}` | 올린 사람 · 운영자 | 파일까지 지운다. 차단된 회원도 자기 앱은 지운다. 운영자가 남의 것을 지우면 로그에 "(운영자)" 로 남긴다 |
| `/admin/…` | 운영자 | overview · releases/{id}/approve·reject·rescan · apps/{code}/hide·unhide · reports/{id}/resolve · publishers/{user_id}/block·unblock |

### 웹 (`web/`)

- `src/lib/store.ts`: API 클라이언트(조각 업로드는 XMLHttpRequest 로 진행률), 주소 도우미, 불러온 값 저장소(`useSyncExternalStore`)
- `src/components/store/`: `store-browser` · `store-app-view` · `store-upload` · `store-mine` · `store-manage` · `store-edit`(정보 고치기·아이콘 바꾸기·지우기 확인 대화상자, 올린 사람·운영자 공용) · `review-link`(운영자 '검토' 버튼) · `store-cards`(공식·회원 앱 카드, Store 목록·My Studio 공용) · `official-delete`(공식 항목 = Library 작품 지우기, 개발 서버·운영자, Showroom 도 쓴다) · `store-ui`(아이콘·상태·검사 배지·글자 그대로 보이기)
- `src/app/store/{,app,new,mine,manage,terms}/page.tsx`
- 회원이 쓴 글은 `whitespace-pre-line` 으로 글자만 보인다 (HTML 로 넣지 않는다). 분석 화면의 아이콘 미리보기는 `data:` 그림 (CSP `img-src data:` 허용 범위)

### 한도·설정 (`api/app/config.py`, 운영 값은 `deploy/api.env.example`)

| 설정 | 기본값 | 뜻 |
|---|---|---|
| `JOHNNYSTUDIO_STORE_ADMINS` | (비어 있음) | 운영자 이메일. 비어 있으면 아무도 승인할 수 없다 |
| `JOHNNYSTUDIO_STORE_UPLOADS_OPEN` | 1 | 0 이면 새 업로드를 받지 않는다 (공개된 앱은 그대로) |
| `JOHNNYSTUDIO_STORE_FILE_MAX_MB` · `USER_QUOTA_MB` · `DAILY_UPLOADS` | 300 · 2048 · 10 | 파일 하나 · 회원 합계(검토 중 포함) · 24시간 시작 횟수 `[확인 필요: 사용자 확인 전 기본값]` |
| `JOHNNYSTUDIO_STORE_CLAMSCAN` | `clamscan` | 빈 값이면 검사하지 않는다 |
| `JOHNNYSTUDIO_STORE_REQUIRE_SCAN` | 운영 1, 개발 0 | '탐지 없음'이어야 승인 |
| `JOHNNYSTUDIO_STORE_DIR` | 운영 `/opt/johnnystudio/store`, 개발 `api/data/store` | 파일 폴더 |
| `JOHNNYSTUDIO_STORE_ACCEL_PREFIX` | 운영 `/_store_files/`, 개발 빈 값 | nginx internal location |
| `JOHNNYSTUDIO_STORE_FILES_ORIGIN` | (비어 있음) | 공개 내려받기 링크를 다른 등록 도메인으로 (검토용은 그대로) |

### 운영 경로

```
방문자 → Cloudflare → nginx 127.0.0.1:8081 ─┬─ /store/…                   정적 셸
                                           ├─ /api/store/uploads…        → API (본문 9m, 분당 120회, 읽기 180초)
                                           ├─ /api/store/…               → API (기존 /api/ 설정)
                                           └─ /_store_files/<키>         internal: API 의 X-Accel-Redirect 로만 → /opt/johnnystudio/store/files/
```

설치: [deploy/README.md §3-7](../../../deploy/README.md) (폴더, ClamAV, 운영자 이메일, nginx·systemd 다시 설치).

## 완료 기준

- [x] 회원이 파일을 올리면 분석으로 양식이 채워지고, 검토 대기로 접수된다
- [x] 운영자가 승인하기 전에는 남에게 보이지 않고, 승인하면 목록·상세·내려받기가 된다. 내려받은 파일의 SHA-256 이 화면 값과 같다
- [x] ClamAV 가 탐지하면 반려·삭제, 운영 설정에서는 검사 전 승인 불가
- [x] 신고·숨김·차단·탈퇴 정리
- [x] Store 목록에 Library 의 공개된 Windows 앱 10개가 '공식'으로 함께 보인다 (2026-11-24)
- [x] `./scripts/check.sh` 통과
- [ ] 운영 서버에서 §3-7 확인 1~5 (ClamAV 실제 검사 포함)
- [ ] 사용자: ADR-0012 확정, 한도 기본값 확인, 이용약관의 운영자·연락처·시행일, 법률 검토 여부

## 확인한 것 (2026-11-24)

- API 테스트: Store 흐름 22개 + 분석기 31개 (1개는 Windows 전용이라 건너뜀). API 전체 107개 통과 + 1개 건너뜀 (전에는 55개). 업로드→검토→공개→내려받기, X-Accel 헤더, 한글 파일 이름, 형식·내용 불일치, 조각 위치·크기, 한도 3종, 업로드 닫기, 탐지 시 삭제, 검사 필수, 새 버전·재제출, 권한, 고치기·지우기, 신고 제한·처리, 숨김·차단, 검색·분류, 탈퇴 정리, 아이콘 다시 그리기(SVG 거부·1MB·남의 앱), 별도 출처
- 실제 nginx(설정 템플릿, 임시 포트·폴더) + API 로 22개 항목: 9MB 파일 2조각 업로드가 본문 한도를 통과, 9MB 넘는 조각은 nginx 413, 승인 전 404, `X-Accel-Redirect` 로 보낸 파일의 SHA-256 일치, `x-accel-redirect` 가 방문자에게 안 보임, `content-type`·`content-disposition`·`nosniff`·`CSP sandbox`·`accept-ranges`, Range 206, `/_store_files/` 직접 요청 404
  - 이 확인에서 `location ^~ /api/store/uploads/` 의 끝 `/` 때문에 업로드 시작(`POST /api/store/uploads`)이 301 로 돌아오는 것을 찾아 고쳤다
- 출시 빌드 미리보기 + 헤드리스 Chrome: 목록·상세(어둡게·밝게·390px)·검토 중 앱(손님 404, 올린 사람은 상태 안내)·올리기(로그아웃·처음·파일 놓기 → 분석 양식)·내 앱(아이콘 바꾸기 → 목록 카드에 반영)·검토(어둡게·밝게)·일반 회원의 검토 화면 거부·약관. CSP 위반·가로 스크롤 없음
- 실제 설치 파일(JohnnyPlanner 0.1.0, NSIS)을 임시 환경에 올려 분석: 이름 JohnnyPlanner, 버전 0.1.0, x64(설치 프로그램은 x86 → 파일 이름으로 x64 표시 경고), 서명 없음, 아이콘 있음(NSIS 기본 아이콘)

## 확인하지 못한 것

- 운영 서버 설치(§3-7): ClamAV 실제 검사·메모리·시간, systemd 샌드박스 안에서 자식 프로세스·`clamscan` 실행, PostgreSQL 에서 Store 테이블
- Cloudflare 를 거친 조각 업로드·큰 파일 내려받기 (요청 한도·시간 제한·캐시 약관)
- msi·msix·zip·7z 실제 파일 분석 (테스트는 만든 PE 와 zip 만)
- 저작권법 책임 제한 요건, 약관 법률 검토
- 개발 서버(4000, 공개 중)에서 사용자 브라우저로 직접 올리기 (운영자 이메일 설정 전이라 승인할 수 없다)

## 미결정

- ADR-0012 확정 (지금은 제안됨)
- 한도 기본값 (300MB · 2GB · 24시간 10번), 신고 보관 기간 (처리 뒤 1년)
- 이용약관의 운영자 이름·연락처·시행일 (`TODO(content)`)
- 별도 파일 도메인을 언제 마련할지 (ADR-0012 재검토 조건)
- Store 파일 백업 (DB 와 같은 주기)
