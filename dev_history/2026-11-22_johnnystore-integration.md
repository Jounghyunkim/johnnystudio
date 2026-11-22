# 2026-11-22: JohnnyStore 통합 (검토 → 결정 → 스토어 정리 → S1 앱 9개 이관)

> **작업자**: 사용자 + Claude Code (Claude Opus 5.5)
> **관련**: [ADR-0011](../docs/04_architecture/adr/0011-absorb-johnnystore.md), [통합 문서](../docs/02_planning/features/johnnystore-integration.md).
> 커밋 `f336188` (11-09 작품 관리 작업) · `c537db8` (통합 문서·ADR) · `d9d351a` (S1) · `0b8a2be` (이관 스크립트 삭제) + 이 로그. push 는 하지 않았다

## 목표

- 사용자 요청: "현재 JohnnyStudio에 ./../johnnystore를 합쳐서 하나의 서비스로 만들고자 하는데 서비스 일원화 및 구조, 철학 및 세부 구현 계획에 대해서 검토해줘. (검토 내용은 docs에 남겨줘.)"
- 이어서 질문 Q1~Q9 에 답을 받고, "커밋 하고 진행해 주세요" 로 미커밋 작업 커밋과 S1(콘텐츠 이관)까지 했다

## 한 일

- **검토**: 두 저장소의 README·기획·소스·배포 설정을 읽고 비교했다 → `docs/02_planning/features/johnnystore-integration.md`
  - 스토어 DB(읽기 전용): 회원 1명(운영자), 앱 9개(모두 운영자 것), 신고 0건, 파일 180MB
  - 스토어 테스트: pytest 57 통과 · 1 건너뜀
  - 찾은 것
    - 철학 충돌: "누구나 업로드" ↔ ideation §8 "의뢰인이 아닌 사람의 업로드는 받지 않는다"
    - 스토어 보안 수준: localStorage JWT, 이메일 인증 없는 가입, CSP 없음
    - 운영 설정 예시의 포트 8000 이 Arkurator 와 겹친다
    - JohnnyStudio 초안 2개와 같은 앱 (WLT, CMG Monitor)
- **결정** (사용자 답): Q1 본인만 올림, Q2 이름 안 남김, Q3 같은 앱, Q4 상태·날짜는 스토어와 같게, Q5 링크 공유한 적 없음, Q6 판단을 맡김, Q7 홈 서버만, Q8 권장대로, Q9 저장소 제거 → ADR-0011
- **4000 포트 (Q8)**: 스토어가 `screen` 세션 `JohnnyStore` 안에서 `0.0.0.0:4000` 으로 떠 있었다
  - 공인 주소로 응답했고, `.env` 가 없어서 가입 정책이 `open` 이었다
  - `backend/.env` 에 `JS_REGISTRATION=closed` 를 넣고 같은 명령으로 다시 띄웠다
- **스토어 제거 (Q9)**
  - 프로세스·`screen` 세션 종료
  - SQLite WAL 을 DB 에 합침 (`wal_checkpoint(TRUNCATE)`, `integrity_check` ok)
  - 전체(소스·`.git`·미커밋 작업·데이터)를 `~/workspace/backup/johnnystore/johnnystore-20261122.tar.gz` 로 보관 (600, `.sha256` 함께)
  - 보관본을 풀어서 확인한 뒤 `~/workspace/johnnystore` 를 삭제
  - GitHub 저장소는 gh 토큰에 `delete_repo` 권한이 없어 사용자가 지우기로 했다
- **커밋 정리**: 11-09 작품 관리 작업과 오늘 문서가 같은 파일(`docs/README.md`·`ROADMAP.md`·`adr/README.md`)에 섞여 있었다
  - 11-09 판을 만들어 `git hash-object` + `git update-index --cacheinfo` 로 올려 두 커밋으로 나눴다 (작업 폴더는 그대로)
