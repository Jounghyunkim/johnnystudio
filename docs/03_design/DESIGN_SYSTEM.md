# 디자인 시스템

> **상태**: v1. ideation §3-7 "Minimalist Dark" 를 구현했다. 어두운 테마가 기본이고 밝은 테마를 고를 수 있다 (2026-11-06). 로고는 Johnny 로봇 아이콘이다. 브랜드 강조색은 아직 임시값이다 `[확인 필요]`.
> 원본: [web/src/app/globals.css](../../web/src/app/globals.css) (`@theme`), [web/src/lib/type-style.ts](../../web/src/lib/type-style.ts)
> **Last Updated**: 2026-11-06

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

**유형 색** (Tailwind 기본 팔레트 300/400, 밝은 테마는 700): 웹 서비스 sky · 데스크톱 툴 violet · 웹 패키지 amber · 영상 rose · 사진 emerald · 글 zinc · 하드웨어 orange

### 밝은 테마

`<html data-theme="light">` 일 때 `globals.css` 의 base 층이 같은 토큰 이름에 아래 값을 넣는다. 대비는 바탕(`canvas`)·카드(`surface`)·떠 있는 면(`raised`) 셋 다에서 AA 이상이다.

| 토큰 | 값 | 대비 (raised 기준, 가장 낮은 값) |
|---|---|---|
| `canvas` / `surface` / `raised` | `#fafafa` / `#ffffff` / `#f4f4f5` | — |
| `line` / `line-strong` | `#e4e4e7` / `#d4d4d8` | — |
| `fg` / `fg-muted` / `fg-subtle` | `#18181b` / `#52525b` / `#6b6b75` | 16.1 / 7.0 / 4.8 |
| `accent` / `accent-hover` / `accent-ink` | `#4d7c0f` / `#3f6212` / `#ffffff` | 4.5 (흰 글자와 5.0) |
| `danger` / `danger-ink` | `#b91c1c` / `#ffffff` | 5.9 |

- 강조색: 어두운 테마의 라임(`#bef264`)은 흰 바탕에서 글자 대비가 1.3:1 이라, 같은 계열의 진한 라임으로 바꾸고 버튼 글자를 흰색으로 했다.
- 옅은 강조색 바탕(`bg-accent/10`) 위의 강조색 글자는 밝은 테마에서 `light:text-accent-hover` 로 한 단계 진하게 쓴다.

## 글꼴

- 본문·제목: **Pretendard Variable** (npm `pretendard` 의 dynamic subset, 자체 호스팅. 필요한 글자 묶음만 내려받는다)
- 고정폭(체크섬·버전·코드): 시스템 고정폭 글꼴

## 모양·레이아웃

- 카드 모서리 `rounded-card`(1rem), 버튼·배지는 완전한 둥근 모양
- 최대 폭 `max-w-page`(72rem), 헤더 높이 4rem(고정, 반투명 + blur)
- 히어로·페이지 머리에는 `hero-glow` (강조색이 은은하게 번지는 배경)

## 컴포넌트

| 컴포넌트 | 파일 | 비고 |
|---|---|---|
| 헤더·바닥글·메뉴 | `site-header` `site-footer` `nav-links` `studio-link` `account-link` | 모바일 메뉴는 `<details>`. 로그인 상태는 브라우저에서 묻는다. 로그인하면 이메일을 보여 준다: 오른쪽 묶음만 `min-w-0` 으로 줄어들고 이메일이 `truncate` 된다(최대 16rem), 휴대폰은 @ 앞부분 + 메뉴 맨 위에 전체 주소. 가운데 메뉴는 줄바꿈하지 않는다(`shrink-0`), md 폭에서는 "My Studio" 글자를 숨긴다 |
| 버튼·컨테이너·제목 | `ui.tsx` | `primary` `secondary` `ghost` |
| 배지 | `badges.tsx` | 유형, 상태(점), 초안(점선) |
| 작품 카드·그리드 | `asset-card.tsx` `asset-cover.tsx` | 카드 전체가 링크, 빠른 실행·★ 는 따로 눌린다 |
| Library 검색·필터 | `library-browser.tsx` | 검색어·유형·정렬이 주소에 남는다 |
| 유형별 뷰어 | `viewers/*` | 실행, 다운로드(체크섬·검증 방법·서명 안내), 샌드박스, YouTube 라이트, 사진 갤러리(`<dialog>`), 원문 |
| 타임라인 | `timeline.tsx` | 연도별 묶음 |
| 즐겨찾기 | `star-button.tsx` `studio-view.tsx` | 브라우저 저장 |
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
