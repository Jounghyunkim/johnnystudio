# 디자인 시스템

> **상태**: v1. ideation §3-7 "Minimalist Dark" 를 구현했다. 어두운 테마가 기본이고 밝은 테마를 고를 수 있다 (2026-11-06). 로고는 Johnny 로봇 아이콘이다. 브랜드 강조색은 아직 임시값이다 `[확인 필요]`.
> 원본: [web/src/app/globals.css](../../web/src/app/globals.css) (`@theme`), [web/src/lib/type-style.ts](../../web/src/lib/type-style.ts)
> **Last Updated**: 2026-11-28

## 원칙

- **어두운 테마가 기본**이다. 밝은 테마는 고를 수 있다 (헤더 버튼·휴대폰 메뉴·바닥글의 어둡게/밝게/시스템). 아래 "테마" 절 참고.
- **강조색은 하나**(라임)만 쓴다. 유형별 색 포인트는 배지와 대표 이미지 자리표시에만 쓴다.
- 컴포넌트는 **토큰 이름만** 쓴다 (`bg-canvas`, `text-fg-muted`, `border-line`, `text-accent` …). 색을 직접(`#…`) 쓰지 않는다.
- 색 대비는 **WCAG AA** 이상이다. 아래 대비값은 `canvas` 배경 기준이다.
- 한국어는 어절 단위로 줄바꿈한다 (`word-break: keep-all`). `prefers-reduced-motion` 이면 움직임을 끈다.
- 모바일 우선. 좌우 여백 16px(모바일) / 24px(sm 이상), 가로 스크롤 없음.
- 포커스는 항상 보인다: 강조색 2px 외곽선.

## 색

| 토큰 | 값 | 쓰임 | 대비 |
|---|---|---|---|
| `canvas` | `#09090b` | 페이지 배경 | — |
| `surface` | `#111113` | 카드 | — |
| `raised` | `#18181b` | 카드 hover, 떠 있는 면 | — |
| `line` / `line-strong` | `#27272a` / `#3f3f46` | 경계선 | — |
| `fg` | `#fafafa` | 제목, 본문 강조 | 19:1 |
| `fg-muted` | `#a1a1aa` | 본문 | 7.7:1 |
| `fg-subtle` | `#8a8a93` | 날짜·보조 정보 | 5.8:1 |
| `accent` | `#bef264` | 주요 버튼, 링크, 현재 단계 | 15:1 |
| `accent-ink` | `#0b1200` | 강조색 위 글자 | — |
| `danger` | `#f87171` | 오류 문구, 되돌릴 수 없는 동작(회원 탈퇴)에만 | 7.2:1 |
| `danger-ink` | `#1a0505` | `danger` 배경 위 글자 | 7.1:1 |

**유형 색** (Tailwind 기본 팔레트 300/400, 밝은 테마는 700): 웹 서비스 sky · 데스크톱 앱 violet · 안드로이드 앱 fuchsia (lime 은 강조색과 같아서 피했다) · 웹 패키지 amber · 영상 rose · 사진 emerald · 글 zinc · 하드웨어 orange

### 밝은 테마

`<html data-theme="light">` 일 때 `globals.css` 의 base 층이 같은 토큰 이름에 아래 값을 넣는다. 대비는 바탕(`canvas`)·카드(`surface`)·떠 있는 면(`raised`) 셋 다에서 AA 이상이다.

| 토큰 | 값 | 대비 (raised 기준, 가장 낮은 값) |
|---|---|---|
| `canvas` / `surface` / `raised` | `#f7f8fa` / `#ffffff` / `#eef1f5` | — |
| `line` / `line-strong` | `#e2e6ee` / `#cbd2dc` | — |
| `fg` / `fg-muted` / `fg-subtle` | `#0b1220` / `#475467` / `#5b6577` | 16.5 / 6.8 / 5.2 |
| `accent` / `accent-hover` / `accent-ink` | `#127a3a` / `#0d6630` / `#ffffff` | 4.8 · 6.3 (흰 글자와 5.4) |
| `danger` / `danger-ink` | `#b91c1c` / `#ffffff` | 5.7 |

- 2026-11-26 다듬음 (사용자 요청 "칙칙하지 않게, 세련되고 깔끔하게"): 따뜻한 회색(zinc)을 살짝 푸른 쿨톤으로, 올리브 라임(`#4d7c0f`, raised 위 4.4:1 로 AA 에 조금 못 미쳤다)을 노란기를 뺀 맑은 초록으로,
  글자는 짙은 남색 계열로 바꿨다. 히어로 뒤의 빛(`.hero-glow`)은 밝은 테마에서 초록을 줄이고 하늘빛을 조금 더했다.
