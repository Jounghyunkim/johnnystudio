# 2026-11-24: 회원 Store·Showroom, 콘텐츠 정리, My Claude Inspector, Store 운영 도구

> **작업자**: 사용자 + Claude Code (Claude Opus 5.5)
> **관련**: [ADR-0012](../docs/04_architecture/adr/0012-member-store.md) (제안됨), [Store 명세](../docs/02_planning/features/store.md), [Showroom 명세](../docs/02_planning/features/showroom.md), deploy/README §3-7·§9
> 커밋 `f5ba2ee` · `3cd9104` · `22a4ad4` · `b09ba01` · `7ec8ffc` · `2d6b0fe` · `d62e189` · `0471aaf` · `2566092` · `3823b27` · `f97b112` (모두 `main` 에 push 함)
> 11-23 의 커밋 `e0cb253`(pixtuoid 검토)·`8e6923c`(JohnnyPlanner 초안)는 이 세션 전의 일이라 여기서 다루지 않는다

## 목표

사용자 요청을 차례로 했다 (인용은 사용자 말 그대로).

1. "JohnnyPlanner설치파일을 올려뒀다. 이것을 다운로드 받을 수 있도록 업데이트 해줘."
2. "기존에 검토했던 JohnnyStore를 JohnnyStudio의 하나의 메뉴로 추가하고 싶다. 그래서 사용자들도 스토어에 zip 또는 exe 파일등을 업로드하고 접속하는 사용자들이 사용해볼 수 있는 그런 공간을 추가해줘."
3. 운영자 이메일 추가, Library 앱을 Store 에, JohnnyPlanner 아이콘 바꾸기, Library 에서 스크린샷 대신 아이콘
4. "각 앱은 MS Store에 등록되어 있어 이 경로도 함께 공유해주면 좋을 것 같은데", "Libray에 있는 샘플들은 모두 제거해 줘."
5. "앱을 공유하는 Store와 동일한 레벨로 사용자들이 만든 서비스를 공유하고 설명하는 페이지를 적절한 이름을 붙여서 추가해 줘."
6. "~/workspace/myclaudeinspector 의 최신 코드를 이용해서 서비스 실행해주고, 해당 서비스를 JohnnyStudio에 추가해 주세요."
7. "Store와 Showroom을 Library 아래 두는건 좀 아닌거 같아... 이 둘을 About 오른쪽에 구분선("|")을 두고 그 뒤에 Store 및 Showroom 메뉴를 배치해줘."
8. "운영자용 검토 링크 추가해주고, 올린 앱에대해서 수정도 할 수 있도록 기능 추가해 줘." / "Store에 등록한 앱은 등록한 사람 및 관리자가 삭제할 수 있도록 삭제 기능도 추가해 줘."
9. "MS Store에 대해서 [그림]을 참고하여 아이콘을 생성하고 사용해서 업데이트 해주세요."

## 한 일

### JohnnyPlanner 설치 파일 (`f5ba2ee`)

- 사용자가 둔 `JohnnyPlanner_0.1.0_x64-setup.exe` 로 작품 `johnny-planner` 의 다운로드(size·sha256)를 채우고 초안을 풀었다. 파일은 `.local/files/johnny-planner/` 에 보관
  (사용자가 나중에 `~/workspace` 의 원본을 옮겨서 스크립트는 `.local/files` 사본을 쓴다)

### 회원 Store (`3cd9104`, ADR-0012)

- 결정 (사용자 답): 운영자 승인 후 공개, Windows 프로그램 내려받기만, 지금은 johnnystudio.net(`STORE_FILES_ORIGIN` 으로 바꿀 수 있게), 메뉴 이름 Store
- API `api/app/store/`: 8MB 조각 업로드, 설치 파일 분석을 자식 프로세스(`python -E -s -m app.store.analyze`, 메모리·CPU 한도)에서, ClamAV `clamscan` 백그라운드 검사, 검토(승인·반려·다시 검사)·숨김·차단·신고, `X-Accel-Redirect` 내려받기(`attachment`·`octet-stream`·`nosniff`·`CSP: sandbox`), 아이콘은 Pillow 로 다시 그린 PNG 만, 탈퇴하면 정리
- 화면 `/store/` · `/store/app/` · `/store/new/` · `/store/mine/` · `/store/manage/` · `/store/terms/`, Store 이용약관(JohnnyStore 문안을 고침), 개인정보처리방침, nginx·systemd·`api.env.example`, deploy/README §3-7
- DB: 기존 테이블에 열을 더하지 않고 새 테이블만 만들었다 (`create_all` 이 기존 테이블을 고치지 않아서, 열을 더하면 개발 DB 를 지워야 하고 계정이 사라진다)
- **새 의존성** (`api/pyproject.toml`, `exclude-newer` 를 2026-11-10 으로): JohnnyStore 의 `pe_extractor` 를 옮기는 데 필요했다
  - `pefile==2024.8.26`: exe 의 아키텍처·버전 정보·서명 블록
  - `icoextract==0.3.1`: exe 의 아이콘 꺼내기 (ctypes 경고는 pytest 에서 무시, 통합 문서 X9)
  - `pillow==13.0.0`: 올라온 그림을 그대로 내주지 않고 256px PNG 로 다시 그리기
  - `olefile==0.47`: msi 의 제품명·제조사·플랫폼
