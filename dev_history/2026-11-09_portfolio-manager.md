# 2026-11-09: 작품 등록·관리 기능 (검토 → 계획 → 구현)

> **작업자**: 사용자 + Claude Code (Claude Opus 5.5)
> **관련**: [ADR-0009](../docs/04_architecture/adr/0009-local-portfolio-manager.md), [기능 명세](../docs/02_planning/features/portfolio-manager.md). 커밋 전 (마지막 커밋 `e1850e5`)

## 목표

사용자 요청: "신규 포트폴리오를 등록하고 관리하는 기능에 대해서 검토 및 세부 구현 계획 수립하여 기능 업데이트".
지금은 `content/assets/<slug>.md` 를 손으로 써야 작품이 등록된다. 이를 검토하고, 계획을 세우고, 구현까지 한다.

## 한 일

- **검토** (결과는 기능 명세 "왜" 표)
  - 등록·현황·미리보기·이미지·다운로드·공개·삭제 단계별 문제를 정리했다
  - 실제 버그 2건을 찾았다
    - 개발 미리보기가 콘텐츠 변경을 반영하지 않았다. `content.ts` 의 모듈 캐시 때문이다 (임시 파일을 더해도 개발 서버 화면에 안 나오는 것으로 재현)
    - 초안 4건의 한 줄 소개 "(초안) 한 줄 소개를 채워 주세요." 가 완성도 검사를 통과했다
  - 선택지 비교: 운영 관리자 화면, 외부 CMS, Next 라우트 핸들러, FastAPI 관리 라우터, 로컬 관리 도구. 로컬 관리 도구로 결정했다 (ADR-0009)
- **계획**: `docs/02_planning/features/portfolio-manager.md` (범위, 구조, API, 보안, 화면, 세부 단계, 다음 단계, 완료 기준). `docs/02_planning/features/` 폴더를 처음 만들었다
- **구현** (새 파일 약 3,800줄, 새 의존성 없음)
  - `web/src/lib/admin/`
    - `fields.ts`: 유형별 필드, 키 순서, slug 제안, YouTube ID 추출, 다운로드 짐작, 채울 것 문구. zod 없음
    - `types.ts`: API 형태
    - `templates.ts`: 유형별 새 작품 틀. `draft: true` 이고 채울 곳은 `TODO(content)`
    - `asset-file.ts`: `yaml` Document 로 바뀐 키만 고친다 (주석·순서 유지)
    - `store.ts`: 목록, 검사, 만들기, 저장(mtime 충돌 검사), 공개, 초안, 삭제(휴지통), 이미지, 다운로드 파일 조각 받기
    - `server.ts`: HTTP API, 토큰
    - `client.ts`: 화면용 클라이언트, 상태 저장소, 조각 업로드
  - 관리 화면 `/admin/`: `web/src/app/admin/page.dev.tsx` (개발 서버 전용)와 `web/src/components/admin/*` (목록, 새 작품 대화상자, 편집기, 입력 조각, 링크·사진·다운로드 목록)
  - 관리 CLI: `web/scripts/admin/cli.ts` (`list`·`check`·`new`·`publish`·`unpublish`·`serve`)와 `ts-hooks.mjs` (Node 26 타입 제거 실행에서 확장자 없는 import·`@/` 해석). `package.json` 에 `admin` 스크립트를 넣었다
  - `next.config.ts` (개발 단계만): `pageExtensions` 에 `dev.tsx` 를 넣고, `/__admin/` → 127.0.0.1:3002 로 넘긴다
  - 스크립트
    - `scripts/_admin.sh`: 토큰(`.local/admin-token`)을 만들고, 다운로드 보관 폴더를 정하고, 관리 서버를 띄운다
    - `scripts/_bg.sh`: 뒤에서 띄운 프로세스를 함께 끈다. `_api.sh` 의 trap 을 이것으로 바꿨다
    - `dev.sh`: 관리 서버 실행, `NO_ADMIN`·`ADMIN_PORT`. `PUBLIC_URL` 이면 관리 서버를 켜지 않는다
  - `content.ts`
    - 개발 중에는 파일 수정 시각·크기로 캐시를 무효화한다 (출시 빌드는 한 번만 읽는다)
    - `splitFrontmatterText`·`renderMarkdown`·`toAsset`·`listAssetFiles` 를 분리했다
    - `localMediaExists(src, publicDir)`, `missingFields` 가 본문 `TODO(` 도 잡는다
  - `check_site.py --built`: 출시 빌드에 `admin/` 이 있으면 실패한다 (`DEV_ONLY_PATHS`)
  - 초안 4건(`hardware-monitor`·`robot-project`·`skill-hub`·`ssh-terminal`)의 자리표시 한 줄 소개를 `"TODO(content): 한 줄 소개를 채워 주세요."` 로 바꿨다 (내용은 지어내지 않았다)
  - `.gitignore` 에 `.local/` 를 넣었다