- 강조색: 어두운 테마의 라임(`#bef264`)은 흰 바탕에서 글자 대비가 1.3:1 이라, 진한 초록으로 바꾸고 버튼 글자를 흰색으로 했다.
- 옅은 강조색 바탕(`bg-accent/10`) 위의 강조색 글자는 밝은 테마에서 `light:text-accent-hover` 로 한 단계 진하게 쓴다.

## 글꼴

- 본문·제목: **Pretendard Variable** (npm `pretendard` 의 dynamic subset, 자체 호스팅. 필요한 글자 묶음만 내려받는다)
- 고정폭(체크섬·버전·코드): 시스템 고정폭 글꼴
- 각진 글꼴(`font-display`): **Oxanium Variable** (npm `@fontsource-variable/oxanium` 5.3.0, SIL OFL, 자체 호스팅, 라틴 글자만). 랜딩 히어로의 이름 `{ JohnnyStudio }` 에만 쓴다 (2026-11-26 사용자 요청: 크게·각지게)
  - 이름은 `.brand-wordmark` (globals.css): 굵기 800, 라틴 그라데이션 글자(어두운 테마 라임·하늘·흰빛, 밝은 테마 짙은 초록·청록·파랑, 대비 4.5:1 이상), 9초에 한 번 빛이 흐른다 ('동작 줄이기'면 멈춤, 고대비면 시스템 글자색)
  - 크기는 줄 폭에 맞춘다 (컨테이너 쿼리 `cqw`): 휴대폰 22~44px, 태블릿 32~72px, 넓은 화면은 왼쪽 칸에 맞춰 약 53px. 줄 바꿈 없이 칸을 넘지 않는다. 로고 오른쪽 남은 자리의 가운데에 둔다

## 차트 (설정 > 전체 현황, 2026-11-26)

| 토큰 | 어두운 / 밝은 | 쓰는 곳 |
|---|---|---|
| `accent` | `#bef264` / `#127a3a` | 한 줄짜리 값 (가입 추이·마지막 로그인·내려받기) |
| `chart-good` · `chart-warn` · `chart-bad` · `chart-neutral` | `#0ea5a4`·`#c99410`·`#e85d75`·`#71717a` / `#059669`·`#c27c0e`·`#be123c`·`#7c8798` | 상태: 공개·검토 대기·반려·숨김 |

- dataviz 지침을 따른다: 막대 24px 이하·끝만 4px 둥글게·바닥은 각지게, 막대 사이 2px, 격자 1px 실선, 글자는 글자 토큰만, 상태 색은 늘 이름·개수와 함께
- 상태 색은 `validate_palette.js` 로 골랐다 (어두운 테마 모두 통과, 밝은 테마는 색각 구분 ΔE 8.0 경고: 범례·표가 보완한다). 모두 카드 바탕에 3:1 이상
- 툴팁은 SVG 안에 그린다 (CSP 가 style 속성을 막아 HTML 툴팁을 띄울 위치를 정할 수 없다). 마우스와 키보드(화살표·Home·End)가 같은 툴팁을 보인다

## 모양·레이아웃

- 카드 모서리 `rounded-card`(1rem), 버튼·배지는 완전한 둥근 모양
- 최대 폭 `max-w-page`(72rem), 헤더 높이 4rem(고정, 반투명 + blur)
- 히어로·페이지 머리에는 `hero-glow` (강조색이 은은하게 번지는 배경)

## 컴포넌트

