/**
 * 클라이언트 컴포넌트에 넘기는 가벼운 형태. fs 를 쓰는 content.ts 를 클라이언트 번들에 끌어들이지 않도록 따로 둔다.
 */
import type { AssetStatus, AssetType, LogKind } from "./schema";

export interface QuickAction {
  label: string;
  href: string;
  /** 글자 앞에 붙일 아이콘 (지금은 Microsoft Store 만) */
  icon?: "microsoft-store";
}

export interface AssetSummary {
  /** 작품 파일의 slug. Store·Showroom 에만 있는 공식 앱·서비스는 `store:<코드>`·`showroom:<코드>` (Library 의 React key) */
  slug: string;
  /** 누르면 갈 곳. Store·Showroom 으로 옮긴 작품은 그 화면 (ADR-0015, lib/hrefs.ts 의 assetHref), 나머지는 Library 상세 */
  href: string;
  /** 즐겨찾기 값: 작품 파일의 작품은 slug, Store 에만 있는 공식 앱은 `store:<코드>`. null 이면 별을 그리지 않는다 (Showroom 에만 있는 서비스) */
  bookmark: string | null;
  /** 작품 파일의 storeApp·showroomService. Library 가 브라우저에서 Store·Showroom 의 공식 목록과 맞출 때 쓴다 (lib/library.ts) */
  storeApp?: string;
  showroomService?: string;
  title: string;
  type: AssetType;
  summary: string;
  status: AssetStatus;
  date?: string;
  tags: string[];
  cover?: string;
  coverAlt?: string;
  icon?: string;
  featured: boolean;
  draft: boolean;
  /** 카드에서 바로 여는 외부 링크 (웹 서비스 실행, 원문 읽기 등). 없으면 상세 페이지로만 간다 */
  quickAction?: QuickAction;
}

/**
 * Store 목록에 '공식'으로 함께 보이는 Library 의 Windows 앱 (ADR-0012). Store DB 로 옮기지 않은(storeApp 이 없는) 작품만이고, 누르면 Library 상세로 간다.
 */
export interface OfficialStoreApp {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  /** 아이콘, 없으면 대표 이미지 */
  image?: string;
  version: string;
  size?: number;
  /** 최신 Windows 파일의 공개일, 없으면 작품 날짜 */
  date?: string;
  /** Microsoft Store 주소 (있으면 카드에 바로가기) */
  microsoftStore?: string;
}

/** Showroom 목록에 '공식'으로 함께 보이는 Library 의 웹 서비스 (ADR-0012). Showroom DB 로 옮기지 않은 작품만이고, 누르면 Library 상세로 간다 */
export interface OfficialShowroomService {
  slug: string;
  title: string;
  summary: string;
  tags: string[];
  /** 아이콘, 없으면 대표 이미지 */
  image?: string;
  url: string;
  date?: string;
}

/**
 * Store·Showroom 코드 → 작품 파일 slug (ADR-0015). Store 앱·Showroom 서비스 화면의 즐겨찾기를 Library 카드와 같은 값(slug)으로 쓰려고
 * 빌드할 때 그 화면에 넘긴다 (같은 작품을 어디서 눌러도 한 번만 들어간다)
 */
export interface LibrarySlugs {
  store: Record<string, string>;
  showroom: Record<string, string>;
}

export interface TimelineItem {
  date: string;
  title: string;
  kind: LogKind | "asset";
  description?: string;
  href?: string;
  assetType?: AssetType;
  draft: boolean;
}
