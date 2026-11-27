/**
 * Library = Store·Showroom 에서 JohnnyStudio(운영자 계정)가 올린 '공식' 앱·서비스만 모아 보는 곳 (ADR-0015, 2026-11-27 사용자 요청).
 *
 * - 빌드된 HTML 에는 작품 파일(content/assets)의 카드가 들어 있다 (검색엔진·JS 꺼진 환경, API 가 응답하지 않을 때).
 * - 브라우저에서 Store·Showroom 의 공식 목록(`?official=true`)을 받으면 그것에 맞춘다
 *   - 작품 파일과 이어진 작품(storeApp·showroomService): 이름·소개는 Store·Showroom 의 것. Store·Showroom 에서 내리거나 숨긴 것은 빠진다
 *   - 작품 파일 없이 Store·Showroom 에만 올린 공식 앱·서비스는 더한다
 *   - 한쪽 목록을 받지 못하면(null) 그쪽 작품은 작품 파일 그대로 둔다
 * - 카드를 누르면 Store 앱 화면이나 Showroom 서비스 화면으로 간다 (lib/hrefs.ts 의 assetHref)
 */
import { appHref, serviceHref } from "./hrefs";
import { serviceIconSrc, type ServiceCard } from "./showroom";
import { iconSrc, type StoreCard } from "./store";
import type { AssetSummary } from "./types";

/** Library 가 부르는 목록 (주소 뒤에 붙는 검색 조건). 공식만, 최신순 */
export const OFFICIAL_SEARCH = "?official=true";

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : undefined);

/** Store 에만 있는 공식 앱 → Library 카드. 즐겨찾기는 Store 앱과 같은 값(`store:<코드>`) */
export function storeCardSummary(app: StoreCard): AssetSummary {
  return {
    slug: `store:${app.code}`,
    href: appHref(app.code),
    bookmark: `store:${app.code}`,
    storeApp: app.code,
    title: app.name,
    type: "desktop-app",
    summary: app.summary,
    status: "live",
    date: day(app.updated_at),
    tags: [],
    icon: app.has_icon ? iconSrc(app.code, app.updated_at) : undefined,
    featured: false,
    draft: false,
  };
}

/** Showroom 에만 있는 공식 서비스 → Library 카드. Showroom 서비스에는 즐겨찾기가 없다 */
export function serviceCardSummary(svc: ServiceCard): AssetSummary {
  return {
    slug: `showroom:${svc.code}`,
    href: serviceHref(svc.code),
    bookmark: null,
    showroomService: svc.code,
    title: svc.name,
    type: "web-app",
    summary: svc.summary,
    status: "live",
    date: day(svc.updated_at),
    tags: [],
    icon: svc.has_icon ? serviceIconSrc(svc.code, svc.updated_at) : undefined,
    featured: false,
    draft: false,
    quickAction: { label: "실행", href: svc.url },
  };
}

/** 작품 파일의 카드를 Store·Showroom 의 공식 목록에 맞춘다. apps·services 가 null 이면 그쪽은 아직 모른다 (작품 파일 그대로) */
export function mergeOfficial(
  assets: readonly AssetSummary[],
  apps: readonly StoreCard[] | null,
  services: readonly ServiceCard[] | null,
): AssetSummary[] {
  // official 이 없는 예전 응답도 Library 가 official=true 로 부른 목록이므로 공식으로 본다
  const appByCode = new Map((apps ?? []).filter((a) => a.official !== false).map((a) => [a.code, a]));
  const svcByCode = new Map((services ?? []).filter((s) => s.official !== false).map((s) => [s.code, s]));
  const linkedApps = new Set<string>();
  const linkedServices = new Set<string>();
  const out: AssetSummary[] = [];

  for (const a of assets) {
    if (a.storeApp && apps) {
      const db = appByCode.get(a.storeApp);
      if (!db) continue; // Store 에서 내렸거나 숨긴 앱
      linkedApps.add(db.code);
      out.push({ ...a, title: db.name, summary: db.summary || a.summary });
    } else if (a.showroomService && services) {
      const db = svcByCode.get(a.showroomService);
      if (!db) continue;
      linkedServices.add(db.code);
      out.push({ ...a, title: db.name, summary: db.summary || a.summary, quickAction: { label: "실행", href: db.url } });
    } else {
      out.push(a);
    }
  }
  for (const app of appByCode.values()) if (!linkedApps.has(app.code)) out.push(storeCardSummary(app));
  for (const svc of svcByCode.values()) if (!linkedServices.has(svc.code)) out.push(serviceCardSummary(svc));
  return out;
}