| 컴포넌트 | 파일 | 비고 |
|---|---|---|
| 헤더·바닥글·메뉴 | `site-header` `site-footer` `nav-links` `studio-link` `account-link` `theme-toggle` | 모바일 메뉴는 `<details>`. 로그인 상태는 브라우저에서 묻는다. 가운데 메뉴는 줄바꿈하지 않는다(`shrink-0`). **오른쪽 위 버튼은 색을 모두 accent(연두색)로**(`ui.tsx`: `HEADER_ICON` 아이콘만 36px 동그라미, `HEADER_PILL` 아이콘 + 글자 알약, `border-line`, 마우스를 올리면 `bg-raised`): 테마 · ★ My Studio(즐겨찾기가 있으면 ★ 를 칠하고 바로 옆에 개수) · 계정(로그인 전 LogIn 아이콘만, 로그인 뒤 CircleUserRound + 표시 이름) · ⚙ 설정 · 휴대폰 메뉴 ☰. 오른쪽 묶음만 `min-w-0` 으로 줄어들고 표시 이름이 `truncate` 된다(최대 10rem), 휴대폰 폭에서는 계정도 아이콘만. 이름은 `aria-label` 과 `title` 로, 로그인한 이메일은 휴대폰 메뉴 맨 위(표시 이름 아래)에 글자로. 360px 보다 좁으면 로고 글자를 숨긴다 (2026-11-28 사용자 요청) |
| 표시 이름 | `display-name.tsx` | 보기·바꾸기(처음 정할 때는 이용약관·만 14세 확인). 계정 화면 '계정 정보'와 설정 화면 '내 계정'이 함께 쓴다. 이름표는 '표시 이름' 하나 (2026-11-28) |
| Story 머리글·탭 | `story-header.tsx` `story-tabs.tsx` `ui.tsx` 의 `Breadcrumb` | Story 아래 6개 페이지. `PageHeader` 의 `location`(제목 위 현재 위치)·`tabs`(아래 가로줄). 탭은 `h-12`·`text-sm`, 지금 탭은 `border-accent` 2px 밑줄이 가로줄 위에 겹친다(`-mb-px`), 나머지는 마우스를 올리면 `border-line-strong`. 좁은 화면은 탭 줄만 가로 스크롤(스크롤 막대 숨김), 포커스 테두리는 안쪽(`-outline-offset-2`). 넓은 화면은 첫 탭 글자가 제목 왼쪽 끝에 맞는다 (2026-11-28) |
| 버튼·컨테이너·제목 | `ui.tsx` | `primary` `secondary` `ghost` `danger`(지우기를 여는 버튼, 글자만 빨강). 종류마다 글자색은 하나다. `ghost` 뒤에 `text-danger` 를 덧붙이면 CSS 순서 때문에 회색으로 남는다 (2026-11-24 에 고쳤다) |
| 배지 | `badges.tsx` | 유형, 상태(점), 초안(점선) |
| 작품 카드·그리드 | `asset-card.tsx` `asset-cover.tsx` | 카드 전체가 링크, 빠른 실행·★ 는 따로 눌린다 |
| Library 검색·필터 | `library-browser.tsx` | 검색어·유형·정렬이 주소에 남는다 |
| 유형별 뷰어 | `viewers/*` | 실행, 다운로드(체크섬·검증 방법·서명 안내), 샌드박스, YouTube 라이트, 사진 갤러리(`<dialog>`), 원문 |
| 타임라인 | `timeline.tsx` | 연도별 묶음 |
| 즐겨찾기 | `star-button.tsx` `studio-view.tsx` `store/store-cards.tsx` | 브라우저 저장 (`lib/bookmarks.ts`: Library slug 와 `store:<코드>` 를 한 목록에). Library 카드는 오른쪽 아래, Store 카드는 오른쪽 위(아래 줄에 두면 좁은 카드에서 버전·크기가 두 줄로 밀린다). My Studio 는 JohnnyStudio·Store 두 구역 |
| 홈(랜딩) | `landing.tsx` (TypeBoard·Steps·FeaturedSpotlight·Principles·Process·Faq) | 히어로·마지막 안내 뒤에 옅은 격자(`.landing-grid`), 처음 보일 때 살짝 떠오름(`.rise`, '동작 줄이기'면 꺼짐). FAQ 는 `<details>`(JS 없이 열림). 대표 작품이 하나면 넓은 카드, 여럿이면 격자 |
| 회원 | `auth/login-form` `auth/link-request-form` `auth/password-form` `auth/verify-view` `auth/account-view` `auth/fields` | 카드(`surface`) 안의 폼. 오류는 `role="alert"` + `text-danger`, 완료는 `role="status"`. 비밀번호 칸에는 보기 버튼(`aria-pressed`)과 정확한 `autocomplete`. 탈퇴 확인은 `<dialog>`, 처음 포커스는 '취소' |
| 문서 본문 | `.prose-studio` (globals.css) | Markdown. 표는 좁은 화면에서 표만 가로 스크롤 |

## 로고

원본은 `docs/` 에 있다 (사용자 제공). 모두 **투명 배경의 흰색 그림**이라 어두운 바탕에만 쓴다.

