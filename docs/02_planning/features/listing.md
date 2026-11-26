# 기능: 소개 자료 (Store·Showroom 게시물 꾸미기, AI 키트, Microsoft Store 공통 항목)

> **상태**: 구현 완료 (개발 환경에서 확인, 운영 서버 설정 전). 결정: [ADR-0013](../../04_architecture/adr/0013-listing-kit.md) (제안됨)
> **Last Updated**: 2026-11-26
> **짝**: [Store](store.md) · [Showroom](showroom.md). 권한·검토·신고는 그 명세와 [ADR-0012](../../04_architecture/adr/0012-member-store.md) 를 따른다

## 왜 (문제와 목적)

- 사용자 요청 (2026-11-25): 게시물을 꾸미는 항목을 나열·검토하고, 사람이 직접 쓰거나 AI 로 만든 md·zip 을 올리면 양식이 채워지고, 웹 서비스는 화면이 자동으로 캡처되어,
  **리뷰 블로그 수준의 소개**가 나오게. AI 코딩 도구에 줄 **프롬프트 복사**, 등록할 때 zip(그림 포함) 또는 md(글만, 그림은 따로)를 올려 **업로드 준비**를 쉽게.
- 추가 요청 (같은 날): "사용하는 항목들은 MS Store 앱 등록할 때 등록하는 항목들을 포함하여 공통으로 사용할 수 있도록 해주세요."
- 전에는 이름·한 줄 소개·설명(글자 그대로 5000자)·분류·아이콘(+ Showroom 화면 그림 한 장)뿐이었다.

## 항목 검토 (나열 → 판단)

Store(Windows 앱)·Showroom(웹 서비스)이 같은 항목을 쓴다. 괄호는 Microsoft Store(Partner Center)의 같은 칸과 한도 (learn.microsoft.com Windows 앱 제출 문서, 2026-11-25 확인).

| 항목 | 넣음 | 한도 | Microsoft Store | 판단 |
|---|---|---|---|---|
| 이름 | ✅ (있던 것) | 80자 | 제품 이름 (예약 이름) | |
| 한 줄 소개 | ✅ (있던 것) | 160자 | 짧은 설명 (1,000자, 앞 270자 표시) | 목록 카드가 짧아야 해서 160 유지 |
| 상세 설명 | ✅ 5000 → **10,000자, Markdown 일부** | 10,000자 | 설명 (10,000자, 일반 글) | 제출용 항목에서 Markdown 표시를 걷어 낸다 |
| 분류 | ✅ (있던 것) | 목록 | — | 사이트 분류와 Microsoft Store 분류는 따로 둔다 |
| Microsoft Store 분류 | ✅ 새로 | 목록 26개 | 범주 (필수) | 하위 범주는 넣지 않았다 |
| 연관 검색어 | ✅ 새로 | 7개 × 30자 | 검색어 (7개, 단어 합계 21개) | 목록 검색에도 쓴다 |
| 아이콘 | ✅ (있던 것) | 1MB → 256px PNG | 1:1 상자 그림 1080·앱 타일 300 | 원본 1080×1080 PNG 를 AI 가 만든다 |
| 대표 그림(숏컷 이미지) | ✅ 새로 (그림 모음의 첫 장) | 1920×1080 권장 | (16:9 슈퍼 히어로는 글자 없는 그림이라 따로) | 상세 맨 위에 크게 |
| 화면 그림 | ✅ 1장 → **그림 모음 10장**, 설명 200자 | 한 장 5MB → 1600px WebP | 스크린샷 (10장, 1366×768 이상 PNG, 설명 200자) | 원본 PNG 를 Microsoft Store 에 그대로 쓴다 |
| 주요 기능 | ✅ 새로 | 20개, 이름 40자 · 설명 150자, 그림 1장 | 제품 기능 (20개 × 200자) | "이름 — 설명" 이 200자를 넘지 않게 |
| 이런 분께 추천해요 | ✅ 새로 | 5개 × 100자 | — | 리뷰 글의 '누구에게' |
| 사용 방법 | ✅ 새로 | 8단계 × 200자 | — | |
| 필요한 환경 · 권장 환경 | ✅ 새로 | 각 11개 × 200자 | 추가 시스템 요구 사항 (최소·권장) | |
| 가격 | ✅ 새로 | 80자 | (가격은 Partner Center 에서 따로) | 글로만 |
| 자주 묻는 질문 | ✅ 새로 | 8개, 질문 120자 · 답 600자 | — | |
| 관련 링크 | ✅ 새로 | 5개, https | — | 호스트를 함께 보인다, UGC rel |
| 개발자 | ✅ 새로 | 80자 | 개발자 (255자) | 설치 파일의 회사 이름으로 먼저 채운다 |
| 저작권·상표 정보 | ✅ 새로 | 200자 | 저작권 및 상표 정보 (200자) | 설치 파일의 저작권 문구로 먼저 채운다 |
| 라이선스 | ✅ 새로 | 200자 (한 줄) | 적용 가능한 라이선스 조항 (10,000자, 문서상 필수) | 사이트는 이름만, 전문은 제출할 때 |
| 웹 사이트 · 지원 연락처 · 개인정보처리방침 | ✅ 새로 | https (지원은 이메일도) | 같은 칸 (개인정보를 다루면 개인정보처리방침 필수) | 공개된다 (개인정보처리방침에 적음) |
| Microsoft Store 주소 | ✅ 새로 | `apps.microsoft.com/detail/<12자>` | (등록 뒤 받는 주소) | 상세에 'Microsoft Store에서 받기' (회원 앱도) |
| 바뀐 점 (Store 버전) | ✅ 2000 → **1,500자** | 1,500자 | 이번 버전의 새로운 기능 (1,500자) | |
| 영상(트레일러) | ❌ | | 트레일러 (mp4, 최대 15개) | 영상 파일을 받지 않는다. YouTube 주소는 관련 링크로 |
| 연령 등급·출시 국가·가격 정책 | ❌ | | IARC 설문 등 | Partner Center 에서 정한다 |
| 여러 언어 | ❌ | | 언어마다 등록 정보 | 재검토 조건 |

