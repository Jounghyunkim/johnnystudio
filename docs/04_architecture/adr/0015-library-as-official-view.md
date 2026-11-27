# ADR-0015: Library 는 Store·Showroom 의 공식 앱·서비스를 모아 보는 곳이다

- **상태**: 제안됨
- **날짜**: 2026-11-27
- **관련**: [ADR-0014](0014-official-apps-in-store-db.md) 결정 2 (Library 상세의 'Store에서 내려받기'·'Showroom 소개' → 이 ADR 이 대체), [ADR-0012](0012-member-store.md),
  [ADR-0005](0005-file-based-content.md) (작품은 파일), [ADR-0004](0004-nextjs-static-export.md) (정적 내보내기)

## 맥락

- 사용자 요청 (2026-11-27): "Library에서 앱 또는 웹 서비스 항목을 클릭했을 때 Store 및 Showroom의 설명이 보이도록 통일시켜줘. 별도의 설명페이지가 있는것은 불필요하고
  결국 Store 및 Showroom에서 JohnnyStudio 또는 [운영자 계정]인 내가 올린 것에 대해서 필터링해서 보여주는 곳을 Library라고 생각하면 될것 같다."
- ADR-0014 로 공식 앱 11개와 웹 서비스 2개(Arkurator·JohnnyStudio)가 Store·Showroom DB 에 들어갔다. 그런데 Library 에는 작품 파일로 만든 상세 페이지(`/library/<slug>/`)가 따로 있었다.
  같은 작품의 설명이 두 곳(작품 파일 본문, Store·Showroom 소개 자료)에 있고, Library 상세는 다시 'Store에서 내려받기'로 Store 화면을 가리켰다.
- Library 목록은 빌드할 때 작품 파일로 만든다. 그래서 운영자가 Store 에서 새 앱을 올리거나 내려도 다시 빌드·배포하기 전에는 Library 가 따라오지 않았다.

## 결정

1. **Library = Store·Showroom 에서 공식(운영자 계정이 올린) 앱·서비스만 거른 목록.** '공식'은 ADR-0014 결정 1 과 같다 (주인의 이메일이 `JOHNNYSTUDIO_STORE_ADMINS` 에 있으면).
   API 의 목록에 `official=true` 거르기를 더한다 (`GET /api/store/apps?official=true`, `GET /api/showroom/services?official=true`). 운영자 이메일을 화면 코드에 적지 않는다.
2. **설명 화면은 Store 앱 화면과 Showroom 서비스 화면 하나뿐이다.** Library 카드(홈·My Studio·Life Log·Work with me 의 작품 링크 포함)는 작품 파일에
   `storeApp` 이 있으면 `/store/app/?id=<코드>`, `showroomService` 가 있으면 `/showroom/service/?id=<코드>` 로 간다 (`lib/hrefs.ts` 의 `assetHref`).
   - `/library/<slug>/` 는 옮긴 작품에서는 **넘겨 주기만** 한다: `<meta http-equiv="refresh">` 와 눌러서 가는 링크, `noindex`. 예전 링크·바깥 링크·즐겨찾기가 깨지지 않게 페이지는 남긴다.
     Next 의 `redirect()` 는 정적 내보내기에서 JS 로만 넘어가는 빈 오류 페이지(`lang` 없음)가 되어 쓰지 않는다
   - 코드가 없는 작품(영상·사진·글·하드웨어, Store 에 옮기지 않은 앱)은 지금처럼 Library 상세가 설명 페이지다
3. **목록은 빌드된 HTML + 브라우저에서 맞추기.** 빌드된 HTML 에는 작품 파일의 카드가 들어 있다 (검색엔진·JS 꺼진 브라우저·API 장애). 브라우저는 공식 목록 두 개를 받아
   `lib/library.ts` 의 `mergeOfficial` 로 맞춘다.
   - 이어진 작품: 이름·소개는 Store·Showroom 의 것, 유형·상태·태그·아이콘·날짜·즐겨찾기는 작품 파일의 것
   - Store·Showroom 에서 내리거나 숨긴 작품은 빠지고, 작품 파일 없이 Store·Showroom 에만 올린 공식 앱·서비스는 더해진다 (아이콘은 API 그림, 태그 없음)
   - 한쪽 목록을 받지 못하면 그쪽 작품은 작품 파일 그대로 둔다
   - AGENTS.md 의 "콘텐츠는 빌드된 HTML 에" 규칙의 예외에 Library 의 공식 목록을 더한다 (빌드된 HTML 에도 그대로 남으므로 덜 어긋난다)
4. **즐겨찾기 값은 하나.** 작품 파일과 이어진 앱·서비스는 Library 카드·Store 목록·Store 앱 화면·Showroom 서비스 화면 어디서 눌러도 작품 slug 로 들어간다
   (빌드할 때 코드 → slug 표 `getLibrarySlugs()` 를 그 화면에 넘긴다). Store 에만 있는 공식 앱은 `store:<코드>`, Showroom 에만 있는 공식 서비스에는 즐겨찾기가 없다 (회원 서비스와 같다).
5. 공식 앱을 옮길 때 소개 자료의 '웹 사이트' 칸은 작품의 Library 상세 대신 `/library/` 를 가리킨다 (상세가 같은 Store 화면으로 돌아오기 때문, `app/import_official.py`).

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| **A. 빌드된 카드 + 브라우저에서 공식 목록에 맞추기 (채택)** | 사용자가 말한 "Store·Showroom 을 거른 곳"과 같다. 새로 올린 공식 앱이 빌드 없이 보인다. JS 가 없어도 목록과 링크가 있다 | 두 이름이 다르면 불러온 뒤 카드 이름이 바뀐다. 코드가 조금 늘었다 (`lib/library.ts`) |
| B. 카드 링크만 Store·Showroom 으로 | 바꿀 것이 가장 적다 | Store 에서 올리거나 내린 것이 Library 에 빌드 전까지 보이지 않는다 (Library 가 거른 목록이 아니다) |
| C. 목록을 API 로만 (빌드된 카드 없음) | 원본이 하나 | JS 가 없거나 API 가 멈추면 Library 가 빈다. 홈·Life Log 는 여전히 작품 파일을 쓴다 |

## 결과

- **좋아지는 점**: 같은 작품의 설명은 Store·Showroom 한 곳에서 고친다. 운영자가 Store·Showroom 에서 올리고 내린 공식 앱·서비스가 Library 에 바로 보인다. 즐겨찾기가 한 번만 들어간다.
- **나빠지는 점·주의**
  - 작품 파일 본문(`content/assets/<slug>.md` 의 Markdown)과 `links` 는 옮긴 작품에서는 화면에 보이지 않는다. 설명은 Store·Showroom 의 소개 꾸미기에서 고친다.
    작품 파일은 Library 카드(유형·상태·태그·아이콘·날짜), 홈·Life Log, DB 를 새로 채울 때(`scripts/import-official.sh`)에 쓰인다
  - 이름이 두 곳에서 다르면(예: 작품 파일 'TakeScreenShot', Store 'takescreenshot') 빌드된 이름이 보였다가 Store 이름으로 바뀐다. Store 이름을 고치면 맞는다
  - Store 에만 올린 공식 앱은 홈·Life Log·My Studio 의 'JohnnyStudio' 구역에는 나오지 않는다 (작품 파일이 있어야 한다). 즐겨찾기는 My Studio 의 Store 구역에 모인다
- **재검토 조건**: 영상·사진·글처럼 Store·Showroom 에 없는 작품이 늘어 Library 가 '공식 목록'과 크게 달라지면, 그 유형의 자리(새 구역 또는 DB)를 다시 정한다