- **문서**: ADR-0009(+ADR 목록), 기능 명세, CONTENT_GUIDE §0(관리 화면·CLI), ARCHITECTURE(§2·§5-1·§8), SITEMAP(`/admin/`), AGENTS.md(디렉터리·명령·규칙), docs/README, ROADMAP

## 결정 (→ ADR)

- **ADR-0009**: 작품 등록·관리는 개발 서버 전용 관리 화면(`page.dev.tsx`) + 127.0.0.1 로컬 관리 서버(Node, 토큰) + CLI 로 한다. 원본은 그대로 `content/` 파일이고, 커밋·배포는 사람이 한다
  - 덧붙인 규칙(AGENTS.md)
    - 개발 전용 페이지는 `page.dev.tsx` 로 만든다
    - `src/lib` 에서 enum·namespace·생성자 매개변수 속성을 쓰지 않는다
    - 스키마를 바꿀 때 `lib/admin/fields.ts` 도 함께 고친다
- ADR-0005 는 고치지 않았다. 처음에 재검토 조건에 메모를 달았다가 "기존 ADR 은 고치지 않는다" 규칙에 따라 되돌렸다. ADR-0009 가 0005 를 가리킨다

## 확인 (어떻게 검증했나)

- `./scripts/check.sh`: **✓ 모든 검사 통과**
  - 웹 테스트 108개(새로 57개: 작품 관리 55개 + content.test 2개), API 55개
  - 출시 빌드 HTML 16개. 라우트 목록에 `/admin` 이 없다
  - 한 번은 `server.test.ts` 의 타입 오류(`Buffer` 를 fetch 본문으로 넘김)로 실패했고, `Uint8Array` 로 고쳐 통과시켰다
- `out/admin/` 을 일부러 만들어서 `check_site.py --built` 가 "개발 전용 페이지(관리 화면)가 출시 빌드에 들어갔다" 로 실패하는 것을 확인하고 지웠다
- `PORT=3100 … ./scripts/dev.sh`
  - 회원 API, 관리 서버, 토큰 주소 출력까지 동작했다
  - Next 개발 서버는 이미 떠 있는 서버(:3000) 때문에 시작을 거부했다
  - 끝날 때 trap 이 3101·3102 를 정리한 것을 확인했다 (토큰 파일 600, 폴더 700)
- 사용자의 개발 서버(:3000, 설정 변경으로 자동 재시작)에 관리 서버(:3002)만 붙여서 API 흐름을 확인했다
  - 토큰 없음 401
  - 만들기 → `/library/` 에 바로 나옴 (캐시 수정 확인)
  - 저장, 오래된 mtime 저장 거부, 채우기 전 공개 거부, 공개, 공개 중 삭제 거부
- **30MB 업로드 실패를 발견했다.** Next 개발 서버가 rewrites 본문을 10MB 에서 자른다 (로그: "Request body exceeded 10MB", "socket hang up")
  - 8MB 조각 업로드로 바꿨다. 30MB 를 4조각으로 올려 SHA-256 일치를 확인했다