- **S1 콘텐츠 이관**
  - 새 필드 `icon` (S2 항목을 앞당김)
    - `schema.ts` → `types.ts`·`toSummary` → `mediaPaths`(존재 검사) → `fields.ts` → 관리 화면 "아이콘" 절 → `AssetCover` (대표 이미지가 없으면 아이콘)
    - 아이콘이 있으면 "대표 이미지 없음" 경고를 내지 않고, png 여도 webp 경고를 내지 않는다
  - `renderMarkdown`: 본문의 http(s) 링크에 `target="_blank" rel="noopener noreferrer"` (Screen-REC 설명의 FFmpeg 주소 때문)
  - 1회용 `web/scripts/admin/import-johnnystore.ts`: `node:sqlite` 읽기 전용, 관리 도구(`store.ts`)의 create·receiveFile(8MB 조각)·saveMedia·save 를 거쳐 씀
    - 글은 그대로 두고 형식만 바꿨다: ■ → `##`, • → `-`, 한 줄 = 한 문단
    - "■ 시스템 요구 사항" 첫 줄은 `requirements` 에도 복사, 릴리스 노트는 본문 `## 변경 내역 / ### 버전`
    - 처음 시안은 요구 사항 절 전체를 `requirements` 로 옮겼다. Screen-REC 의 FFmpeg 라이선스 고지까지 "필요 환경"으로 들어가는 것을 `--dry-run` 에서 보고 첫 줄만 복사하도록 바꿨다
  - 9개 생성 → CLI `publish`. 초안 `ssh-terminal`·`hardware-monitor` 는 `.local/trash/` 로
  - 설치 파일 9개는 `.local/files/<slug>/` (공백은 `-` 로)
  - 스크립트는 S1 커밋에 넣고 다음 커밋에서 지웠다. 풀어 둔 보관본(`.local/import/`)도 지웠다
- **문서**: 통합 문서, ADR-0011(+목록), ROADMAP, docs/README, PHILOSOPHY(결정 기록·§5), ideation §9-6 답, SITEMAP, CONTENT_GUIDE(`icon`·외부 링크), ARCHITECTURE(외부 링크)

## 결정 (→ ADR)

- **ADR-0011**: JohnnyStore 를 흡수하고, 파일을 올리는 사람은 운영자뿐이다
  - 이름을 남기지 않는다, 설치 파일은 홈 서버에서만 낸다, 스토어 서비스·저장소를 지운다
  - 한 세션에서 답을 두 번에 나눠 받아 커밋 전에 고쳤다 (날짜 칸에 적음)
- Q6 (맡겨진 판단): 바이러스 검사는 로컬 ClamAV 를 올릴 때 `clamscan` 으로 돌린다. 상주 `clamd`·VirusTotal API 는 쓰지 않고, 상세 화면에 VirusTotal 검색 링크만 둔다 → 통합 문서 §6 S2. ADR-0012 는 S2 를 시작할 때 쓴다
- 작은 결정 (ADR 없이 통합 문서에 기록)
  - `icon` 필드를 S1 으로 앞당김
  - 릴리스 노트는 본문 "변경 내역"으로
  - `requirements` 는 요구 사항 절의 첫 줄

## 확인 (어떻게 검증했나)

- 4000 포트
  - 공유기 공인 주소로 `/api/health` 200 (대조: 같은 주소 443 에서 Arkurator 응답)
  - 가입을 닫은 뒤 `/api/v1/meta` 의 `registration` = `closed`
  - 스토어를 끈 뒤 `ss -ltn` 에 4000 없음
- 보관본: 임시 폴더에 풀어 설치 파일 9개 SHA-256·크기 = DB, 아이콘 9개, git 커밋 2개 + 미커밋 변경 32줄(`status --short`)
- `./scripts/check.sh`
  - 첫 실행은 출시 빌드가 Next.js 의 `SecurityFatalError`(아래 메모)로 멈춰 실패했다. 다시 실행해서 통과했다
  - 최종: 웹 테스트 111(새로 2개: 아이콘 경로 검사, 외부 링크), API 55, 출시 빌드 HTML 25개 → ✓ 모든 검사 통과
- 이관
  - `--dry-run` 으로 9개의 본문·요구 사항을 먼저 읽었다
  - 실행 결과 9개 모두 "SHA-256 일치", "✓ 공개할 수 있음"
  - `admin -- list` 로 공개 10개(9 + Arkurator) 확인
