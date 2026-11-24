/**
 * 클라이언트 컴포넌트에 넘기는 가벼운 형태. fs 를 쓰는 content.ts 를 클라이언트 번들에 끌어들이지 않도록 따로 둔다.
 */
import type { AssetStatus, AssetType, LogKind } from "./schema";

export interface QuickAction {
  label: string;
  href: string;
}

export interface AssetSummary {
  slug: string;
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
 * Store 목록에 '공식'으로 함께 보이는 Library 의 Windows 앱 (ADR-0012). 원본은 content/ 그대로이고, 누르면 Library 상세로 간다.
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

export interface TimelineItem {
  date: string;
  title: string;
  kind: LogKind | "asset";
  description?: string;
  href?: string;
  assetType?: AssetType;
  draft: boolean;
}
