/**
 * AI 코딩 도구(Claude Code, Gemini CLI 등)에 붙여 넣을 프롬프트와 listing.md 견본 (ADR-0013).
 * 양식은 listing-format.ts 가 읽는 "johnnystudio-listing/1" 이다. 한도는 lib/listing.ts 의 LISTING_LIMITS.
 * 프롬프트는 지어내지 않기·실제 화면만 캡처하기·개인정보 가리기를 먼저 요구한다 (회원이 올리는 글도 사실이어야 한다).
 * 같은 묶음을 Microsoft Store(Partner Center) 등록에도 쓰도록 그림 크기·항목을 맞춘다 (사용자 요청 2026-11-25).
 */
import { type ListingKind, LISTING_LIMITS as L } from "./listing";
import { LISTING_FORMAT } from "./listing-format";

export const BUNDLE_DIR = "johnnystudio-listing";

const KIND_LABEL: Record<ListingKind, string> = { store: "Store(Windows 앱)", showroom: "Showroom(웹 서비스)" };

function categoryLines(categories: Record<string, string>): string {
  return Object.entries(categories)
    .map(([value, label]) => `  - ${value}: ${label}`)
    .join("\n");
}

/** listing.md 견본 (빈 칸을 채우는 양식). 사람이 직접 쓸 때 내려받는다 */
export function listingTemplate(kind: ListingKind, categories: Record<string, string>, msCategories: Record<string, string> = {}): string {
  const first = Object.keys(categories)[0] ?? "other";
  const ms = Object.keys(msCategories);
  const head =
    kind === "showroom"
      ? `url: https://example.com/          # 서비스 주소 (https 만)`
      : `version: 1.0.0                     # 설치 파일의 버전 (선택: 설치 파일에서 읽은 값이 먼저 채워진다)`;
  return `---
format: ${LISTING_FORMAT}
kind: ${kind}
name: 이름                          # ${L.name}자까지
summary: 한 줄 소개                  # ${L.summary}자까지. 목록 카드에 보인다
category: ${first}                    # 아래 값 중 하나: ${Object.keys(categories).join(" | ")}
${head}
pricing: 무료                        # ${L.pricing}자까지 (예: 무료, 무료 + 유료 플랜 월 5,000원)
keywords: [검색어1, 검색어2, 검색어3]   # 연관 검색어 ${L.keywords}개까지, 각 ${L.keyword}자까지 (단어는 모두 합쳐 21개까지)
icon: images/icon.png               # 정사각형 PNG 1080×1080
cover: images/cover.png             # 대표 그림 1920×1080 (선택)
cover_caption: 대표 그림 설명
# ── 만든 이·지원 정보 (Microsoft Store 등록 항목과 같다. 모르면 비워 둔다) ──
developer: 만든 사람 또는 회사 이름     # ${L.developer}자까지
copyright: © 2026 만든 사람           # 저작권·상표 정보 ${L.copyright}자까지
license: MIT                        # 라이선스 (${L.license}자까지)
website: https://example.com/       # 내 사이트 (https)
support: support@example.com        # 지원 페이지 주소(https) 또는 이메일. 화면에 공개된다
privacy_url: https://example.com/privacy   # 개인정보처리방침 주소 (개인정보를 다루면 꼭)
ms_store_url:                       # 이미 Microsoft Store 에 있으면 https://apps.microsoft.com/detail/<제품 ID>
ms_category: ${ms.includes("productivity") ? "productivity" : (ms[0] ?? "")}                # Microsoft Store 분류${ms.length ? `: ${ms.join(" | ")}` : ""}
---

## 이런 분께 추천해요
- 누가 쓰면 좋은지 한 줄씩 (${L.audience}개까지, 각 ${L.audienceItem}자)

## 주요 기능
### 기능 이름 (${L.featureTitle}자까지)
무엇을 해 주는지 한두 문장 (${L.featureText}자까지. Microsoft Store 의 제품 기능은 "이름 — 설명" 한 줄 200자). ${L.features}개까지.
![기능 그림 설명](images/feature-1.png)

### 두 번째 기능
설명.

## 사용 방법
1. 첫 단계 (${L.steps}단계까지, 각 ${L.step}자)
2. 다음 단계

## 상세 설명
자유롭게 씁니다 (${L.description}자까지). ### 소제목, 목록, **굵게**, \`코드\`, [링크](https://example.com) 를 쓸 수 있습니다.
HTML 과 바깥 그림은 쓸 수 없습니다.

## 필요한 환경
- ${kind === "store" ? "Windows 10 이상 (64비트)" : "Chrome·Edge·Safari 최신판"} (최소 환경. ${L.requirements}개까지, 각 ${L.requirement}자)

## 권장 환경
- ${kind === "store" ? "메모리 8GB 이상" : "화면 너비 1280px 이상"} (선택. ${L.requirements}개까지, 각 ${L.requirement}자)

## 자주 묻는 질문
### 질문 (${L.question}자까지)
답 (${L.answer}자까지). 질문은 ${L.faq}개까지.

## 관련 링크
- [GitHub](https://github.com/계정/저장소)
- [사용 설명서](https://example.com/docs)

## 화면
![첫 화면 (그림 설명 ${L.caption}자까지)](images/screen-1.png)
![설정 화면](images/screen-2.png)
${kind === "store" ? "\n## 바뀐 점\n- 이번 버전에서 바뀐 점 (" + L.notes + "자까지. Microsoft Store 의 '이번 버전의 새로운 기능')\n" : ""}`;
}