- 브라우저 확인: 임시 Playwright 스크립트(scratchpad, 저장소에 넣지 않음)로 23개 항목을 통과했다
  - 토큰 안내, 주소에서 토큰 지움, 샘플 거르기, slug 제안
  - 만들기 → 편집 → YouTube 주소에서 ID 추출 → 형식 오류가 필드 옆에 보임 → 본문 TODO 로 공개 막힘
  - 공개 → 미리보기 반영 → 초안 → 삭제
  - 20MB 설치 파일 업로드와 이름표·버전 짐작
  - 390px 가로 스크롤 없음, 콘솔 오류 없음 (일부러 낸 422 는 제외)
  - 처음 돌렸을 때 이미 열린 탭에 `#k=` 를 붙여 넣으면 토큰을 못 읽는 문제를 찾아 `hashchange` 처리를 더했다
- 스크린샷으로 데스크톱 목록·편집기, 휴대폰, 밝은 테마를 눈으로 확인했다
  - 밝은 테마의 첫 스크린샷은 전환 애니메이션 중이라 어둡게 찍혔다. 0.8초 뒤 다시 찍어 정상인 것을 확인했다
- 시험으로 만든 작품(`zz-e2e-tool`, `e2e-video-clip`), 이미지, 다운로드 파일, 휴지통을 지웠다. 세션 출력에 노출된 토큰 때문에 `.local/` 도 통째로 지웠다
- **미검증**
  - 사용자가 직접 `./scripts/dev.sh` 를 다시 띄웠을 때의 전체 흐름. 이번에는 이미 떠 있는 서버에 관리 서버만 따로 붙였다
  - `HOST=0.0.0.0` 으로 다른 기기(휴대폰·다른 PC)에서 관리 화면 쓰기
  - `/opt/johnnystudio/files` 가 있을 때 운영 다운로드 폴더에 바로 저장하는 경로 (서버 설정 전이라 폴더가 없다)
  - 수백 MB 이상 파일, 4GB 한도 근처
  - 실제 스크린리더 사용

## 남은 일 · 다음 세션

- [ ] 사용자: 지금 떠 있는 `dev.sh`(:3000)를 껐다 다시 켜서 관리 화면 주소(`#k=…`)로 들어가 본다
- [ ] 관리 화면으로 초안 4건 채우기, 대표 작품 등록 (ROADMAP Phase 1 콘텐츠)
- [ ] 이번 변경 커밋 (사용자 요청 시)
- [ ] (필요해지면) 2단계: Life Log·서비스 편집, 개발 미리보기에서 `/files/` 열기, 이미지 px 경고, 바뀐 파일·검사 실행 보기
- [ ] 브라우저 상호작용 테스트를 저장소에 넣기 (사이트 18개 + 관리 화면 23개 항목이 임시 스크립트로만 있다)

## 메모

- Next 16 에서 실제로 겪은 것
  - `output: "export"` 면 **개발 서버도** POST 라우트 핸들러를 거부한다
  - `pageExtensions` 는 App Router 에서도 동작한다 (`page.dev.tsx`)
  - 한 프로젝트에 개발 서버는 하나만 뜬다 (`.next/dev` 잠금)
  - rewrites 본문은 10MB 에서 잘린다
- Node 26 은 `.ts` 를 바로 실행하지만 import 확장자를 요구한다
  - 해석 훅으로 해결했다
  - `package.json` 에 `"type"` 이 없어서 생기는 `MODULE_TYPELESS_PACKAGE_JSON` 경고는 `--disable-warning` 으로 끈다 (`"type": "module"` 은 다른 설정 파일에 영향이 있어서 넣지 않았다)
- 관리 화면의 Playwright 스크립트는 지난 세션 scratchpad 의 `playwright-core` 를 그대로 썼다
- `layout.tsx` 는 `getProfile()` 을 모듈을 읽을 때 한 번만 부른다. 그래서 개발 중 `profile.yaml` 을 고치면 머리(meta) 문구는 다시 켜야 바뀔 수 있다 (본문은 바로 바뀐다, 미검증)