| 파일 | 크기 | 쓰는 곳 |
|---|---|---|
| `docs/johnny-logo.png` → `web/public/brand/johnny-logo.png` | 320×320 | 로봇 + JOHNNY STUDIO. 랜딩 히어로 (`LogoFull`, 96~112px) |
| `docs/johnny-mark.png` → `web/public/brand/johnny-mark.png` | 140×96 | 로봇 얼굴. 헤더(h-7)·바닥글(h-6)·랜딩 마지막 안내·404(h-12) (`LogoMark`) |
| `docs/johnny-mark-icon.png` | 94×64 | 쓰지 않는다 (화면 배율 3 휴대폰에서 헤더 크기로도 흐려진다) |
| `web/src/app/icon.png` | 192×192 | 파비콘. 어두운 둥근 사각형(`canvas`) 위에 흰 마크. 밝은 탭에서도 보이게 바탕을 깔았다 |
| `web/src/app/apple-icon.png` | 180×180 | iPhone 홈 화면. 꽉 찬 사각형 (iOS 가 모서리를 깎는다) |

- 컴포넌트: `web/src/components/logo-mark.tsx` (`LogoMark`, `LogoFull`). 마크 옆에 글자 "JohnnyStudio" 가 있으면 이미지는 `alt=""` 다.
- 원본이 작은 PNG 라서 **마크는 48px, 전체 로고는 160px 보다 크게 쓰면** 고해상도 화면에서 흐려진다. 더 크게 쓰려면 SVG 나 더 큰 원본이 필요하다 `[확인 필요]`.
- 파비콘·홈 화면 아이콘은 Pillow 로 원본 마크에서 만들었다 (2026-11-06). 마크가 바뀌면 다시 만든다.
- 이미지를 바꿀 때는 파일 이름도 바꾼다 (nginx 가 이미지를 30일 캐시한다).

### 바깥 서비스 아이콘

| 파일 | 쓰는 곳 |
|---|---|
| `web/public/brand/microsoft-store.svg` | Microsoft Store 링크 옆에만 (`ms-store-icon.tsx` 의 `MsStoreIcon`): Library 카드의 'MS Store' 바로가기(18px), Store 공식 카드(16px), 작품 상세 다운로드 패널(40px·버튼 20px). 사용자가 준 Microsoft Store 아이콘 그림을 보고 SVG 로 다시 그렸다 (2026-11-24) |

- 로고 색(빨강·초록·파랑·노랑, 흰 가방)은 SVG 파일 안에만 둔다. 컴포넌트에 `#hex` 를 쓰지 않는 규칙의 예외가 아니라, 그림 파일이라 토큰을 거치지 않는다
- 두 테마 모두에서 보이도록 가방에 옅은 테두리를 둔다. 링크 글자와 함께 쓰므로 `alt=""`
- Microsoft 의 상표다. Microsoft Store 로 가는 링크를 알아보게 하는 데만 쓴다 [확인 필요: Microsoft 의 공식 배지로 바꿀지]

## 테마

- **고르는 값**: 어둡게(기본) · 밝게 · 시스템(운영체제 설정). 이 브라우저(localStorage `johnnystudio:theme:v1`)에만 저장한다.
- **번쩍임 없음**: `layout.tsx` 의 `<head>` 인라인 스크립트(`lib/theme-script.ts`)가 그리기 전에 `data-theme` 를 붙인다. CSP 는 해시로 허용된다.
  JS 가 꺼져 있으면 기본값(어둡게)이다.
- **토큰을 안 거치는 색**은 `light:` 변형으로 짝을 단다 (`@custom-variant light`). 예: `text-sky-300 light:text-sky-700`, `shadow-black/40 light:shadow-black/5`.
- **흰색 로고**는 밝은 테마에서 `light:invert` 로 검게 보인다. 파비콘은 테마와 상관없이 같다.
- 바꾸는 곳: 헤더 아이콘 버튼(넓은 화면, `lg` 이상), 휴대폰 메뉴의 한 줄, 바닥글의 세 칸 선택 (`components/theme-toggle.tsx`).
- 검사: 2026-11-06 에 임시 스크립트로 11개 페이지의 모든 글자 대비를 두 테마에서 계산해 AA 미달 0건을 확인했다.

## 정할 것

- [ ] 브랜드 강조색 확정 (지금은 라임 `#bef264`)
- [x] 로고: Johnny 로봇 아이콘 (2026-11-06). 필요하면 SVG 원본으로 바꾼다
- [ ] 작품 대표 이미지 촬영·제작 원칙
- [x] 라이트 모드: 밝은 테마 추가 (2026-11-06). 기본은 어두운 테마