/** AI 코딩 도구에 붙여 넣을 프롬프트 */
export function listingPrompt(kind: ListingKind, categories: Record<string, string>, origin = "", msCategories: Record<string, string> = {}): string {
  const what = kind === "store" ? "Windows 앱" : "웹 서비스";
  const guide = origin ? `\n양식 설명은 ${origin}/store/guide/ 에도 있다.` : "";
  const capture =
    kind === "showroom"
      ? `   - 화면 그림(screen-N.png): 실제 서비스 화면을 Playwright 로 캡처한다 (4~6장).
     · 공개 주소가 있으면 그 주소를, 없으면 이 저장소의 개발 서버를 띄워 연다.
     · 창 크기 1920×1080 (deviceScaleFactor 1), 페이지가 다 그려진 뒤(networkidle) PNG 로 찍는다. 화면 하나에 기능 하나가 보이게 고른다.
     · Playwright 가 없으면 \`npx playwright@latest install chromium\` 으로 설치하거나, 설치해도 되는지 나에게 묻는다.
     · 캡처 스크립트는 이 폴더 밖(임시 폴더)에 두고, 결과 그림만 images/ 에 넣는다.`
      : `   - 화면 그림(screen-N.png): 실제 앱 화면이어야 한다 (4~6장, 1920×1080 PNG. Microsoft Store 는 1366×768 이상).
     · 앱 화면이 웹 기술(Tauri·Electron·WebView2·React 등)로 되어 있으면 프론트엔드 개발 서버를 띄워 Playwright 로 1920×1080 캡처한다.
     · 그렇지 않으면 내가 캡처해 둔 그림(screenshots/ 등)을 쓰고, 없으면 어떤 화면을 캡처해 달라고 나에게 부탁한다.`;
  return `너는 내 ${what}을(를) JohnnyStudio ${KIND_LABEL[kind]}에 소개할 자료를 만드는 도우미다.
이 저장소(코드·README·설정·문서)를 살펴보고, 리뷰 블로그 수준으로 읽기 좋은 소개 자료를 아래 양식으로 만든 뒤 zip 으로 묶어 줘.
같은 자료를 Microsoft Store(Partner Center) 등록에도 쓴다. 항목·글자 수·그림 크기는 Microsoft Store 한도에 맞춰 두었다.${guide}

## 꼭 지킬 것
1. 지어내지 않는다. 코드와 문서에서 확인한 사실만 쓴다. 확인하지 못한 값(가격, 지원 OS, 수치 등)은 [확인 필요] 로 남기고 마지막에 나에게 묻는다.
2. 화면 그림은 실제 화면만 쓴다. 꾸며 그린 화면을 화면 그림으로 내지 않는다 (꾸민 그림은 대표 그림 cover 에만).
3. 그림에 개인정보·비밀값(이메일, 토큰, 실제 고객 데이터, 내부 주소)이 보이면 안 된다. 예시 데이터로 바꾸거나 그 화면을 빼고, 무엇을 뺐는지 알려 준다.
4. 바깥 서비스에 아무것도 올리지 않는다. 결과는 이 컴퓨터의 파일로만 만든다.

## 만들 것
${BUNDLE_DIR}/
├── listing.md          ← 아래 양식 (UTF-8)
├── images/             ← JohnnyStudio 가 쓰는 그림 (Microsoft Store 에도 그대로 올린다)
│   ├── icon.png        ← 정사각형 PNG 1080×1080 (Microsoft Store 1:1 상자 그림과 같은 크기). 프로젝트의 로고·아이콘이 있으면 그것을 쓴다. 없으면 SVG 로 단순한 로고를 그려 PNG 로 만든다
│   ├── cover.png       ← 대표 그림 1920×1080. 이름·한 줄 소개·대표 화면을 넣은 HTML 을 만들어 Playwright 로 PNG 로 찍는다
│   ├── screen-1.png …  ← 실제 화면 캡처 1920×1080 PNG
│   └── feature-1.png … ← (선택) 기능 하나를 크게 보여 주는 화면 캡처
└── ms/                 ← (선택) Microsoft Store 에만 올리는 그림. JohnnyStudio 는 읽지 않는다
    ├── tile-300.png    ← 1:1 앱 타일 아이콘 300×300 (icon.png 를 줄인 것)
    └── poster.png      ← 2:3 포스터 그림 720×1080 (이름과 대표 화면)
그다음 ${BUNDLE_DIR}.zip 으로 묶는다 (zip 안 맨 위에 listing.md 또는 ${BUNDLE_DIR}/ 폴더 하나).

## 그림 규칙
- images/ 는 PNG(Microsoft Store 는 PNG 만 받는다), 한 장에 5MB 이하, 아이콘을 빼고 모두 합쳐 ${L.gallery}장까지 (대표 그림·화면·기능 그림 모두 포함. Microsoft Store 데스크톱 스크린샷도 10장까지)
- 파일 이름은 영문 소문자·숫자·- 만 (예: screen-1.png). listing.md 에서는 images/… 상대 경로로 가리킨다
- 그림마다 무엇을 보여 주는지 설명(alt)을 단다 (${L.caption}자까지)
${capture}

## listing.md 양식 (머리말 값과 ## 절 이름을 그대로 쓴다)
- 분류(category)는 다음 값 중 하나:
${categoryLines(categories)}${Object.keys(msCategories).length ? `\n- Microsoft Store 분류(ms_category)는 다음 값 중 하나:\n${categoryLines(msCategories)}` : ""}
- 만든 이·지원 정보(developer·copyright·license·website·support·privacy_url)는 저장소의 LICENSE·package 정보·README 에서 찾는다. 없으면 비워 두고 나에게 묻는다
- 지원 연락처(support)와 개발자 이름은 화면에 공개된다. 내가 정해 주지 않은 개인 이메일을 넣지 않는다
- 글자 수·개수 한도를 넘지 않는다. 한도는 양식 안 주석에 있다. 주석(# 뒤)은 지워도 된다
- 상세 설명은 문단·### 소제목·목록·**굵게**·\`코드\`·https 링크만 쓴다 (HTML·표 안의 그림·바깥 그림 금지)
- 말투는 한국어 존댓말(~합니다)로, 광고 문구보다 실제로 무엇을 할 수 있는지를 구체적으로 쓴다

\`\`\`markdown
${listingTemplate(kind, categories, msCategories)}\`\`\`

## 마지막 확인
- [ ] listing.md 의 그림 경로가 모두 images/ 안의 실제 파일을 가리킨다
- [ ] 한도(글자 수·개수·5MB·${L.gallery}장)를 넘는 값이 없다
- [ ] [확인 필요] 로 남긴 값과, 빼거나 가린 화면을 나에게 알려 준다
- [ ] 만든 zip 의 경로를 알려 준다. 나는 그 파일을 JohnnyStudio ${kind === "store" ? "Store 의 '앱 올리기'" : "Showroom 의 '서비스 등록'"} 화면의 '소개 자료 불러오기'에 올린다
- [ ] Microsoft Store 에도 올릴 거라면: JohnnyStudio 화면의 'Microsoft Store 제출용 항목'에서 칸별로 복사하고, 그림은 images/ 와 ms/ 의 PNG 를 올린다
`;
}