- 개발 서버 운영자 이메일 (운영자 이메일) 을 `api/.env.local` 에 (git 제외 파일)

### 콘텐츠 정리 (`22a4ad4` · `b09ba01` · `7ec8ffc` · `2d6b0fe`)

- Store 목록에 Library 의 공개된 Windows 앱을 '공식' 카드로 함께 (`getOfficialStoreApps()`, 누르면 Library 상세)
- JohnnyPlanner 아이콘을 사용자 그림(512px)으로 바꿔 256px PNG 로, Library 카드·상세도 스크린샷 대신 아이콘
- 스키마에 `microsoftStore` (`apps.microsoft.com/detail/<12자>` 만): 카드 바로가기 'MS Store', 다운로드 패널에 'Microsoft Store에서 받기'.
  받은 7개 주소 중 5개(CMG Monitor·Johnny-Dir·WLT·Screen-REC·TakeScreenShot)만 넣었다. JohnnyPlanner 에 받은 ID 는 CMG Monitor 의 것, SpaceSense AI 에 받은 ID 는 Screen-REC 의 것과 같았다 (스토어 페이지 제목으로 확인)
- 뷰어 예시 작품 `sample-*` 5개를 지웠다

### Showroom (`d62e189`, ADR-0012 결정 12)

- 회원이 만든 웹 서비스(이름·https 주소·소개·분류·아이콘·화면 그림)를 운영자 승인 뒤 공개. 이름 "Services" 는 Work with me 와 헷갈려서 Showroom
- API `api/app/showroom/`, 화면 `/showroom/` · `/showroom/service/` · `/showroom/new/` · `/showroom/mine/`, 검토는 `/store/manage/` 안. 승인 뒤 주소를 바꾸면 다시 검토 대기
- 회원 링크는 `rel="noopener noreferrer nofollow ugc"`. 올리는 회원·약관·차단은 Store 와 함께 쓴다 (약관 판 `2026-11-24.2`)
- Library 의 웹 서비스(Arkurator)를 '공식'으로 함께. 이때 메뉴를 Library 펼침(작품 전체 · Store · Showroom)으로 했다 (아래에서 바꿈)

### My Claude Inspector (`0471aaf`)

- `~/workspace/myclaudeinspector` 최신 코드(`c6acf01`)를 출시 빌드로 `127.0.0.1:3300` 에서 실행 (`screen` 세션 `MyClaudeInspector`, `next start`)
  - Bun 1.3.6 을 `~/.local` 에 설치 (npm 이 설치 스크립트를 막아 `--allow-scripts=bun`, 실행 파일을 `~/.local/bin/bun` 으로 링크)
- 사용자 결정: 인터넷에 공개하되 랭킹·다운로드만, Library 에는 데스크톱 툴 + 웹 링크
  - 이 앱의 대시보드(`/`·`/trends`·`/learn/…`)는 주소에 적힌 서버 PC 폴더를 읽어 운영자의 Claude 정보를 보여 주므로, `deploy/nginx/myclaudeinspector.conf` 가 랭킹·다운로드·로그인 화면과 `/api/ranking/`·빌드 파일만 넘기고 나머지는 404
- 작품 `my-claude-inspector` (설치 파일 v0.1.2, GitHub Releases 와 SHA-256 같음, 아이콘, 사용량 랭킹·GitHub 링크), deploy/README §9 (다시 띄우기, 공개 절차)

### 메뉴 바꾸기 (`2566092`, ADR-0012 결정 13)

- 헤더: Library · Life Log · Work with me · About **|** Store · Showroom. 휴대폰 메뉴에서는 구분선 뒤
- 항목이 6개라 800px 에서 로그인 버튼이 잘려서, 펼친 메뉴는 1024px(lg) 이상에서만
- 홈 히어로 버튼: Library 둘러보기 · Store · Showroom · 함께 일하기 (마무리 카드는 그대로)

### Store 운영 도구 (`3823b27`)

