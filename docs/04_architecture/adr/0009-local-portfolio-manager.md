# ADR-0009: 작품 등록·관리는 개발 서버 전용 관리 화면과 로컬 관리 서버로 한다

- **상태**: 일부 대체됨 (→ [ADR-0010](0010-admin-on-public-dev-server.md): 결정 4 의 "PUBLIC_URL 이면 켜지 않는다")
- **날짜**: 2026-11-09
- **관련**: [ADR-0005](0005-file-based-content.md) (파일 콘텐츠, 재검토 조건 "웹에서 콘텐츠를 편집하는 관리 화면이 필요해질 때"), [ADR-0004](0004-nextjs-static-export.md) (정적 내보내기), [ADR-0007](0007-magic-link-auth-api.md) (인증 단일 권위), [기능 명세](../../02_planning/features/portfolio-manager.md)

## 맥락

- 작품은 `content/assets/<slug>.md` 를 손으로 써서 등록한다. 유형 7가지마다 필드가 다르고, 이미지 경로·체크섬·대체 텍스트를 맞춰야 한다. 오류는 `check.sh` 를 돌려야 보인다.
- 공개하려면 무엇이 빠졌는지(완성도 검사 `missingFields`)는 테스트가 실패할 때만 보인다. 초안 4건의 자리표시 한 줄 소개는 검사를 통과해 버렸다.
- 개발 미리보기(`dev.sh`)는 콘텐츠 파일을 고쳐도 다시 켜기 전까지 옛 내용을 보여 줬다 (`content.ts` 모듈 캐시, 2026-11-09 재현).
- 운영자는 1명이고, 개발 기기(M8)가 곧 운영 서버다. 2단계 인증은 아직 없다.
- 정적 내보내기(`output: "export"`)에서는 **개발 서버도 POST 라우트 핸들러를 거부한다** (2026-11-09 시험: `export const dynamic = "force-static"/export const revalidate not configured on route … with "output: export"`).
- Next 개발 서버는 rewrites 로 넘기는 요청 본문을 **10MB 까지만** 전달한다 (2026-11-09 확인: 30MB 업로드가 "socket hang up").

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| A. 운영 사이트 관리자 화면 (로그인 + 관리자 권한, 서버가 파일을 쓰고 빌드·배포) | 어디서나 편집 | 공개 서버에 "저장소에 쓰고 빌드를 실행하는" 경로가 생긴다 (계정 탈취 = 사이트 변조). 2단계 인증 없음. git 을 거치지 않는다 |
| B. 외부 Headless CMS (Decap·Tina 등) | 완성된 편집 화면 | 외부 서비스·OAuth 의존, 스키마 두 벌, 셀프 호스팅 원칙과 어긋남 |
| C. Next 개발 서버 라우트 핸들러 | 프로세스 하나 | 정적 내보내기에서 동작하지 않는다 (위 시험). 개발 설정에서 `output` 을 빼면 개발·출시 동작이 달라진다 |
| C'. FastAPI(`api/`)에 관리 라우터 | 서버 코드는 한 곳 | 스키마(zod)를 Python 으로 한 벌 더 써야 한다. 운영 API 에 콘텐츠 쓰기 코드가 들어간다 |
| **D. 개발 서버 전용 관리 화면 + 127.0.0.1 로컬 관리 서버(Node) + CLI** | 운영 공격면 그대로. 결과가 `content/` 파일이라 git 으로 검토·되돌리기. zod 스키마·완성도 검사를 그대로 재사용. 새 의존성 없음 | 개발 서버를 띄운 기기에서만 편집 (같은 네트워크면 다른 기기도 가능) |

## 결정

1. **관리 화면** `/admin/` 은 `web/src/app/admin/page.dev.tsx` 다. `next.config.ts` 의 개발 단계에서만 `pageExtensions` 에 `dev.tsx` 를 넣으므로 **출시 빌드에는 페이지가 생기지 않는다.** `check_site.py --built` 가 `out/admin/` 이 있으면 실패한다.
   - 앞으로 개발 전용 페이지는 `page.dev.tsx` 로 만들고 `check_site.py` 의 `DEV_ONLY_PATHS` 에 더한다.
