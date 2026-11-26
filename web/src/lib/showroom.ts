/**
 * Showroom 클라이언트: 회원이 만든 웹 서비스 (/api/showroom/, ADR-0012). 클라이언트 컴포넌트에서만 쓴다.
 * Store 와 같은 방식이다: 회원 서비스는 브라우저에서 API 로 읽고, Library 의 웹 서비스('공식')는 빌드 때 HTML 에 넣는다.
 * 올리는 회원 정보(표시 이름·약관·차단)는 Store 의 /api/store/me 를 함께 쓴다.
 */
import { type ApiResult, toApiError } from "./auth";
import type { GalleryImage, ListingPage } from "./listing";
import type { ListingApi, PageInput } from "./listing-draft";
import { type StoreQuery, putImage } from "./store";
import type { OfficialShowroomService } from "./types";

export type ServiceStatus = "pending" | "published" | "rejected" | "hidden";

export type ShowroomMeta = {
  categories: Record<string, string>;
  report_reasons: Record<string, string>;
  limits: { daily_submissions: number; max_per_user: number; icon_max_bytes: number; screenshot_max_bytes: number };
  terms_version: string;
  submissions_open: boolean;
  /** 소개 자료 (ADR-0013): Microsoft Store 분류 */
  listing: { ms_categories: Record<string, string> };
};

export type ServiceCard = {
  code: string;
  /** 운영자 계정이 소개한 서비스 = JohnnyStudio 의 공식 서비스 (ADR-0014) */
  official?: boolean;
  name: string;
  url: string;
  host: string;
  summary: string;
  category: string;
  category_label: string;
  publisher: string;
  has_icon: boolean;
  updated_at: string | null;
};

export type ShowroomService = ServiceCard & {
  description: string;
  /** 예전 화면 그림 한 장 (소개 자료의 그림 모음이 없을 때만 보인다) */
  has_screenshot: boolean;
  /** 소개 자료 (ADR-0013) */
  page?: Partial<ListingPage>;
  published_at: string | null;
  status?: ServiceStatus;
  status_reason?: string;
  public?: boolean;
  created_at?: string | null;
  reviewed_at?: string | null;
  owner?: { id: string; email: string; blocked: boolean; blocked_reason: string };
  viewer?: { owner: boolean; admin: boolean };
};

export type ShowroomReport = {
  id: number;
  service_code: string;
  service_name: string;
  service_exists: boolean;
  reason: string;
  reason_label: string;
  detail: string;
  contact: string;
  signed_in: boolean;
  created_at: string | null;
};

export type ShowroomOverview = { pending: ShowroomService[]; reports: ShowroomReport[]; hidden: ShowroomService[]; recent: ShowroomService[] };

export type ServiceInput = { name: string; url: string; summary: string; description: string; category: string };

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = { pending: "검토 대기", published: "공개", rejected: "반려", hidden: "숨김" };

export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";

const enc = encodeURIComponent;
export const serviceHref = (code: string) => `/showroom/service/?id=${enc(code)}`;
export const serviceIconSrc = (code: string, version?: string | null) => `/api/showroom/services/${enc(code)}/icon${version ? `?v=${enc(version)}` : ""}`;
export const serviceShotSrc = (code: string, version?: string | null) => `/api/showroom/services/${enc(code)}/screenshot${version ? `?v=${enc(version)}` : ""}`;
/** 회원이 준 바깥 주소로 가는 링크의 rel. 검색엔진에 추천하지 않는다 (ugc·nofollow) */
export const UGC_REL = "noopener noreferrer nofollow ugc";

/** 서비스 주소의 앞부분 확인 (서버가 최종 판단한다: https, 도메인, 사용자 정보 없음) */
export function looksLikeServiceUrl(raw: string): boolean {
  try {
    const u = new URL(raw.trim());
    return u.protocol === "https:" && u.hostname.includes(".") && !u.username && !u.password;
  } catch {
    return false;
  }
}

async function call<T>(method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE", path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/showroom/${path}`, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return toApiError(0, null);
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  const json: unknown = await res.json().catch(() => null);
  if (res.ok && json !== null) return { ok: true, data: json as T };
  return toApiError(res.ok ? 500 : res.status, json);
}

