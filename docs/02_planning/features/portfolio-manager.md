# 기능: 작품 관리 (등록·수정·공개·삭제)

> **상태**: 1단계 완료 (로컬 관리 화면 + 관리 CLI). 2단계 이후는 계획
> **Last Updated**: 2026-11-26
> 결정: [ADR-0009](../../04_architecture/adr/0009-local-portfolio-manager.md) · 바탕: [ADR-0005](../../04_architecture/adr/0005-file-based-content.md) (파일 콘텐츠), [ADR-0004](../../04_architecture/adr/0004-nextjs-static-export.md) (정적 내보내기)

## 왜 (문제와 목적)

Library 는 작품을 잘 보여 주지만, **작품을 넣고 고치는 일은 전부 손으로 한다.** 2026-11-09 에 확인한 현재 흐름과 문제는 다음과 같다.

| 단계 | 지금 하는 일 | 문제 |
|---|---|---|
| 새 작품 | `content/assets/<slug>.md` 를 만들고 CONTENT_GUIDE 의 표를 보며 YAML 을 쓴다 | 유형마다 필드가 다르다(7종). 오타·빠진 필드는 `check.sh` 를 돌려야 안다 |
| 현황 보기 | 파일을 하나씩 연다 | 무엇이 공개·초안·샘플인지, 공개하려면 무엇이 빠졌는지 한눈에 볼 곳이 없다. 완성도 검사(`missingFields`)는 테스트가 실패할 때만 보인다 |
| 미리보기 | `dev.sh` 를 띄워 둔 채 파일을 고친다 | **고친 내용이 화면에 나오지 않는다.** `content.ts` 가 처음 읽은 결과를 모듈에 담아 두기 때문에 개발 서버를 다시 켜야 한다 (2026-11-09 에 재현) |
| 이미지 | `web/public/media/<slug>/` 에 복사하고 경로·대체 텍스트를 손으로 적는다 | 경로 오타는 테스트에서야 잡힌다 |
| 다운로드 파일 | `file-meta.sh` 결과를 붙여 넣고, 서버 복사 명령을 따로 친다 | 단계가 셋으로 나뉘어 빠뜨리기 쉽다 |
| 공개 | `draft: true` 를 지운다 | 그 자리에서 완성도를 알려 주지 않는다. 초안 4건의 한 줄 소개 "(초안) 한 줄 소개를 채워 주세요." 는 검사를 **통과해 버린다** |
| 삭제 | 파일을 지운다 | Life Log·서비스가 가리키던 작품이면 테스트가 깨진다 |

목적: **작품 하나를 등록해서 공개하기까지를 화면 하나에서, 실수 없이** 끝낸다. 원본은 지금처럼 `content/` 파일이고 git 이 이력을 남긴다 (Sovereignty 원칙, ADR-0005).

## 검토한 방식

| 방식 | 판단 | 이유 |
|---|---|---|
| A. 운영 사이트에 관리자 화면 (로그인 + 관리자 권한 → 서버가 파일을 쓰고 다시 빌드·배포) | **지금은 하지 않음** | 공개 서버에 "저장소에 쓰고 빌드를 실행하는" 경로가 생긴다 (계정 탈취 = 사이트 변조). 2단계 인증이 아직 없다. git 이력을 거치지 않는다. 운영자 1명에게 비해 운영 부담이 크다 |
| B. 외부 Headless CMS (Decap·Tina 등) | 하지 않음 | 외부 서비스·OAuth 의존, 스키마를 두 벌 관리, 셀프 호스팅·의존 최소 원칙과 맞지 않는다 |
| C. Next 개발 서버의 라우트 핸들러(`route.ts`)로 쓰기 API | 불가 | `output: "export"` 에서는 개발 서버도 POST 라우트를 거부한다 (2026-11-09 시험: "export const dynamic … not configured on route … with output: export") |
| **D. 로컬 관리 도구**: 개발 서버 전용 관리 화면 + 127.0.0.1 관리 서버 + CLI, 같은 zod 스키마 재사용 | **채택** | 운영 공격면이 늘지 않는다. 결과물이 그대로 `content/` 파일이라 git 으로 검토·되돌리기가 된다. 스키마·완성도 검사를 그대로 쓴다. AI 도구는 CLI 를 쓴다 |

