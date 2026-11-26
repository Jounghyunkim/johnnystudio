/**
 * 소개 자료 항목 표 (ADR-0013): 안내 페이지(/store/guide/)가 그린다. 한도는 LISTING_LIMITS 에서 가져온다.
 * Store(Windows 앱)·Showroom(웹 서비스)·Microsoft Store(Partner Center) 가 같은 항목을 함께 쓴다.
 */
import { LISTING_LIMITS as L } from "./listing";

export type ListingField = {
  label: string;
  /** listing.md 에서 쓰는 곳 */
  md: string;
  limit: string;
  /** 쓰는 곳: 둘 다면 비워 둔다 */
  only?: "store" | "showroom";
  required?: boolean;
  /** Microsoft Store 의 같은 칸 (없으면 비움) */
  ms?: string;
};

export const LISTING_FIELDS: ListingField[] = [
  { label: "이름", md: "name", limit: `${L.name}자`, required: true, ms: "제품 이름 (미리 예약한 이름)" },
  { label: "한 줄 소개", md: "summary", limit: `${L.summary}자`, ms: "짧은 설명 (1,000자, 앞 270자 표시)" },
  { label: "분류", md: "category", limit: "목록 값", required: true },
  { label: "서비스 주소", md: "url", limit: "https", only: "showroom", required: true },
  { label: "버전 · 바뀐 점", md: "version · ## 바뀐 점", limit: `바뀐 점 ${L.notes}자`, only: "store", ms: "이번 버전의 새로운 기능 (1,500자)" },
  { label: "연관 검색어", md: "keywords", limit: `${L.keywords}개 × ${L.keyword}자`, ms: "검색어 (7개, 단어 합계 21개)" },
  { label: "가격", md: "pricing", limit: `${L.pricing}자`, ms: "가격 (Partner Center 에서 따로 정함)" },
  { label: "아이콘", md: "icon: images/icon.png", limit: "정사각 PNG 1080×1080 권장, 1MB → 256px", ms: "1:1 상자 그림 1080×1080 · 앱 타일 300×300 (ms/)" },
  { label: "대표 그림", md: "cover: images/cover.png", limit: "1920×1080, 그림 모음의 첫 장" },
  { label: "화면 그림", md: "## 화면  ![설명](images/…)", limit: `그림 모두 ${L.gallery}장, 5MB, 설명 ${L.caption}자`, ms: "스크린샷 (10장, 1366×768 이상 PNG, 설명 200자)" },
  { label: "이런 분께 추천해요", md: "## 이런 분께 추천해요", limit: `${L.audience}개 × ${L.audienceItem}자` },
  { label: "주요 기능", md: "## 주요 기능  ### 이름", limit: `${L.features}개, 이름 ${L.featureTitle}자 · 설명 ${L.featureText}자, 그림 1장`, ms: "제품 기능 (20개 × 200자, '이름 — 설명')" },
  { label: "사용 방법", md: "## 사용 방법", limit: `${L.steps}단계 × ${L.step}자` },
  { label: "상세 설명", md: "## 상세 설명", limit: `${L.description}자, Markdown 일부`, ms: "설명 (10,000자, 일반 글)" },
  { label: "필요한 환경 · 권장 환경", md: "## 필요한 환경 · ## 권장 환경", limit: `각 ${L.requirements}개 × ${L.requirement}자`, ms: "추가 시스템 요구 사항 - 최소·권장 하드웨어" },
  { label: "자주 묻는 질문", md: "## 자주 묻는 질문  ### 질문", limit: `${L.faq}개, 질문 ${L.question}자 · 답 ${L.answer}자` },
  { label: "관련 링크", md: "## 관련 링크", limit: `${L.links}개, https` },
  { label: "개발자", md: "developer", limit: `${L.developer}자`, ms: "개발자 (Developed by)" },
  { label: "저작권·상표 정보", md: "copyright", limit: `${L.copyright}자`, ms: "저작권 및 상표 정보 (200자)" },
  { label: "라이선스", md: "license", limit: `${L.license}자`, ms: "적용 가능한 라이선스 조항 (전문)" },
  { label: "웹 사이트", md: "website", limit: "https", ms: "웹 사이트" },
  { label: "지원 연락처", md: "support", limit: "https 또는 이메일 (공개)", ms: "지원 연락처 정보" },
  { label: "개인정보처리방침", md: "privacy_url", limit: "https", ms: "개인정보처리방침 URL (개인정보를 다루면 필수)" },
  { label: "Microsoft Store 주소", md: "ms_store_url", limit: "apps.microsoft.com/detail/…", ms: "(등록 뒤 받는 앱 주소)" },
  { label: "Microsoft Store 분류", md: "ms_category", limit: "목록 값", ms: "범주" },
];
