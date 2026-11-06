/**
 * Library 검색·필터·정렬. 순수 함수라 서버·클라이언트·테스트 어디서나 쓴다.
 */
import { ASSET_TYPES, type AssetType } from "./asset-types";
import { TYPE_LABELS } from "./labels";
import type { AssetSummary } from "./types";

export type SortKey = "recent" | "name";
export type TypeFilter = AssetType | "all";

export interface LibraryQuery {
  q: string;
  type: TypeFilter;
  sort: SortKey;
}

export const DEFAULT_QUERY: LibraryQuery = { q: "", type: "all", sort: "recent" };

function norm(s: string): string {
  return s.normalize("NFC").toLowerCase().trim();
}

function tokens(q: string): string[] {
  return norm(q).split(/\s+/).filter(Boolean);
}

/** 검색어의 모든 단어가 들어 있어야 맞는다. "#태그" 는 태그와 정확히 같아야 한다 */
export function matches(asset: AssetSummary, q: string): boolean {
  const words = tokens(q);
  if (words.length === 0) return true;
  const tags = asset.tags.map(norm);
  const haystack = norm([asset.title, asset.summary, TYPE_LABELS[asset.type], ...asset.tags].join(" "));
  return words.every((w) => (w.startsWith("#") && w.length > 1 ? tags.includes(w.slice(1)) : haystack.includes(w)));
}

export function filterAssets(assets: readonly AssetSummary[], query: LibraryQuery): AssetSummary[] {
  const result = assets.filter((a) => (query.type === "all" || a.type === query.type) && matches(a, query.q));
  if (query.sort === "name") {
    return [...result].sort((a, b) => a.title.localeCompare(b.title, "ko"));
  }
  return [...result].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title, "ko"));
}

/** 검색어를 적용한 뒤의 유형별 개수 (유형 버튼에 표시) */
export function countByType(assets: readonly AssetSummary[], q: string): Record<TypeFilter, number> {
  const counts = Object.fromEntries([["all", 0], ...ASSET_TYPES.map((t) => [t, 0])]) as Record<TypeFilter, number>;
  for (const a of assets) {
    if (!matches(a, q)) continue;
    counts.all += 1;
    counts[a.type] += 1;
  }
  return counts;
}

export function parseQuery(search: string): LibraryQuery {
  const p = new URLSearchParams(search);
  const type = p.get("type");
  const sort = p.get("sort");
  return {
    q: p.get("q") ?? "",
    type: type && (ASSET_TYPES as readonly string[]).includes(type) ? (type as AssetType) : "all",
    sort: sort === "name" ? "name" : "recent",
  };
}

/** 기본값은 생략한다. 빈 문자열이면 "?" 도 붙이지 않는다 */
export function toSearch(query: LibraryQuery): string {
  const p = new URLSearchParams();
  if (query.q.trim()) p.set("q", query.q.trim());
  if (query.type !== "all") p.set("type", query.type);
  if (query.sort !== "recent") p.set("sort", query.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}