## 추가 (09:23): PUBLIC_URL 에서도 관리 화면 켜기

> **관련**: [ADR-0010](../docs/04_architecture/adr/0010-admin-on-public-dev-server.md) (ADR-0009 결정 4 대체)

### 한 일

- 사용자 요청: "PUBLIC으로 동작 시켜도 관리자 메뉴 들어갈 수 있도록 수정해 줘."
  - 사용자가 09:19 에 `dev.sh` 를 `0.0.0.0` 으로 다시 띄웠는데, 그때 코드로는 관리 서버가 꺼져 있었다. 그래서 Next 로그에 `connect ECONNREFUSED 127.0.0.1:3002` 가 찍혔다
- `dev.sh`: `PUBLIC_URL` 이어도 관리 서버를 켠다 (`ADMIN=1` 은 없앴다, 끄려면 `NO_ADMIN=1`). 인터넷 공개 경고에 관리 화면·http 평문 안내를 더했다
- `_admin.sh`: `start_admin <포트> --public`
  - 공개 모드는 토큰을 실행마다 새로 만들고 파일에 남기지 않는다
  - 공개 모드는 다운로드 파일을 운영 폴더가 아니라 `.local/files` 에 둔다
  - 토큰은 파일 대신 환경 변수로 넘긴다 (일반 모드도 같다)
- `server.ts`: 토큰이 틀린 요청을 터미널에 알린다 (1분에 한 줄, 누적 횟수·경로·`X-Forwarded-For`). 테스트 1개를 더했다
- 문서: ADR-0010 새로 씀. ADR-0009 는 상태만 "일부 대체됨"으로 바꿨다. 기능 명세 보안, CONTENT_GUIDE §0, ARCHITECTURE §5-1, ADR 목록, docs/README 를 고쳤다

### 결정 (→ ADR)

- ADR-0010: 공개 모드에서도 켠다. 실행마다 새 토큰을 쓰고, 운영 다운로드 폴더에는 쓰지 않고, 틀린 토큰은 알린다

### 확인

- `./scripts/check.sh`: ✓ 모든 검사 통과 (웹 테스트 109개, API 55개)
- `start_admin 3102 --public` 를 따로 실행했다 (토큰은 출력하지 않음)
  - 토큰 43자, 보관 폴더 `.local/files`
  - 맞는 토큰 200, 틀린 토큰 401, 터미널에 "토큰이 맞지 않는 요청 (지금까지 1회 … 203.0.113.7)" 이 찍혔다
  - 끝난 뒤 3102 포트가 정리됐다
- `PUBLIC_URL=http://127.0.0.1:3100 PORT=3100 … ./scripts/dev.sh` (토큰은 가려서 확인)
  - 경고 문구, 관리 서버 시작, "이번 실행에만 유효" 안내가 나왔다
  - 일반 모드의 `.local/admin-token` 은 바뀌지 않았다 (수정 시각 그대로)
  - Next 는 사용자의 개발 서버(:3000) 때문에 시작을 거부했고, 끝난 뒤 3100~3102 가 모두 정리됐다
- **미검증**
  - 실제 인터넷 주소(`johnnyhouse.iptime.org:3000`)로 밖에서 관리 화면 쓰기
  - 사용자가 지금 띄워 둔 `dev.sh` 는 고치기 전 코드다. 다시 띄워야 반영된다

### 남은 일

- [ ] 사용자: 지금 `dev.sh` 를 껐다가 `PUBLIC_URL=… ./scripts/dev.sh` 로 다시 띄우고, 터미널의 새 `#k=` 주소로 들어가 본다
- [ ] 개발 서버를 HTTPS(Cloudflare Tunnel 등)로 공개하게 되면 ADR-0010 의 재검토 조건을 본다