## 무엇을 (범위)

- **포함**
  - 소개 자료 편집 (새 앱·새 서비스 등록 화면, 올린 뒤 '소개 꾸미기' `/store/listing/?app=` · `/showroom/listing/?id=`), 미리보기
    - 소개 꾸미기 화면의 **저장 막대는 화면 아래에 붙어 있다** (2026-11-26 사용자 요청): 어디까지 내려가 있든 바로 저장하고, 진행·서버 오류도 막대 안에 보인다. 양식 끝에서는 제자리(바닥글 위)로 돌아온다. 휴대폰에서는 평소 안내를 숨겨 얇게 둔다
  - AI 키트: 프롬프트 복사(분류 목록·한도·그림 규칙·캡처 방법 포함), 양식(listing.md) 내려받기, 프롬프트 내용 보기, 안내 페이지 `/store/guide/`
  - 소개 자료 불러오기: zip(listing.md + images/) 또는 md 만. 브라우저에서 읽고 양식을 채운다. md 만이면 같은 이름의 그림 파일을 골라 제자리에 넣는다
  - Microsoft Store 제출용 항목: 칸 이름(한국어·영어)·값·글자 수·빈 필수 칸, 칸별·전체 복사
  - 상세 화면: 대표 그림, 추천 대상, 주요 기능(그림 곁들임), 화면, 사용 방법, 소개(Markdown), 질문, '한눈에'(가격·개발자·라이선스·환경·웹 사이트·지원·개인정보처리방침·링크·저작권), 그림 크게 보기(`<dialog>`), 연관 검색어
- **포함하지 않음**
  - 서버가 회원 주소를 캡처하기 (ADR-0013 선택지 B, SSRF)
  - 서버가 zip 을 받아 풀기
  - Library(운영자 작품) 관리 도구에서 이 양식 불러오기 (재검토 조건)
  - Partner Center 로 직접 보내기 (API 연동). 복사해서 붙여 넣는다

## 흐름

```
[회원 PC] 프롬프트 복사 → AI 코딩 도구(Claude Code·Gemini CLI)가 저장소를 읽고
          listing.md + images/(+ ms/) → johnnystudio-listing.zip   (웹 화면은 Playwright 1920×1080)
[브라우저] 앱 올리기(설치 파일 분석 뒤)·서비스 등록 → '소개 자료 불러오기' → 양식 채움 → 고치기·미리보기
          → 검토 요청: 앱·서비스 만들기 → 아이콘 → 그림 하나씩(PUT) → 소개 자료(PUT page)
[운영자]  검토 화면에서 승인 (ADR-0012)
[Microsoft Store] 편집 화면의 'Microsoft Store 제출용 항목'을 칸별로 복사 + zip 의 PNG 원본
```