async function uploadImage(code: string, kind: "icon" | "screenshot", file: File): Promise<ApiResult<ShowroomService>> {
  let res: Response;
  try {
    res = await fetch(`/api/showroom/uploads/${enc(code)}/${kind}`, {
      method: "PUT",
      credentials: "same-origin",
      cache: "no-store",
      headers: { Accept: "application/json", "Content-Type": "application/octet-stream" },
      body: file,
    });
  } catch {
    return toApiError(0, null);
  }
  const json: unknown = await res.json().catch(() => null);
  if (res.ok && json !== null) return { ok: true, data: json as ShowroomService };
  return toApiError(res.ok ? 500 : res.status, json);
}

export const showroomApi = {
  meta: () => call<ShowroomMeta>("GET", "meta"),
  list: (search: string) => call<{ services: ServiceCard[] }>("GET", `services${search}`),
  service: (code: string) => call<ShowroomService>("GET", `services/${enc(code)}`),
  report: (code: string, body: { reason: string; detail: string; contact: string }) => call<{ ok: true }>("POST", `services/${enc(code)}/reports`, body),
  mine: () => call<{ services: ShowroomService[] }>("GET", "me/services"),
  create: (body: ServiceInput) => call<ShowroomService>("POST", "services", body),
  edit: (code: string, body: Partial<ServiceInput>) => call<ShowroomService>("PATCH", `services/${enc(code)}`, body),
  remove: (code: string) => call<undefined>("DELETE", `services/${enc(code)}`),
  uploadImage,
  uploadGallery: (code: string, file: File) => putImage<{ image: GalleryImage }>(`/api/showroom/uploads/${enc(code)}/gallery`, file),
  savePage: (code: string, page: PageInput) => call<ShowroomService & { page: ListingPage }>("PUT", `services/${enc(code)}/page`, page),
  admin: {
    overview: () => call<ShowroomOverview>("GET", "admin/overview"),
    approve: (code: string) => call<ShowroomService>("POST", `admin/services/${enc(code)}/approve`),
    reject: (code: string, reason: string) => call<ShowroomService>("POST", `admin/services/${enc(code)}/reject`, { reason }),
    hide: (code: string, reason: string) => call<ShowroomService>("POST", `admin/services/${enc(code)}/hide`, { reason }),
    unhide: (code: string) => call<ShowroomService>("POST", `admin/services/${enc(code)}/unhide`),
    resolve: (id: number, status: "actioned" | "dismissed", note: string) => call<{ ok: true }>("POST", `admin/reports/${id}/resolve`, { status, note }),
  },
};

/** 소개 자료 저장에 쓰는 Showroom API (lib/listing-draft 의 saveListing) */
export const showroomListingApi: ListingApi = {
  uploadIcon: (code, file) => showroomApi.uploadImage(code, "icon", file),
  uploadImage: showroomApi.uploadGallery,
  savePage: showroomApi.savePage,
};

// ── 공식 서비스(Library)와 회원 서비스를 한 목록으로 (Store 의 storeEntries 와 같은 규칙) ──

export type ShowroomEntry =
  | { kind: "official"; service: OfficialShowroomService; category: string; categoryLabel: string; sortDate: string }
  | { kind: "member"; service: ServiceCard; sortDate: string };

export function showroomEntries(
  official: readonly OfficialShowroomService[],
  members: readonly ServiceCard[],
  query: StoreQuery,
  categories: Record<string, string> | null,
): ShowroomEntry[] {
  const words = query.q.trim().toLowerCase();
  const entries: ShowroomEntry[] = [];
  for (const s of official) {
    let category = "";
    let categoryLabel = "";
    if (categories) {
      const hit = Object.entries(categories).find(([, label]) => s.tags.includes(label));
      [category, categoryLabel] = hit ?? ["other", categories.other ?? "기타"];
    }
    if (query.category && query.category !== category) continue;
    if (words && !`${s.title}\n${s.summary}`.toLowerCase().includes(words)) continue;
    entries.push({ kind: "official", service: s, category, categoryLabel, sortDate: s.date ?? "" });
  }
  for (const s of members) entries.push({ kind: "member", service: s, sortDate: s.updated_at ?? "" });
  const name = (e: ShowroomEntry) => (e.kind === "official" ? e.service.title : e.service.name);
  return entries.sort((a, b) =>
    query.sort === "name" ? name(a).localeCompare(name(b), "ko") : b.sortDate.slice(0, 10).localeCompare(a.sortDate.slice(0, 10)) || name(a).localeCompare(name(b), "ko"),
  );
}
