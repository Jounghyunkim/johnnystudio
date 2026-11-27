# ADR-0018: 상단 메뉴에 'Story ▾' 를 두고, 영상·사진·글·하드웨어는 Story 의 유형별 페이지에 모은다

- **상태**: 제안됨
- **날짜**: 2026-11-27 (결정 5: 2026-11-28)
- **관련**: [ADR-0012](0012-member-store.md) 결정 13 (메뉴와 구분선 → 이 ADR 이 구분선 앞을 바꾼다), [ADR-0015](0015-library-as-official-view.md) (Library = Store·Showroom 의 공식 앱·서비스, 재검토 조건),
  [ADR-0016](0016-android-app-type.md) (작품 유형)

## 맥락

- 사용자 요청 (2026-11-27): "상단 메뉴에 Story를 만들고 그 하위 메뉴로 Library, Life Log, Blog, 영상, 사진, 글, 하드웨어 메뉴를 추가해 주세요."
  - 사용자 결정: Blog 는 바깥 블로그(https://atozcode.tistory.com/)를 연다. 영상·사진·글·하드웨어는 유형별 페이지를 따로 둔다 (Library 유형 필터가 아니라)
- 사용자 요청 (2026-11-28): "Story의 하위 메뉴 클릭 시 스토리 아래 하위 메뉴로 바로 이동할 수 있도록 다른 메뉴들 표시하고 현재 위치를 표시하고 탭형태의 메뉴들을 표시해 주세요." → 결정 5
- 메뉴는 `Library · Life Log · Work with me · About | Store · Showroom` 이었다 (ADR-0012 결정 13).
- ADR-0015 로 Library 는 Store·Showroom 의 공식 앱·서비스를 모아 보는 곳이 됐다. 재검토 조건에 "영상·사진·글처럼 Store·Showroom 에 없는 작품이 늘면 그 유형의 자리를 다시 정한다"가 있었다.

## 결정

1. **메뉴: `Story ▾ · Work with me · About | Store · Showroom`.** Story ▾ 아래: Library · Life Log · Blog · 영상 · 사진 · 글 · 하드웨어 (`lib/nav.ts`).
   - 넓은 화면(1024px 부터): 'Story' 를 누르면 펼쳐진다. `<details>` 라서 JS 없이도 열리고, 바깥을 누르거나 포커스가 나가거나 Esc 면 닫힌다. 하위 메뉴의 페이지에 있으면 'Story' 가 켜진다
   - 좁은 화면: 메뉴 버튼(☰) 안에서 'Story' 이름 아래에 항목을 들여 늘어놓는다 (한 번 더 접지 않는다). 메뉴가 길어져 화면보다 길면 메뉴 안에서 넘겨 본다
   - 바닥글: 묶음을 풀어 두 줄로 늘어놓는다
   - 구분선 뒤 Store · Showroom 은 그대로다 (ADR-0012 결정 13)
2. **Blog 는 바깥 블로그를 새 탭으로 연다.** 주소는 `content/profile.yaml` 의 `blog` 하나에 둔다 (헤더·바닥글·'글' 페이지가 함께 쓴다). 없으면 메뉴에서 뺀다.
3. **영상·사진·글·하드웨어는 `/story/video/` · `/story/photo/` · `/story/article/` · `/story/hardware/` 에 모은다** (`lib/story.ts`, `app/story/[kind]/`).
   - 작품 파일에서 그 유형만 골라 빌드된 HTML 에 넣는다 (Store·Showroom 에 없으므로 API 를 부르지 않는다). 지금은 모두 0개라 '준비 중'과 Library·Life Log 로 가는 길을 보인다
   - 카드를 누르면 그 작품의 상세(`/library/<slug>/`)로 간다. 상세의 '현재 위치'는 `Story › 영상` 처럼 그 유형 페이지를 가리킨다
   - '글' 페이지에는 'Blog 전체 보기'를 둔다
4. **Library 에는 앱·서비스만 둔다** (웹 서비스·데스크톱 앱·안드로이드 앱·웹 패키지). 영상·사진·글·하드웨어 작품은 Library 목록에서 빼고 Story 페이지에만 보인다.
   ADR-0015 의 재검토 조건을 이렇게 푼다. 홈 '다루는 작품'의 유형 줄도 앱·서비스는 Library 의 유형 칸, 나머지는 Story 페이지로 잇는다.
5. **Story 아래 페이지(Library · Life Log · 영상 · 사진 · 글 · 하드웨어)의 머리글에 현재 위치와 Story 탭을 둔다** (`components/story-header.tsx`, `story-tabs.tsx`).
   - 제목 위: 현재 위치 `Story › 영상` (작품 상세도 `Story › 영상 › 작품` · `Story › Library › 작품`)
   - 머리글 아래 가로줄: 펼침 메뉴와 같은 7개 탭. 지금 페이지의 탭은 강조색 밑줄 + `aria-current="page"`, Blog 는 ↗ 와 새 탭. 빌드된 HTML 에 들어 있어 JS 없이도 보인다
   - 좁은 화면: 탭 줄만 옆으로 넘기고(페이지는 넘치지 않는다), 처음 그릴 때 지금 탭을 가운데로 옮긴다
   - 탭은 페이지를 옮기는 링크다. 같은 페이지 안의 내용을 바꾸는 ARIA `tablist` 가 아니므로 `<nav aria-label="Story 메뉴">` 로 둔다
   - Store · Showroom · Work with me · About 에는 두지 않는다

## 검토한 선택지

| 선택지 | 장점 | 단점 |
|---|---|---|
| **A. 유형별 페이지 + Library 는 앱·서비스 (채택)** | 사용자 결정. 영상·사진처럼 Store·Showroom 에 없는 것이 '공식 앱·서비스 목록'과 섞이지 않는다 | 페이지가 4개 늘었다 |
| B. 하위 메뉴를 Library 유형 필터(`/library/?type=video`)로 | 바꿀 것이 적다 | Library 가 앱·서비스 목록이라 맞지 않는다. 지금은 빈 화면이 된다 |
| C. Blog 를 사이트 안 블로그로 | 글이 사이트 안에 남는다 | 글을 쓰는 곳·형식·관리 화면을 새로 정해야 한다. 사용자는 바깥 블로그를 골랐다 |

## 결과

- **좋아지는 점**: 이야기(작품·기록·글·영상·사진·하드웨어)는 Story 한곳에서 찾고, 회원과 함께 쓰는 곳(Store·Showroom)과 나뉜다. 메뉴의 맨 위 칸이 5개로 줄었다.
  Story 안에서는 탭으로 한 번에 옆 페이지로 간다 (펼침 메뉴를 다시 열지 않는다).
- **나빠지는 점·주의**
  - Library 는 한 번 더 눌러야 간다 (홈의 'Library 둘러보기' 버튼은 그대로다)
  - Story 페이지는 머리글이 탭 줄만큼 길어졌다. 휴대폰에서는 탭이 다 보이지 않아 옆으로 넘겨야 한다
  - 예전 `/library/?type=video` 같은 주소는 Library 의 전체 목록을 보인다 (그 유형 칸이 없어서)
  - 블로그 주소가 바뀌면 `profile.yaml` 의 `blog` 만 고친다
- **재검토 조건**: 블로그 글을 사이트 안에도 남기고 싶어지면 (선택지 C), 또는 Story 하위 메뉴가 더 늘어 펼침 메뉴가 길어지면