- Store·Showroom 목록에 운영자에게만 보이는 '검토' 버튼 (`review-link.tsx`, `/api/store/me` 의 `admin`), 앱 상세에 '검토 화면' 링크
- 운영자가 회원 앱의 이름·소개·설명·분류·아이콘을 고친다 (검토 화면·앱 상세). 검토 상태는 그대로, 파일은 못 바꾼다. 운영자가 남의 앱을 고치면 로그에 남긴다
  - 약관에 이 조항이 없어서 제5조 5 를 더하고 판을 `2026-11-24.3` 으로 올렸다 (이미 동의한 회원도 다음에 올릴 때 다시 동의)
- 올린 사람·운영자가 앱·버전을 지운다 (내 앱·앱 상세·검토 화면). 차단된 회원도 자기 앱은 지운다. 운영자 근거는 약관 제10조 1 (고치지 않음)
- 고치기·아이콘·지우기 대화상자를 `store-edit.tsx` 로 모았다 ('내 앱'에 있던 것을 옮김)
- 버튼 종류 `danger` 를 더했다: `ghost` 뒤에 `text-danger` 를 덧붙인 지우기 버튼이 회색으로 보였다 (내 앱·Showroom 의 기존 버튼도 같은 문제)

### Microsoft Store 아이콘 (`f97b112`)

- 사용자가 준 그림(가방 + 네 가지 색)을 보고 `web/public/brand/microsoft-store.svg` 를 그렸다. 색은 SVG 안에만 두고 `ms-store-icon.tsx` 로 쓴다
- Library 카드 'MS Store' 바로가기, Store 공식 카드, 작품 상세 다운로드 패널(제목·버튼). 바로가기 타입에 `icon` 필드

## 결정 (→ ADR)

- 회원 Store·Showroom 의 원칙과 한도, 메뉴 구성, 운영자의 고치기·지우기: [ADR-0012](../docs/04_architecture/adr/0012-member-store.md) (제안됨, 사용자 확정 전). 결정 9 에 운영자 고치기·지우기, 결정 12 Showroom, 결정 13 메뉴(같은 날 Library 펼침 → About 오른쪽 구분선 뒤로 바꿈)
- My Claude Inspector 를 같은 nginx 로 공개하되 허용 목록 방식으로 랭킹·다운로드만 (사용자 결정). 기록은 deploy/README §9 와 nginx 템플릿 머리말뿐이고 **ADR 은 없다**
- Microsoft Store 아이콘을 다시 그려 쓴다. 기록은 DESIGN_SYSTEM "바깥 서비스 아이콘" 뿐이고 **ADR 은 없다** (Microsoft 공식 배지로 바꿀지는 사용자 확인 전)

## 확인 (어떻게 검증했나)

- 커밋마다 `./scripts/check.sh` 통과. 마지막: 웹 테스트 125개, API 128개 통과 + 1개 건너뜀(Windows 전용), HTML 37개 CSP 해시
  - 마지막 두 커밋은 첫 커밋만 꺼낸 상태를 임시 worktree 에서 따로 검사했다 (타입·린트·웹 125개·API 128개)
- Store: API 테스트(흐름 22개 + 분석기 31개), 실제 nginx 템플릿을 임시 포트로 띄워 22개 항목(조각 업로드 본문 한도, 413, 승인 전 404, X-Accel 파일 SHA-256 일치, 헤더, Range 206, `/_store_files/` 직접 요청 404), 헤드리스 Chrome 화면 15장, 실제 JohnnyPlanner 설치 파일 분석. 자세한 것은 [Store 명세](../docs/02_planning/features/store.md) "확인한 것"
- Showroom: API 테스트 19개 (흐름, 주소 규칙 11가지, 주소 변경 재검토, 그림, 신고·숨김·차단, 권한, 하루 한도, 탈퇴 정리)
- Microsoft Store 주소: 받은 7개를 스토어 페이지 제목으로 맞춰 봐서 2개가 다른 앱 주소인 것을 찾았다
- My Claude Inspector: `http://127.0.0.1:3300/ranking` 200, nginx 템플릿을 임시 nginx 로 띄워 막을 경로 404·`/` → `/ranking` 확인
- 메뉴: 1280·1024·800·390px 헤더 화면(800·390 은 메뉴를 연 상태), 가로 넘침 없음
- Store 운영 도구: 출시 빌드 + 임시 API + 시험 데이터 + 헤드리스 Chrome
  - '검토' 버튼: 운영자 true, 회원·비회원 false. 운영자 고치기 → 카드·'내 앱'에 반영, 검토 상태 유지, 아이콘 바뀜, 회원이 다시 고침
  - 지우기: 다른 회원·비회원은 버튼 없음, 운영자가 남의 버전·앱 지움(→ `/store/manage/`), 올린 사람이 상세에서 지움(→ `/store/mine/`, API 404), 검토 화면 목록에서 지움
  - 지우기 버튼 글자색 = `danger` 토큰 (어둡게·밝게). 콘솔 오류·CSP 위반·가로 넘침 없음