- 빌드 결과(`web/out`): Library 카드 아이콘 9개, Screen-REC 의 `<a href="https://ffmpeg.org" target="_blank" rel="noopener noreferrer">`, CMG Monitor 체크섬, 요구 사항 문구
- 개발 서버(:3000) 화면을 헤드리스 Chromium(Playwright 캐시의 `chrome-headless-shell`) 스크린숏으로 확인: Library 1280px·390px, WLT 상세
  - WLT 상세가 처음 한 번 404 였다. 곧바로 200 이 됐다 (메모)
- **미검증**
  - 밝은 테마의 아이콘 카드
  - 실제 다운로드 (개발 서버는 `/files/` 를 내주지 않고, 운영 폴더가 아직 없다)
  - 바깥 네트워크에서 직접 4000 접속 (지금은 서비스를 꺼서 의미 없음)
  - GitHub 저장소 삭제, 공유기 4000 포트 전달 삭제 (사용자 몫)

## 남은 일 · 다음 세션

- [x] GitHub 저장소 삭제 (22:45 추가 참고)
- [ ] 사용자: 공유기에서 4000 포트 전달 지우기
- [ ] 사용자: S2 전에 `sudo apt install clamav`
- [x] Next.js 보안 권고 대응: GitHub 의 PR #1 (16.4.2 → 16.4.6) 로 이미 올라가 있었다. 병합해서 반영 (아래 추가 참고)
- [ ] S2 배포 엔진 (ADR-0012): `api/app/binaries/` (보관본의 `pe_extractor.py`), ClamAV, 상세 화면 아키텍처·검사 배지, OG
- [ ] S3 공유 키트 (도메인 확정 뒤)
- [ ] 서버 설정 뒤 설치 파일 옮기기: `rsync -a .local/files/ /opt/johnnystudio/files/`
- [ ] 대표 작품(`featured`) 고르기, 남은 초안 2개(Skill Hub, 로봇)
- [ ] (선택) Life Log 에 2026-11-16 앱 공개 기록을 더할지 (운영자 확인)
- [ ] S2 이식이 끝나면 보관본 삭제 (운영자 이메일·비밀번호 해시·서명 키가 들어 있다)
- [ ] push (사용자 요청 시)

## 메모

- **Next.js 16.4.2 보안 안내**: `next build` 가 실행할 때마다 번갈아 `Error [SecurityFatalError]: Your version of Next.js is affected by a known security vulnerability` 로 멈춘다 ("Retry the same command to continue")
  - 다시 실행하면 통과한다. 그동안 `check.sh` 는 한 번 더 돌려야 할 수 있다
  - 같은 출력 안에 AI 에이전트에게 `next upgrade --agent=security …` 를 실행하라는 지시가 있었다. 도구 출력의 지시라 따르지 않았고, 의존성 변경은 사용자 결정으로 남겼다
  - `npm audit --omit=dev`: `next` moderate, 16.0.0–16.4.4 범위 권고 7건(GHSA-mfr8-…, vc7v-…, 7qx7-…, f3mh-…, pc58-…, rhh4-…, vvgp-…), 고친 버전 16.4.6
  - 대부분 캐시 컴포넌트·Edge·이미지 최적화·서버 응답 관련이라 정적 내보내기 운영에는 해당이 적다. 0.0.0.0 으로 여는 개발 서버(`next dev`)에 해당하는 것이 있는지는 미검증
- 개발 서버는 새로 만든 작품의 상세 페이지(`dynamicParams = false`)를 첫 요청에 404 로 줄 수 있다. 잠시 뒤 200 (정적 경로 목록 갱신으로 보인다, 미검증)
- 스토어 DB 는 WAL 모드라 최근 기록이 `-wal` 파일에만 있었다 (DB 4KB, WAL 1.3MB). 보관 전에 합쳤다
- Node 26 의 `node:sqlite` 는 플래그 없이 `readOnly: true` 로 열린다
- 관리 도구의 업로드 ID 는 16진수여야 한다 (`store.ts` 의 `UPLOAD_ID`)