## 파일 양식 `johnnystudio-listing/1`

- 읽는 코드: `web/src/lib/listing-format.ts` (절 이름 별칭 `SECTION_ALIASES`), 견본·프롬프트: `web/src/lib/listing-prompt.ts`, 항목 표: `web/src/lib/listing-fields.ts`
- 머리말(YAML): `format kind name summary category url(showroom) version(store) pricing keywords icon cover cover_caption developer copyright license website support privacy_url ms_store_url ms_category`
- 절: `## 이런 분께 추천해요` `## 주요 기능`(`### 이름` + 글 + `![](images/…)`) `## 사용 방법` `## 상세 설명` `## 필요한 환경` `## 권장 환경` `## 자주 묻는 질문`(`### 질문`) `## 관련 링크` `## 화면` `## 바뀐 점`(store)
- 첫 `##` 앞의 글은 상세 설명 앞부분. 모르는 절은 상세 설명에 `### 절 이름` 으로 넣고 알린다. 코드 블록 안의 `##` 는 절이 아니다
- 그림 경로는 zip 안의 상대 경로(PNG·JPEG·WebP)만. `..`·절대 경로·바깥 주소는 버리고 알린다. 한도를 넘는 값은 고치지 않고 알린다 (개수는 자른다)
- zip: 맨 위 또는 폴더 하나 안의 `listing.md`. `__MACOSX`·`._` 는 건너뛴다. `ms/` 는 읽지 않는다. 쓰지 않은 그림·없는 그림을 알린다

## 구조

### API

| 파일 | 내용 |
|---|---|
| `app/listing.py` | 항목 한도, `PageIn`(넉넉한 원본 한도) → `clean_page`(정확한 한도·https·이메일·Microsoft Store 주소·분류, 이미 올린 그림만), `Gallery`(그림 폴더·자식 프로세스로 다시 그리기·안 쓰는 그림 지우기), `MS_CATEGORIES`, `meta_out` |
| `app/store/models.py` · `app/showroom/models.py` | 새 테이블 `store_app_pages` · `showroom_service_pages` (앱·서비스 id 가 기본 키·외래 키 CASCADE, `data` JSON, `search_text`) |
| `app/store/router.py` | `PUT /apps/{code}/page` · `PUT /uploads/gallery/{code}` (5MB) · `GET /apps/{code}/gallery/{id}`. 올린 사람·운영자. `/meta` 에 `listing.ms_categories`. 설명 10,000자, 바뀐 점 1,500자 |
| `app/showroom/router.py` | `PUT /services/{code}/page` · `PUT /uploads/{code}/gallery` · `GET /services/{code}/gallery/{id}`. 소개한 사람·운영자 (2026-11-26 부터 운영자도). 반려된 서비스는 소개한 사람이 고치면 다시 검토 대기 (운영자가 고치면 상태 그대로) |
| `app/main.py` | 응답의 `Cache-Control: no-store` 는 엔드포인트가 정하지 않았을 때만 (그림만 7일) |
| 지우기 | 앱·서비스 지우기·탈퇴: 그림 폴더(`<store_dir>/gallery/<kind>/<코드>/`)와 소개 자료 행을 함께 |

### 웹

- `src/lib/listing.ts`(모양·한도·주소), `listing-format.ts`(md 읽기), `zip.ts`(zip 읽기, 의존성 없음), `listing-bundle.ts`(md·zip 불러오기), `listing-draft.ts`(편집 상태·불러오기 적용·저장 순서),
  `listing-prompt.ts`(프롬프트·견본), `listing-msstore.ts`(Microsoft Store 칸으로 옮기기), `listing-fields.ts`(안내 페이지 표)
- `src/components/listing/`: `listing-view`(안전한 Markdown·상세 절·'한눈에'·크게 보기), `listing-editor`(편집·미리보기), `listing-kit`(AI 키트·불러오기), `listing-msstore`(제출용 항목),
  `listing-edit-page`(소개 꾸미기), `listing-guide-kit`(안내 페이지의 복사 버튼)
- 페이지: `/store/listing/` · `/showroom/listing/` (색인 안 함), `/store/guide/`
- 그림 미리보기는 캔버스로 줄인 `data:` 그림 (CSP `img-src` 에 `blob:` 이 없다)

### nginx (`deploy/nginx/johnnystudio.conf`)