2. **로컬 관리 서버** (`web/scripts/admin/cli.ts serve` → `src/lib/admin/server.ts`): Node 26 의 타입 제거 실행으로 `src/lib` 의 TypeScript 를 빌드 없이 쓴다. 확장자 없는 import 는 `scripts/admin/ts-hooks.mjs` 의 해석 훅이 `.ts` 를 붙여 찾는다 (`tsx` 같은 의존성을 들이지 않는다).
   - 이 때문에 `src/lib` 에서는 **enum·namespace·생성자 매개변수 속성**(`constructor(readonly x)`)을 쓰지 않는다 (타입 제거 실행이 지원하지 않는다).
   - `dev.sh` 가 127.0.0.1:3002(`ADMIN_PORT`)에 띄우고, Next 개발 서버가 `/__admin/` 을 넘긴다 (개발 단계 rewrites).
3. **원본은 그대로 `content/` 파일**이다. 관리 서버는 사람이 하던 일을 대신할 뿐이다.
   - 스키마를 통과하지 못하면 쓰지 않는다. 머리말은 `yaml` 의 Document 로 바뀐 키만 고쳐 주석·순서를 지킨다.
   - 공개(`draft` 지우기)는 완성도 검사를 통과할 때만 한다. 삭제는 초안이고 참조(Life Log·서비스)가 없을 때만, `.local/trash/` 로 옮긴다.
   - 저장할 때 불러온 뒤 파일이 바뀌었으면(편집기·AI 도구) 거부한다.
   - 커밋·배포는 하지 않는다 (지금처럼 사람이 `check.sh` → 커밋 → `deploy.sh`).
4. **보안**: 관리 서버는 127.0.0.1 에서만 듣고, 모든 요청에 **관리 토큰**(`Authorization: Bearer`)을 요구한다. 토큰은 `.local/admin-token`(600, git 제외)에 한 번 만들고, `dev.sh` 가 `…/admin/#k=<토큰>` 을 찍는다. `PUBLIC_URL`(인터넷 공개)로 띄울 때는 관리 서버를 켜지 않는다. 쓰는 곳은 `content/assets`, `web/public/media/<slug>`, 다운로드 보관 폴더, 휴지통으로 제한하고, 이미지는 SVG 를 받지 않는다.
5. **업로드**: 이미지는 8MB 까지 한 번에, 다운로드 파일은 8MB 조각으로 나눠 이어 받는다 (Next 개발 프록시의 10MB 한도). 크기·SHA-256 은 서버가 완성된 파일에서 계산한다. 보관 폴더는 `/opt/johnnystudio/files` 가 있고 쓸 수 있으면 그곳, 아니면 `.local/files/` 이고 서버 복사 명령을 보여 준다. 같은 이름의 파일은 덮어쓰지 않는다 (공개된 체크섬 보호).
6. **CLI** `npm --prefix web run admin -- list|check|new|publish|unpublish` 는 같은 로직을 쓴다 (AI 도구용).
7. 개발 서버의 콘텐츠 캐시는 파일 수정 시각·크기로 무효화한다. 출시 빌드는 지금처럼 한 번만 읽는다.

## 결과

- **좋아지는 점**: 작품 등록·공개가 화면 하나에서 끝나고, 빠진 것이 바로 보인다. 고친 내용이 미리보기에 바로 나온다. 운영 서버에는 아무것도 늘지 않는다. git 이력·검토가 그대로다.
- **감수할 점**: 개발 서버를 띄워야 편집할 수 있다. 관리 서버 코드는 Node 의 타입 제거 실행 제약을 지켜야 한다. Next 개발 서버의 동작(rewrites 본문 한도 등)에 기대는 부분이 있어 Next 를 올릴 때 확인한다.

## 재검토 조건

- 밖에서(개발 기기 없이) 작품을 고쳐야 할 이유가 생기고, 2단계 인증·관리자 권한·감사 로그가 갖춰질 때 → 운영 관리자 화면(A)을 새 ADR 로 검토
- 작품 수가 수백 개를 넘어 파일 기반 목록·검사가 느려질 때
- Next.js 가 정적 내보내기에서 개발 전용 라우트를 지원하거나, `pageExtensions`·rewrites 동작이 바뀔 때
