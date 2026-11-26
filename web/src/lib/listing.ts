/**
 * 소개 자료 (ADR-0013): Store 앱·Showroom 서비스의 상세 소개. 클라이언트 컴포넌트에서 쓴다 (zod·fs 없음).
 *
 * - 이름·한 줄 소개·설명(Markdown 일부)·분류는 앱·서비스에 그대로 두고, 나머지를 page 로 둔다 (api/app/listing.py)
 * - 한도는 api/app/listing.py 와 같게 둔다. 바꾸면 둘 다 고친다
 * - 항목과 한도는 Microsoft Store(Partner Center) 등록 항목과 함께 쓸 수 있게 맞췄다 (lib/listing-msstore.ts 가 옮겨 적는다)
 * - 회원이 쓴 글이다. 화면은 React 가 글자로만 그린다 (components/listing/listing-view.tsx)
 */
export type ListingKind = "store" | "showroom";

export type GalleryImage = { id: string; caption: string; width: number; height: number };
export type Feature = { title: string; text: string; image: string | null };
export type Faq = { q: string; a: string };
export type ListingLink = { label: string; url: string };

export type ListingPage = {
  keywords: string[];
  audience: string[];
  features: Feature[];
  steps: string[];
  /** 필요한 환경 (Microsoft Store: 추가 시스템 요구 사항 - 최소) */
  requirements: string[];
  /** 권장 환경 (Microsoft Store: 추가 시스템 요구 사항 - 권장) */
  recommended: string[];
  pricing: string;
  faq: Faq[];
  links: ListingLink[];
  gallery: GalleryImage[];
  developer: string;
  copyright: string;
  license: string;
  website: string;
  /** https 주소 또는 이메일 */
  support: string;
  privacy_url: string;
  ms_store_url: string;
  /** Microsoft Store 분류 값 (meta.listing.ms_categories 의 키) */
  ms_category: string;
};

/** 괄호는 같은 칸의 Microsoft Store 한도 */
export const LISTING_LIMITS = {
  name: 80,
  summary: 160, // 짧은 설명 (1000자, 앞 270자가 보인다)
  description: 10000, // 설명 (10000자)
  notes: 1500, // 이번 버전의 새로운 기능 (1500자)
  keywords: 7, // 검색어 (7개, 30자)
  keyword: 30,
  audience: 5,
  audienceItem: 100,
  features: 20, // 제품 기능 (20개, 200자: "이름 — 설명")
  featureTitle: 40,
  featureText: 150,
  steps: 8,
  step: 200,
  requirements: 11, // 추가 시스템 요구 사항 최소·권장 (각 11개, 200자)
  requirement: 200,
  pricing: 80,
  faq: 8,
  question: 120,
  answer: 600,
  links: 5,
  linkLabel: 30,
  gallery: 10, // 스크린샷 (데스크톱 10장, 설명 200자)
  caption: 200,
  developer: 80, // 개발자 (255자)
  copyright: 200, // 저작권 및 상표 정보 (200자)
  license: 200,
  imageBytes: 5 * 1024 * 1024,
} as const;

export const GALLERY_ACCEPT = "image/png,image/jpeg,image/webp";

export function emptyPage(): ListingPage {
  return {
    keywords: [],
    audience: [],
    features: [],
    steps: [],
    requirements: [],
    recommended: [],
    pricing: "",
    faq: [],
    links: [],
    gallery: [],
    developer: "",
    copyright: "",
    license: "",
    website: "",
    support: "",
    privacy_url: "",
    ms_store_url: "",
    ms_category: "",
  };
}

/** 예전 응답처럼 빠진 칸이 있어도 모양을 맞춘다 */
export function pageOf(raw: Partial<ListingPage> | null | undefined): ListingPage {
  return { ...emptyPage(), ...(raw ?? {}) };
}

/** Microsoft Store 앱 주소 (https://apps.microsoft.com/detail/<12자>) */
export function isMsStoreUrl(raw: string): boolean {
  return /^https:\/\/apps\.microsoft\.com\/detail\/[0-9A-Za-z]{12}\/?(\?hl=[A-Za-z-]{2,10})?$/.test(raw.trim());
}

/** 지원 연락처가 이메일인가 (아니면 https 주소) */
export const isEmail = (s: string) => s.includes("@") && !s.includes("/");

/** 소개 자료에 보여 줄 것이 있는가 (그림·가격 포함) */
export function hasListing(page: ListingPage | null | undefined): boolean {
  if (!page) return false;
  return Boolean(
    page.keywords.length ||
      page.audience.length ||
      page.features.length ||
      page.steps.length ||
      page.requirements.length ||
      page.recommended.length ||
      page.pricing ||
      page.developer ||
      page.website ||
      page.support ||
      page.privacy_url ||
      page.ms_store_url ||
      page.faq.length ||
      page.links.length ||
      page.gallery.length,
  );
}

const enc = encodeURIComponent;
/** 소개 꾸미기 화면 */
export const listingEditHref = (code: string, kind: ListingKind = "store") => (kind === "store" ? `/store/listing/?app=${enc(code)}` : `/showroom/listing/?id=${enc(code)}`);
export const galleryImageSrc = (kind: ListingKind, code: string, id: string) =>
  kind === "store" ? `/api/store/apps/${enc(code)}/gallery/${enc(id)}` : `/api/showroom/services/${enc(code)}/gallery/${enc(id)}`;

/** https 주소의 호스트 (아니면 null). 회원이 준 링크는 https 만 링크로 만든다 */
export function httpsHost(raw: string): string | null {
  try {
    const u = new URL(raw);
    return u.protocol === "https:" && u.hostname.includes(".") && !u.username && !u.password ? u.hostname : null;
  } catch {
    return null;
  }
}

/** 한 줄에 하나(또는 쉼표)로 쓴 목록 → 배열. 빈 줄과 같은 값은 뺀다 */
export function splitLines(text: string, commas = false): string[] {
  const parts = text.split(commas ? /[\n,，、]/ : /\n/).map((s) => s.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim());
  const seen = new Set<string>();
  return parts.filter((p) => {
    const key = p.toLowerCase();
    if (!p || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 글자 수 (화면의 '120 / 160' 과 서버 검사는 같은 기준: 코드 포인트) */
export const charCount = (s: string) => Array.from(s).length;