## 무엇을 (범위)

- **포함 (1단계, 이번 구현)**
  - 관리 화면 `/admin/` (개발 서버 전용. 출시 빌드에는 들어가지 않는다)
    - 현황: 전체·공개·초안·출시 가능·보완 필요 개수, 상태별 거르기, 검색
    - 작품마다: 유형·상태, 공개/초안, **형식 오류**, **공개하려면 채울 것**(완성도 검사), 경고, 참조(Life Log·서비스)
    - 새 작품: 유형 고르기 → 이름·주소(slug)·한 줄 소개 → 초안 파일 생성
    - 편집: 공통 필드, 유형별 필드(주소·영상·사진·다운로드·웹 패키지), 링크, 본문(Markdown). 저장 전에 스키마로 검사하고, 틀리면 쓰지 않는다
    - 이미지 올리기 → `web/public/media/<slug>/` (형식 확인, 300KB·webp 기준 경고), 대표 이미지·사진 목록에 바로 연결
    - 다운로드 파일 올리기 → 크기·SHA-256 을 계산해 `downloads` 에 채우고, 서버 복사 명령을 보여 준다
    - 공개(완성도 검사를 통과할 때만) · 초안으로 되돌리기 · 삭제(초안만, 참조가 없을 때만, `.local/trash/` 로 옮김)
    - (2026-11-26) Store·Showroom 목록의 '공식' 카드에서도 지운다: 같은 관리 서버 API 로 초안으로 돌린 뒤 삭제 (개발 서버, 운영자·토큰, `components/store/official-delete.tsx`)
    - 다른 도구(편집기·AI)가 그사이에 파일을 고쳤으면 저장을 거부한다 (덮어쓰기 방지)
  - 관리 CLI `npm --prefix web run admin -- <명령>`: `list` · `check` · `new` · `publish` · `unpublish` · `serve`
  - 개발 미리보기가 콘텐츠 변경을 바로 반영한다 (파일 수정 시각을 보고 다시 읽는다)
  - 완성도 검사 보강: 본문의 `TODO(` 도 잡는다. 초안 4건의 자리표시 한 줄 소개를 `TODO(content)` 로 바꿔 검사에 걸리게 한다
- **포함하지 않음 (1단계)**
  - 운영 사이트에서 편집, 여러 사람 동시 편집, 권한
  - 이미지 변환·크기 조절 (webp 변환은 직접 한다. 의존성 `sharp` 를 들이지 않는다)
  - slug 바꾸기 (주소가 바뀌면 즐겨찾기·외부 링크가 깨진다. 초안이면 지우고 새로 만든다)
  - Life Log·profile.yaml 편집, git 커밋·배포 버튼

## 구조

```
브라우저 /admin/  (web/src/app/admin/page.dev.tsx: 개발 서버에서만 페이지가 된다)
   │  fetch /__admin/*   Authorization: Bearer <관리 토큰>
   ▼
Next 개발 서버 rewrites (next.config.ts, 개발 단계에서만)
   ▼
관리 서버 127.0.0.1:3002  (web/scripts/admin/cli.ts serve → src/lib/admin/server.ts)
   │  Node 26 의 타입 제거 실행 + 확장자 해석 훅 (scripts/admin/ts-hooks.mjs). 새 의존성 없음
   │  src/lib/admin/store.ts ── schema.ts(zod) · content.ts(missingFields) 를 그대로 쓴다
   ▼
content/assets/<slug>.md   web/public/media/<slug>/*   다운로드 파일 보관 폴더/<slug>/*   .local/trash/
```