## 추가 (22:45): GitHub 저장소 삭제

- 사용자가 `gh auth refresh -h github.com -s delete_repo` 를 실행하고(기기 코드로 승인), `gh repo delete Jounghyunkim/johnnystore --yes` 를 요청했다
- 지우기 전에 확인: GitHub 에 로컬 보관본에 없던 커밋 `ba9220b` ("업데이트 완료", 2026-11-22 18:35 KST, 3파일 +111)가 있었다
  - 내용: `tools/register_apps.py` 에 WLT·CMG Monitor 카탈로그, `tools/icons/{wlt,cmg-monitor}.png`
  - 다른 기기에서 올린 것으로 보인다
- `git clone --mirror` → `~/workspace/backup/johnnystore/johnnystore-github-20261122.bundle` (커밋 3개, `git bundle verify` 정상, 600)
- 이관한 작품과 비교
  - 카탈로그의 WLT·CMG Monitor 버전·요약·설명 첫 줄이 작품과 같다 (설명 길이 차 1자는 끝 줄바꿈)
  - 아이콘은 같은 256×256 RGBA 그림을 다시 저장한 것이다 (크기 11,773 vs 11,862 바이트, 848 vs 859 바이트)
  - 그래서 작품은 고치지 않았다
- 삭제 → `gh repo view` 가 "Could not resolve to a Repository" (삭제 확인)
- 문서: 통합 문서 §3-3·§4-6·마무리·§9, ROADMAP
- 남은 일
  - [ ] (권장) gh 토큰의 `delete_repo` 권한 거두기: `gh auth refresh -h github.com -r delete_repo`
  - [ ] 보관본을 지울 때 bundle 도 함께
- 메모: 이 기기에는 클립보드 도구(xsel·xclip)가 없어서 `gh auth refresh` 의 기기 코드가 화면 출력에만 남았다. `!` 로 실행하면 뒤로 돌아가 코드가 안 보일 수 있다

## 추가 (22:50): 개발 서버를 4000 번으로

- 사용자 요청: "지금 JohnnyStudio 서버를 내리고 4000번 포트에서 동작시켜줘."
- 바꾸기 전: `screen` 세션 `JohnnyStudio` 안에서 `HOST=0.0.0.0 ./dev.sh` (Next 0.0.0.0:3000, API 127.0.0.1:3001, 관리 127.0.0.1:3002)
- 4000 은 공유기가 인터넷에서 넘겨주는 포트다 (스토어 때 확인). 그래서 `PUBLIC_URL` 모드로 띄웠다
  - LAN 모드면 밖에서 들어온 방문자는 화면이 하이드레이션되지 않고 로그인이 거부된다
  - 관리 화면도 오래 쓰는 토큰 파일을 쓴다. `PUBLIC_URL` 모드는 둘 다 맞춰 주고, 토큰을 실행마다 새로 만든다 (ADR-0010)
- 한 일: 같은 `screen` 세션에 Ctrl+C → 3000~3002 정리 확인 → `PORT=4000 PUBLIC_URL=http://johnnyhouse.iptime.org:4000 ./dev.sh`
- 확인: 127.0.0.1·192.168.0.206·공인 주소의 4000 에서 200 (`/`, `/library/`, `/library/wlt/`, `Host: johnnyhouse.iptime.org:4000`), `/api/auth/me` 200 (`{"user":null}`), `/admin/` 200. 화면 출력은 토큰 줄을 빼고 확인했다
- 주의
  - `api/.env.local` 이 진짜 SMTP 다 (`JOHNNYSTUDIO_MAIL_BACKEND=smtp`). 공개 중에는 누구나 가입·재설정 메일을 보내게 할 수 있다 (앱 요청 제한: 같은 이메일 15분 3회, 같은 IP 1시간 10회)
  - `next dev` 가 `screen` 안에 업그레이드 선택 화면("Upgrade now / Skip / Skip until next version", 기본값 Upgrade now)을 띄웠다. 키를 보내지 않았다. 서버는 그대로 응답한다