- Microsoft Store 아이콘: 16·20·32·96px 를 어둡고 밝은 바탕에 띄워 봄, Library·상세·Store 에서 그림이 깨지지 않음(두 테마)
- 개발 서버 재가동 3번 (Store·Showroom·메뉴 커밋 뒤, `screen` 세션 `JohnnyStudio`, 4000·3001·3002), 홈·`/store/`·`/showroom/`·작품 상세 200. 개발 API 는 코드가 바뀌면 스스로 다시 읽었다
- **미검증**
  - 실제 ClamAV 검사 (M8 에 `clamscan` 이 없다. 테스트는 검사 함수를 바꿔 끼운다), 운영 서버 설치(§3-7), PostgreSQL 에서 Store·Showroom 테이블, Cloudflare 를 거친 큰 파일
  - msi·msix·zip·7z 실제 파일 분석, 받은 설치 파일을 Windows 에서 실행
  - My Claude Inspector 의 공개 주소(DNS·nginx·certbot 전), Supabase 로그인 메일의 돌아오는 주소
  - 사용자 브라우저에서의 실제 올리기·검토. 개발 DB 에 검토 대기 앱이 1개 있다 (누가 올렸는지는 보지 않았다)
  - 바뀐 약관 문안(제5조 5)의 법률 검토

## 남은 일 · 다음 세션

- [ ] 사용자: ADR-0012 확정, Store 한도(300MB · 2GB · 24시간 10번)·Showroom 한도·분류, 약관 제5조 5 문안, 약관의 운영자 이름·연락처·시행일 (`TODO(content)`)
- [ ] 사용자: JohnnyPlanner·SpaceSense AI 의 바른 Microsoft Store 주소 (Johnny Mecro·SmartFolder Organizer·SentinelLite-AV 도 있으면)
- [ ] 사용자: Microsoft Store 아이콘을 지금처럼 쓸지, 공식 배지로 바꿀지
- [ ] 사용자(sudo): 운영 서버 Store 설정 (deploy/README §3-7: 폴더, `clamav`, 운영자 이메일, nginx·systemd 다시 설치)
- [ ] 사용자: My Claude Inspector 공개 주소 DNS → nginx 사이트·certbot (deploy/README §9). M8 을 다시 켜면 `screen` 세션이 사라지므로 오래 둘 거면 systemd
- [ ] (원하면) Showroom 서비스도 운영자가 고치기: 운영자가 주소를 바꿀 때 다시 검토로 돌릴지 정해야 한다
- [ ] (원하면) 홈 마무리 카드에도 Store·Showroom 버튼

## 메모

- **기존 테이블에 열을 더하지 않는다.** `create_all` 은 있는 테이블을 고치지 않아서, 열을 더하면 개발 SQLite 를 지워야 하고 계정이 사라진다. 지금까지는 새 테이블만 더했다 (회원 Store 앱의 Microsoft Store 주소 칸도 같은 이유로 미룸)
- 버튼 색을 `cx(buttonClass("ghost"), "text-danger")` 처럼 덧붙이면 안 된다. 같은 속성 클래스 둘은 CSS 순서로 정해져서 회색이 이긴다. 종류(`danger`)를 쓴다
- nginx `location ^~ /api/store/uploads/` 처럼 끝에 `/` 를 붙이면 `POST /api/store/uploads` 가 301 로 돌아온다 (임시 nginx 확인에서 찾음)
- `pkill -f` 는 자기 셸까지 죽일 수 있어서 PID 로 끄는 스크립트를 썼다. 서버 대기는 `curl -sf` (502 를 성공으로 보지 않게)
- 개발 서버를 다시 띄우면 관리 화면 토큰(`#k=…`)이 바뀐다. `screen -r JohnnyStudio` 에서 본다
- 검토 화면(`/store/manage/`)에는 메뉴 링크가 없었다. 이제 목록의 '검토' 버튼으로 들어가지만, 권한은 API 가 판단한다 (버튼은 편의)
- 화면 확인 스크립트(임시 API + 출시 빌드 + 헤드리스 Chrome)는 세션 임시 폴더에만 있다. 저장소에 브라우저 테스트를 넣는 일은 ROADMAP 의 남은 일이다