| 파일 | 역할 |
|---|---|
| `web/src/lib/admin/fields.ts` | 유형별 필드 목록·키 순서·slug 제안·YouTube ID 추출 (zod 없음: 화면에서도 쓴다) |
| `web/src/lib/admin/types.ts` | 관리 API 주고받는 형태 |
| `web/src/lib/admin/asset-file.ts` | 머리말 읽기·쓰기. `yaml` 의 Document 로 **주석을 지키며** 바뀐 키만 고친다 |
| `web/src/lib/admin/templates.ts` | 유형별 새 작품 틀 (`draft: true`, 채울 곳은 `TODO(content)`) |
| `web/src/lib/admin/store.ts` | 목록·읽기·만들기·저장·공개·삭제·이미지·다운로드 파일 (경로 검사, 원자적 쓰기) |
| `web/src/lib/admin/server.ts` | HTTP API (토큰, JSON 형식, 크기 제한) |
| `web/src/lib/admin/client.ts` | 화면용 API 클라이언트·토큰 보관(sessionStorage)·상태 저장소 |
| `web/src/components/admin/*` | 관리 화면 |
| `web/scripts/admin/{cli.ts,ts-hooks.mjs}` | CLI 진입점, TypeScript 실행 훅 |
| `scripts/_admin.sh` | `dev.sh` 가 관리 서버를 띄우고 함께 끈다 |

## API (관리 서버, 모두 토큰 필요)

| 요청 | 하는 일 | 실패 |
|---|---|---|
| `GET /__admin/state` | 작품 목록(행), 쓰고 있는 태그, 다운로드 보관 위치 | |
| `GET /__admin/assets/<slug>` | 머리말(가공 전 값)·본문·검사 결과·파일 수정 시각 | 404 |
| `POST /__admin/assets` `{slug,type,title,summary?,date?}` | 초안 파일 만들기 | 400 형식, 409 이미 있음 |
| `PUT /__admin/assets/<slug>` `{data,body,baseMtime}` | 저장 (스키마 통과 시에만) | 422 형식 오류(필드별), 409 그사이 바뀜 |
| `POST /__admin/assets/<slug>/publish` | `draft` 지우기 | 409 채울 것 목록 |
| `POST /__admin/assets/<slug>/unpublish` | `draft: true` | |
| `DELETE /__admin/assets/<slug>` | `.local/trash/` 로 옮기기 (본문·이미지 폴더) | 409 공개 중 또는 참조 있음 |
| `POST /__admin/assets/<slug>/media?name=` (본문 = 파일) | 이미지 저장 (webp·png·jpg·avif, 10MB, 파일 머리로 형식 확인) | 400, 409 같은 이름 |
| `POST /__admin/assets/<slug>/files?name=&upload=&offset=&last=` (본문 = 8MB 이하 조각) | 다운로드 파일을 조각으로 이어 받고, 마지막 조각 뒤 크기·SHA-256 (최대 4GB) | 409 같은 이름(공개된 파일을 덮지 않는다)·순서 어긋남 |

## 보안

- 관리 서버는 **127.0.0.1 에서만** 듣는다. 화면은 개발 서버를 거쳐 들어오므로, `HOST=0.0.0.0` 이면 같은 네트워크의 다른 기기도 화면에 닿는다. 그래서 **토큰**을 요구한다
  - 토큰은 `.local/admin-token` (권한 600, git 제외)에 한 번 만들고 계속 쓴다. `dev.sh` 가 `http://…/admin/#k=<토큰>` 을 찍는다 (`#` 뒤라 서버 로그·Referer 에 남지 않는다). 화면은 토큰을 탭의 sessionStorage 에 두고 주소에서 지운다
  - 토큰은 `Authorization` 헤더로 보낸다. 다른 사이트는 이 헤더를 붙여 보낼 수 없다 (CORS 사전 요청을 받아 주지 않는다) → CSRF 방어