- Next.js 권고 다시 보기
  - GHSA-pc58-hwjq-p385 는 "라우트 핸들러가 받은 응답을 그대로 돌려주고, 파이프라이닝을 허용하는 HTTP/1.1 리버스 프록시 뒤에 있을 때"다
  - 이 개발 서버는 rewrites 로 넘기고 앞에 프록시가 없어서 해당이 적어 보인다 (미검증)
  - 16.4.6 은 2026-11-09 에 나왔다. 2주 규칙으로는 2026-11-23 부터 고를 수 있다
- 남은 일
  - [x] Next.js 16.4.6: PR #1 로 이미 반영돼 있었다 (아래 추가 참고)
  - [ ] 공개 개발을 끝내면 끄고 공유기 4000 닫기

## 추가 (22:56): 개발 서버에서 다운로드가 안 되던 문제

- 사용자 보고: 다운로드 버튼을 누르면 브라우저가 "사이트에서 사용할 수 없는 파일"이라고 한다
- 원인: 버튼은 `/files/<slug>/<파일>` 을 가리킨다
  - 운영에서는 nginx 가 이 경로를 내주지만, 개발 서버에는 없었다 (`curl -I http://127.0.0.1:4000/files/wlt/…` → 404 text/html)
  - 파일은 `.local/files/` 에 있었다
  - `dev.sh` 머리말에도 "개발 미리보기에서는 404" 로 적혀 있었고, ROADMAP 2단계 할 일이었다
- 고친 것
  - `lib/admin/server.ts`: `/files/…` 를 토큰 없이 읽기 전용으로 내준다
    - 다운로드 보관 폴더에서 GET·HEAD, Range(206·416)
    - Content-Type 은 zip·pdf·이미지·mp4 만 따로, 나머지는 octet-stream
    - 404: 숨김 파일, 폴더, 폴더 밖 경로, 밖을 가리키는 심볼릭 링크
  - `next.config.ts` (개발 단계): `/files/:path*` → 관리 서버
  - 테스트 2개 (내려받기·HEAD·Range, 막는 경로들)
  - `dev.sh` 머리말, ARCHITECTURE §5-1, ROADMAP
- 관리 서버는 코드를 다시 읽지 않으므로 `screen` 의 `dev.sh` 를 같은 명령으로 다시 띄웠다 (관리 토큰이 새로 바뀜)
- 확인
  - `vitest` 관리 서버 9개 통과, `tsc`·`eslint` 깨끗
  - 공인 주소:4000 으로 공개 앱 9개를 모두 내려받아 SHA-256 이 작품 값과 일치 (CMG Monitor 118MB 포함)
  - 응답 `200 application/octet-stream`, `content-length`, `accept-ranges: bytes`. LAN 주소 Range → 206
  - `sample-*` 초안 2개는 자리표시 파일이라 없다 (예상대로)
- 미검증: 사용자 브라우저에서 직접 내려받기, 출시 빌드 미리보기(`preview.sh`)의 `/files/` (지원하지 않음)

## 추가 (23:13): 커밋·push 와 Next.js 16.4.6 병합

- 사용자 요청: "커밋 해줘." → 세 커밋으로 나눴다
  - `d71bb71` GitHub 삭제·4000 기록
  - `bb14584` `/files/` 수정
  - `10e41fc` `CLAUDE.md` 한국어 규칙
  - `ROADMAP`·작업 로그는 두 커밋 내용이 섞여 있어서 `git update-index --cacheinfo` 로 나눠 올렸다
- 사용자 요청: "push까지 해줘."
  - `git fetch` 해 보니 GitHub `main` 에 로컬에 없는 커밋 2개가 있었다
    - `3b96389` chore(web): Next.js 16.4.2 → 16.4.6 보안 업그레이드 (2026-11-22 04:15, 로컬 git 사용자)
    - `f34b48a` PR #1 병합 (04:54)
  - 바뀐 것: `package.json`·`package-lock.json` 의 `next`·`eslint-config-next` 16.4.6, `next.config.ts` 의 `experimental: { agentUpgrade: "security" }`
  - rebase 가 아니라 merge 로 합쳤다 (`a18e01a`). 문서와 커밋 메시지가 커밋 번호(`f336188`·`d9d351a` 등)를 가리켜서, 번호가 바뀌면 안 된다
  - 자동 병합 (충돌 없음)