- `location ^~ /api/store/apps` · `^~ /api/showroom/services`: 본문 128k (그 밖의 `/api/` 는 16k 그대로), 안쪽 정규식 location 으로 아이콘·그림 GET 은 `johnnystudio_media`(분당 300, 몰아서 60)
- 정규식의 `{16}` 은 따옴표로 감싼다 (nginx 설정 문법과 겹친다)

## 완료 기준

- [x] md·zip 을 불러오면 양식이 채워지고, 미리보기·Microsoft Store 제출용 항목이 보인다
- [x] 등록하면 아이콘·그림·소개 자료가 함께 저장되고, 승인 뒤 상세에 리뷰 글 모양으로 보인다
- [x] 회원 글은 HTML 로 들어가지 않는다 (`<script>` 가 글자로 보인다), 링크는 https·UGC rel
- [x] 한도·권한·지우기·탈퇴 정리 테스트, `./scripts/check.sh` 통과
- [ ] 운영 서버: nginx 다시 설치 (deploy/README §3-7)
- [ ] 사용자: ADR-0013 확정, 한도(Microsoft Store 맞춤)·이용약관을 고칠지 확인

## 확인한 것 (2026-11-25)

- API 테스트 (`tests/test_listing.py` 10개): 그림 흐름(1600px 로 줄임·순서·설명·뺀 그림 파일 지움·기능 연결 끊김), 검토 전 그림 404, 경로 조작, 연관 검색어 검색, 한도·https·이메일·Microsoft Store 주소·분류,
  제어 문자 지움, 권한(남 404, 운영자는 Store·Showroom 모두), 차단, 그림 10장, 설명 10,000자·바뀐 점 1,500자, 반려 → 다시 검토, 앱 지우기·탈퇴 정리. API 전체 통과
- 웹 테스트 (`lib/listing.test.ts` 16개): md 읽기(별칭·코드 블록·모르는 절·깨진 머리말·한도·경로), 견본 왕복, zip(Deflate·저장·한도·깨짐), 불러오기(폴더 안·대소문자·`__MACOSX`·없는 그림), 편집 상태(이름으로 제자리 넣기·기능 연결), 저장 순서(그림 실패해도 나머지), Microsoft Store 칸(Markdown 걷기·한도·단어 21개·필수)
- 실제 nginx(설정 템플릿, 임시 포트) + 임시 API 로 15개: 한글 설명 9000자 앱 만들기(25KB) 통과, 한도를 채운 소개 자료(46KB) 저장, 128k 넘으면 413, 그 밖의 `/api/` 16k 그대로, 그림 webp·nosniff·캐시, 1600×900, 그림 50번 연달아 429 없음, 목록 API 는 기존 제한대로 429, Showroom 그림·소개 자료, X-Accel 내려받기 SHA-256 일치(내부 헤더 안 보임)
- 출시 빌드 + 같은 nginx + 헤드리스 Chrome 으로 30개: Showroom 등록(zip 불러오기 → 이름·주소·그림 5장·개발자·기능 그림 채움 → 미리보기 → 제출용 항목 → 접수), 상세(어둡게·밝게·390px, 그림 모두 보임, 가로 넘침 없음, 링크 rel, `<script>` 글자, 크게 보기·Esc),
  Store 등록(설치 파일 분석 → 이름 제안 → Showroom 용 파일 알림 → 버전은 설치 파일 값 → 기능 3·그림 5·아이콘 저장), 상세, 소개 꾸미기 저장, 안내 페이지. 콘솔 오류·CSP 위반 0
  - 이 확인에서 안내 페이지가 390px 에서 가로로 넘치는 것(그리드 안의 `pre`)을 찾아 고쳤다

## 확인하지 못한 것

- 실제 AI 도구(Claude Code·Gemini CLI)에 프롬프트를 붙여 넣어 만든 zip (시험 zip 은 손으로 만들었다)
- Partner Center 에 제출용 항목을 실제로 붙여 넣기, Microsoft Store 한도의 최신 변경 (문서끼리 검색어 30자·40자가 다르다 → 짧은 30자를 썼다)
- 운영 서버 nginx 다시 설치, Cloudflare 를 거친 그림 캐시
- 사용자 브라우저(Safari·Firefox)에서 zip 읽기 (`DecompressionStream("deflate-raw")`: Chrome 80+·Firefox 113+·Safari 16.4+)

## 미결정

- ADR-0013 확정, 이용약관을 고칠지 (소개 자료·지원 연락처 공개에 대한 조항) `[확인 필요]`
- Library 관리 도구에도 이 양식을 불러올지