- `PUBLIC_URL`(인터넷 공개)로 `dev.sh` 를 띄워도 관리 서버를 켠다 ([ADR-0010](../../04_architecture/adr/0010-admin-on-public-dev-server.md), 2026-11-09 사용자 요청). 이때는
  - 토큰을 실행할 때마다 새로 만들고 파일에 남기지 않는다 (http 로 새어 나가도 끄면 쓸 수 없다)
  - 다운로드 파일은 운영 폴더가 아니라 `.local/files` 에 둔다
  - `NO_ADMIN=1` 이면 끈다
- 토큰이 틀린 요청은 관리 서버가 터미널에 알린다 (1분에 한 줄)
- slug 는 `SLUG_PATTERN`, 파일 이름은 영문·숫자·`.`·`-`·`_` 만 남긴다. 쓰는 위치는 정해진 세 폴더 아래로만 (경로 탈출 검사)
- 이미지는 SVG 를 받지 않는다 (같은 출처에서 스크립트를 실행할 수 있다)
- 출시 빌드에 `/admin/` 이 들어가면 `check_site.py --built` 가 실패한다

## 화면과 동작

- **목록**: 위에 개수 카드(전체·공개·초안·출시 가능·보완 필요), 그 아래 거르기·검색·정렬(최근 수정·이름), 작품 행
  - 행: 대표 이미지 썸네일, 이름·slug, 유형·상태 배지, 공개/초안, 검사 결과(✓ 출시 가능 / 채울 것 n개 / 형식 오류), 버튼(편집·미리보기·공개 또는 초안으로)
  - 휴대폰에서는 행이 카드처럼 세로로 쌓인다
- **새 작품** (`<dialog>`): 유형 7가지 중 고르기(할 수 있는 일 설명) → 이름 → 주소(이름이 영문이면 자동 제안, 형식 즉시 검사) → 한 줄 소개(140자 카운터) → 만들면 바로 편집으로
- **편집** (`/admin/?edit=<slug>`): 왼쪽 폼, 오른쪽(휴대폰에서는 위) 검사 패널
  - 기본 정보 → 대표 이미지 → 유형별 → 링크 → 본문
  - 저장하면 서버 검사 결과로 패널이 바뀐다. 형식 오류는 해당 필드 이름과 함께 보인다
  - 공개 버튼은 채울 것이 없을 때만 누를 수 있다. 삭제는 초안일 때만, 확인 대화상자를 거친다 (`danger` 토큰)
  - 저장하지 않은 변경이 있으면 목록으로 돌아갈 때 확인한다
- 키보드만으로 모두 쓸 수 있고, 아이콘 버튼에는 이름이 있다. 두 테마 모두 토큰 색만 쓴다

## 세부 구현 계획 (1단계)

1. `content.ts`: 개발 중 파일 수정 시각 기반 캐시, `toAsset()`·`splitFrontmatterText()` 분리, `localMediaExists(src, publicDir)`, 본문 `TODO(` 검사
2. `lib/admin/fields.ts`·`types.ts`·`templates.ts`·`asset-file.ts`·`store.ts`·`server.ts` + 테스트
3. `scripts/admin/ts-hooks.mjs`·`cli.ts`, `package.json` 의 `admin` 스크립트
4. `next.config.ts` (개발 단계만): `pageExtensions` 에 `dev.tsx`, `/__admin/` 넘기기
5. `scripts/_admin.sh`·`dev.sh`: 토큰, 관리 서버 실행·종료, 다운로드 보관 위치 결정, 주소 안내
6. 관리 화면: `app/admin/page.dev.tsx`, `components/admin/*`, `lib/admin/client.ts`
7. `check_site.py`: 출시 빌드에 `/admin/` 이 있으면 실패
8. 초안 4건의 자리표시 한 줄 소개를 `TODO(content)` 로
9. 문서: ADR-0009, CONTENT_GUIDE, ARCHITECTURE, AGENTS.md, SITEMAP, ROADMAP
10. 확인: `check.sh`, 개발 서버에서 만들기 → 이미지 → 저장 → 공개 거부 → 채우기 → 공개 → 초안 → 삭제 흐름, 화면이 바로 반영되는지