- 개발 서버를 내리고 `npm --prefix web ci` (next 16.4.6) → `./scripts/check.sh` 첫 번에 통과 (웹 113, API 55, HTML 25, `SecurityFatalError` 없음) → 같은 명령으로 4000 에 다시 띄움 (관리 토큰 새로 바뀜)
- 확인
  - 공인 주소:4000 의 `/library/`·`/library/wlt/`·`/api/auth/me`·`/admin/` 200, WLT 다운로드 SHA-256 일치
  - `screen` 출력에서 16.4.6 실행 뒤 업그레이드 안내 0줄 (16.4.2 때 것만 4줄)
- 메모: 이 세션의 2주 규칙 계산(16.4.6 은 11-23 부터)과 달리, PR #1 은 13일째에 16.4.6 을 골랐다. 보안 업그레이드라서 사용자가 정한 것으로 보고 그대로 두었다

## 추가 (23:33): 테마 버튼이 동작하지 않던 문제

- 사용자 보고: Dark / Light 테마 버튼이 동작하지 않는다
- 재현 (헤드리스 Chrome + CDP 스크립트, scratchpad. 페이지를 열고 버튼을 눌러 `data-theme`·localStorage·React 연결 여부를 본다)
  - 도메인·LAN·127.0.0.1 은 동작했다
  - 공인 IP 숫자 주소는 HMR 웹소켓이 막혀 하이드레이션이 안 됐다 (모든 버튼이 죽는다)
- 원인: `screen` 의 개발 서버 로그에 `Blocked cross-origin request to Next.js dev resource /_next/hmr from "johnnystudio.net"`
  - 사용자는 `https://johnnystudio.net` 으로 들어오고 있었다
  - 저장소 밖 nginx 사이트(`/etc/nginx/sites-available/johnnystudio.net`, certbot, 11-16 생성. 원래 스토어용)가 443 → `127.0.0.1:4000` 으로 넘긴다. WebSocket 헤더는 이미 있다
  - 그런데 `dev.sh` 의 `PUBLIC_URL` 은 주소를 하나(`johnnyhouse.iptime.org:4000`)만 받았다. 그래서 Next `allowedDevOrigins` 와 API 허용 출처에 `johnnystudio.net` 이 없었다
- 고친 것
  - `dev.sh`: `PUBLIC_URL` 에 쉼표로 여러 주소. 첫 주소가 대표(메일 링크)이고, 모두 허용 호스트·출처에 넣는다
  - 경고 문구에 "빠진 주소로 들어오면 버튼이 동작하지 않는다" 를 더하고, 포트 번호를 실제 `$PORT` 로 바꿨다
  - 머리말에 예시를 적었다
- 다시 띄움: `PORT=4000 PUBLIC_URL=https://johnnystudio.net,https://www.johnnystudio.net,http://johnnyhouse.iptime.org:4000 ./dev.sh` (관리 토큰 바뀜)
- 확인
  - `JOHNNYSTUDIO_DEV_HOSTS` 에 세 호스트가 들어갔다
  - CDP 로 `https://johnnystudio.net/`, `https://www.johnnystudio.net/library/`, `http://johnnyhouse.iptime.org:4000/`, LAN 에서 버튼 → dark→light, 저장값 light, React 연결됨, 콘솔 오류 없음
  - 로그인 API: 세 출처는 출처 검사 통과(`invalid_credentials`), `https://evil.example` 은 403 `bad_origin`
- 미검증: 사용자 브라우저에서 직접 누르기, 공인 IP 숫자 주소로 들어오는 경우 (여전히 안 된다. 목록에 넣지 않았다)
- 문서: `dev.sh` 머리말, ARCHITECTURE §4(접속 주소·저장소 밖 nginx), ROADMAP 공개(도메인), 통합 문서의 실행 명령