## 구현하면서 확인한 것 (2026-11-09)

- **Next 개발 서버는 rewrites 로 넘기는 요청 본문을 10MB 까지만 전달한다.** 30MB 설치 파일이 "socket hang up" 으로 실패했다.
  한도를 올리면 본문 전체를 메모리에 담으므로, 화면이 8MB 조각으로 나눠 보내고 관리 서버가 이어 붙이게 바꿨다 (이미지는 8MB 한도로 한 번에).
- 이미 열린 탭에 `#k=…` 주소를 붙여 넣으면 해시만 바뀌어 토큰을 읽지 못했다 → `hashchange` 도 듣는다.
- Next 는 한 프로젝트에 개발 서버를 하나만 허용한다 ("Another next dev server is already running"). 관리 화면 확인은 이미 떠 있는 개발 서버(:3000)에 관리 서버만 붙여서 했다.
- 확인 결과
  - 테스트: vitest 108개 (새로 57개: 작품 관리 55개 + content.test 2개), `check.sh` 전체 통과, 출시 빌드 라우트에 `/admin` 없음, `out/admin/` 이 생기면 `check_site.py` 실패 (일부러 만들어 확인)
  - 개발 서버를 거친 API: 만들기 → 바로 `/library/` 에 보임(캐시 수정 확인) → 30MB 조각 업로드(SHA-256 일치) → 저장 → 오래된 mtime 저장 거부 → 공개 → 공개 중 삭제 거부
  - 브라우저(Playwright, 임시 스크립트) 23개: 토큰 안내·주소에서 토큰 지움, 거르기, slug 제안, 만들기→편집, YouTube 주소→ID, 형식 오류가 필드 옆에, 본문 TODO 로 공개 막힘, 공개→미리보기 반영→초안→삭제, 20MB 설치 파일 업로드와 이름표·버전 짐작, 390px 가로 스크롤 없음, 콘솔 오류 없음
  - 시험으로 만든 작품·파일은 지웠다

## 다음 단계 (계획)

| 단계 | 내용 | 조건 |
|---|---|---|
| 2단계 | Life Log 마일스톤 편집, `profile.yaml` 의 서비스 연결, 개발 미리보기에서 `/files/` 다운로드 열기, 이미지 크기(가로 px) 경고 | 실제 작품을 5개 넘게 등록하면서 불편이 확인되면 |
| 2단계 | "커밋 준비" 보기: 바뀐 파일 목록과 `check.sh` 실행 버튼 (커밋은 여전히 사람이) | |
| 3단계 | 운영 사이트 관리자 화면 (방식 A) | 2단계 인증, 관리자 권한, 감사 로그가 갖춰지고, 밖에서 편집해야 할 이유가 생길 때. 새 ADR 필요 |

## 완료 기준

- [x] `/admin/` 에서 새 작품을 만들고, 이미지를 올리고, 저장하고, 미리보기(`/library/<slug>/`)에 바로 나온다
- [x] 채울 것이 남은 작품은 공개 버튼이 막히고, 무엇이 빠졌는지 보인다
- [x] 출시 빌드(`web/out`)에 `/admin/` 이 없다
- [x] `./scripts/check.sh` 통과

## 미결정

- 다운로드 파일을 운영 위치(`/opt/johnnystudio/files`)에 바로 둘지: 지금은 그 폴더가 있고 쓸 수 있으면 `dev.sh` 가 그곳을 쓰고, 없으면 `.local/files/` 에 두고 복사 명령을 보여 준다 (서버 설정 전이라 아직 없다)
