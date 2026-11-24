/**
 * Store 클라이언트: 회원이 올린 Windows 앱 (/api/store/, ADR-0012). 클라이언트 컴포넌트에서만 쓴다 (fetch·XMLHttpRequest).
 *
 * - Library(운영자 작품)와 달리 Store 목록·상세는 빌드된 HTML 에 없다. 회원이 올리고 운영자가 승인하는 콘텐츠라서
 *   빌드 없이 바뀌므로 브라우저에서 API 로 읽는다 (ADR-0012 의 예외).
 * - 회원이 쓴 글은 React 가 글자로만 그린다 (HTML 로 넣지 않는다).
 * - 파일은 8MB 조각으로 올린다 (Cloudflare 요청 크기 한도, Next 개발 서버 프록시 10MB).
 */
import { useSyncExternalStore } from "react";

import { type ApiError, type ApiResult, toApiError } from "./auth";
import type { OfficialStoreApp } from "./types";

export type AppStatus = "pending" | "published" | "rejected" | "hidden";
export type ReleaseStatus = "pending" | "published" | "rejected";
export type ScanStatus = "queued" | "scanning" | "clean" | "infected" | "error" | "skipped";

export type StoreLimits = { file_max_bytes: number; user_quota_bytes: number; daily_uploads: number };

export type StoreMeta = {
  categories: Record<string, string>;
  report_reasons: Record<string, string>;
  limits: StoreLimits;
  chunk_bytes: number;
  terms_version: string;
  uploads_open: boolean;
  scan_required: boolean;
  scanner: boolean;
};

export type StoreCard = {
  code: string;
  name: string;
  summary: string;
  category: string;
  category_label: string;
  publisher: string;
  has_icon: boolean;
  version: string;
  arch: string;
  size: number;
  updated_at: string | null;
};

export type StoreRelease = {
  id: number;
  /** 공개 내려받기는 파일 전용 출처일 수 있다 (JOHNNYSTUDIO_STORE_FILES_ORIGIN). 검토용은 이 사이트 */
  download_url: string;
  version: string;
  notes: string;
  file_name: string;
  size: number;
  sha256: string;
  file_type: string;
  arch: string;
  signed: boolean;
  is_installer: boolean;
  inner_path: string;
  company_name: string;
  legal_copyright: string;
  scan: { status: ScanStatus; engine: string; checked_at: string | null; detail?: string };
  created_at: string | null;
  // 올린 사람·운영자에게만
  status?: ReleaseStatus;
  status_reason?: string;
  stored?: boolean;
  download_count?: number;
  reviewed_at?: string | null;
};

export type StoreApp = {
  code: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  category_label: string;
  publisher: string;
  has_icon: boolean;
  published_at: string | null;
  updated_at: string | null;
  releases: StoreRelease[];
  status?: AppStatus;
  status_reason?: string;
  public?: boolean;
  download_count?: number;
  created_at?: string | null;
  owner?: { id: string; email: string; blocked: boolean; blocked_reason: string };
  viewer?: { owner: boolean; admin: boolean };
};

export type Publisher = {
  display_name: string;
  terms_version: string;
  terms_current: boolean;
  agreed_at: string | null;
  blocked: boolean;
  blocked_reason: string;
};

export type StoreMe = {
  publisher: Publisher | null;
  admin: boolean;
  limits: StoreLimits;
  usage: { bytes_used: number; uploads_24h: number };
  uploads_open: boolean;
  terms_version: string;
};

export type Analysis = {
  upload_id: string;
  file_name: string;
  size: number;
  sha256: string;
  analyzed: boolean;
  file_type: string;
  arch: string;
  signed: boolean;
  is_installer: boolean;
  inner_path: string;
  product_name: string;
  company_name: string;
  file_description: string;
  product_version: string;
  legal_copyright: string;
  suggested: { name: string; version: string; summary: string };
  warnings: string[];
  icon: string | null; // data:image/png;base64,…
};

export type AdminReport = {
  id: number;
  app_code: string;
  app_name: string;
  app_exists: boolean;
  reason: string;
  reason_label: string;
  detail: string;
  contact: string;
  signed_in: boolean;
  created_at: string | null;
};

export type AdminOverview = {
  scan_required: boolean;
  scanner: boolean;
  pending: StoreApp[];
  reports: AdminReport[];
  hidden: StoreApp[];
  recent: StoreApp[];
  blocked: { user_id: string; email: string; display_name: string; reason: string; blocked_at: string | null }[];
};

export type AppInput = { name: string; summary: string; description: string; category: string };

// ── 표시 ──

export const ACCEPT = ".exe,.msi,.msix,.zip,.7z";

export const ARCH_LABELS: Record<string, string> = {
  x64: "64비트 (x64)",
  x86: "32비트 (x86)",
  arm64: "ARM64",
  arm: "ARM (32비트)",
  anycpu: "모든 CPU (.NET)",
  neutral: "CPU 무관",
  unknown: "알 수 없음",
};

export const APP_STATUS_LABELS: Record<AppStatus, string> = { pending: "검토 대기", published: "공개", rejected: "반려", hidden: "숨김" };
export const RELEASE_STATUS_LABELS: Record<ReleaseStatus, string> = { pending: "검토 대기", published: "공개", rejected: "반려" };
export const SCAN_LABELS: Record<ScanStatus, string> = {
  queued: "검사 대기",
  scanning: "검사 중",
  clean: "탐지 없음",
  infected: "악성코드 탐지",
  error: "검사 실패",
  skipped: "검사 안 함",
};

const CODE = /^[0-9A-Za-z]{4,12}$/;

export function parseAppCode(value: string | null | undefined): string | null {
  return value && CODE.test(value) ? value : null;
}

export const appHref = (code: string) => `/store/app/?id=${encodeURIComponent(code)}`;
/** 아이콘 주소. 바꾼 뒤 새 그림이 보이도록 version(앱을 고친 시각)을 붙인다 */
export const iconSrc = (code: string, version?: string | null) =>
  `/api/store/apps/${encodeURIComponent(code)}/icon${version ? `?v=${encodeURIComponent(version)}` : ""}`;
/** VirusTotal 에서 이 해시를 찾아보기 (사이트는 아무것도 보내지 않는다. 방문자가 직접 연다) */
export const virusTotalHref = (sha256: string) => `https://www.virustotal.com/gui/file/${sha256}`;

export function localDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("ko-KR", { year: "numeric", month: "long", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
}

// ── 요청 ──

type Method = "GET" | "POST" | "PATCH" | "DELETE";

async function call<T>(method: Method, path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/store/${path}`, {
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

const enc = encodeURIComponent;

/** 조각 하나 보내기. fetch 는 올리는 진행률을 알려 주지 않아서 XMLHttpRequest 를 쓴다 */
function putChunk(uploadId: string, offset: number, part: Blob, onProgress: (loaded: number) => void): Promise<ApiResult<{ received: number }>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", `/api/store/uploads/${enc(uploadId)}?offset=${offset}`);
    xhr.setRequestHeader("Content-Type", "application/octet-stream");
    xhr.setRequestHeader("Accept", "application/json");
    xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // JSON 이 아니다 (nginx 오류 화면 등)
      }
      if (xhr.status >= 200 && xhr.status < 300 && body !== null) resolve({ ok: true, data: body as { received: number } });
      else resolve(toApiError(xhr.status, body));
    };
    xhr.onerror = () => resolve(toApiError(0, null));
    xhr.send(part);
  });
}

/** 파일 올리기 → 분석 결과. 실패하면 받던 파일을 지운다 */
async function uploadFile(file: File, onProgress: (ratio: number) => void): Promise<ApiResult<Analysis>> {
  const start = await call<{ id: string; chunk_bytes: number }>("POST", "uploads", { file_name: file.name, size: file.size });
  if (!start.ok) return start;
  const { id, chunk_bytes: chunk } = start.data;
  let offset = 0;
  while (offset < file.size) {
    const part = file.slice(offset, offset + chunk);
    const r = await putChunk(id, offset, part, (loaded) => onProgress(file.size ? (offset + loaded) / file.size : 1));
    if (!r.ok) {
      void call("DELETE", `uploads/${enc(id)}`);
      return r;
    }
    offset = r.data.received;
  }
  onProgress(1);
  return call<Analysis>("POST", `uploads/${enc(id)}/complete`);
}

/** 아이콘 바꾸기: 그림(PNG·JPEG·WebP·ICO, 1MB)을 그대로 보낸다. 서버가 256px PNG 로 다시 그린다 */
async function uploadIcon(code: string, file: File): Promise<ApiResult<StoreApp>> {
  let res: Response;
  try {
    res = await fetch(`/api/store/uploads/icons/${enc(code)}`, {
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
  if (res.ok && json !== null) return { ok: true, data: json as StoreApp };
  return toApiError(res.ok ? 500 : res.status, json);
}

export const ICON_ACCEPT = "image/png,image/jpeg,image/webp,.ico";
export const ICON_MAX_BYTES = 1024 * 1024;

export const storeApi = {
  meta: () => call<StoreMeta>("GET", "meta"),
  list: (search: string) => call<{ apps: StoreCard[] }>("GET", `apps${search}`),
  app: (code: string) => call<StoreApp>("GET", `apps/${enc(code)}`),
  report: (code: string, body: { reason: string; detail: string; contact: string }) => call<{ ok: true }>("POST", `apps/${enc(code)}/reports`, body),

  me: () => call<StoreMe>("GET", "me"),
  setPublisher: (body: { display_name: string; agree_terms: boolean; age_14: boolean }) => call<{ publisher: Publisher }>("POST", "me/publisher", body),
  myApps: () => call<{ apps: StoreApp[] }>("GET", "me/apps"),
  upload: uploadFile,
  cancelUpload: (id: string) => call<undefined>("DELETE", `uploads/${enc(id)}`),
  createApp: (body: AppInput & { upload_id: string; version: string; notes: string; arch: string }) => call<StoreApp>("POST", "apps", body),
  addRelease: (code: string, body: { upload_id: string; version: string; notes: string; arch: string }) => call<StoreApp>("POST", `apps/${enc(code)}/releases`, body),
  editApp: (code: string, body: Partial<AppInput>) => call<StoreApp>("PATCH", `apps/${enc(code)}`, body),
  uploadIcon,
  deleteApp: (code: string) => call<undefined>("DELETE", `apps/${enc(code)}`),
  deleteRelease: (code: string, id: number) => call<undefined>("DELETE", `apps/${enc(code)}/releases/${id}`),

  admin: {
    overview: () => call<AdminOverview>("GET", "admin/overview"),
    approve: (id: number) => call<StoreApp>("POST", `admin/releases/${id}/approve`),
    reject: (id: number, reason: string) => call<StoreApp>("POST", `admin/releases/${id}/reject`, { reason }),
    rescan: (id: number) => call<{ ok: true }>("POST", `admin/releases/${id}/rescan`),
    hide: (code: string, reason: string) => call<StoreApp>("POST", `admin/apps/${enc(code)}/hide`, { reason }),
    unhide: (code: string) => call<StoreApp>("POST", `admin/apps/${enc(code)}/unhide`),
    resolve: (id: number, status: "actioned" | "dismissed", note: string) => call<{ ok: true }>("POST", `admin/reports/${id}/resolve`, { status, note }),
    block: (userId: string, reason: string) => call<{ ok: true }>("POST", `admin/publishers/${enc(userId)}/block`, { reason }),
    unblock: (userId: string) => call<{ ok: true }>("POST", `admin/publishers/${enc(userId)}/unblock`),
  },
};

/** 목록 주소의 ?q=&category=&sort= */
export type StoreQuery = { q: string; category: string; sort: "new" | "name" };

export function parseStoreQuery(search: string): StoreQuery {
  const p = new URLSearchParams(search);
  return { q: p.get("q") ?? "", category: p.get("category") ?? "", sort: p.get("sort") === "name" ? "name" : "new" };
}

export function toStoreSearch(q: StoreQuery): string {
  const p = new URLSearchParams();
  if (q.q.trim()) p.set("q", q.q.trim());
  if (q.category) p.set("category", q.category);
  if (q.sort !== "new") p.set("sort", q.sort);
  const s = p.toString();
  return s ? `?${s}` : "";
}

// ── 공식 앱(Library)과 회원 앱을 한 목록으로 ──

export type StoreEntry =
  | { kind: "official"; app: OfficialStoreApp; category: string; categoryLabel: string; sortDate: string }
  | { kind: "member"; app: StoreCard; sortDate: string };

/** 작품 태그 중 Store 분류 이름과 같은 것 (없으면 기타). categories 는 /api/store/meta 의 값 */
export function officialCategory(tags: readonly string[], categories: Record<string, string>): [string, string] {
  for (const [key, label] of Object.entries(categories)) if (tags.includes(label)) return [key, label];
  return ["other", categories.other ?? "기타"];
}

const matchesText = (q: string, ...fields: string[]) => {
  const words = q.trim().toLowerCase();
  return !words || fields.some((f) => f.toLowerCase().includes(words));
};

/**
 * 검색·분류·정렬을 함께 적용한 목록. 회원 앱(members)은 API 가 이미 거른 것이고, 공식 앱은 여기서 거른다 (API 와 같은 규칙: 이름·소개 포함).
 * 분류(categories)를 아직 모르면 분류로 거를 때 공식 앱은 빠진다.
 */
export function storeEntries(
  official: readonly OfficialStoreApp[],
  members: readonly StoreCard[],
  query: StoreQuery,
  categories: Record<string, string> | null,
): StoreEntry[] {
  const entries: StoreEntry[] = [];
  for (const app of official) {
    const [category, categoryLabel] = categories ? officialCategory(app.tags, categories) : ["", ""];
    if (query.category && query.category !== category) continue;
    if (!matchesText(query.q, app.title, app.summary)) continue;
    entries.push({ kind: "official", app, category, categoryLabel, sortDate: app.date ?? "" });
  }
  for (const app of members) entries.push({ kind: "member", app, sortDate: app.updated_at ?? "" });
  const name = (e: StoreEntry) => (e.kind === "official" ? e.app.title : e.app.name);
  return entries.sort((a, b) =>
    query.sort === "name" ? name(a).localeCompare(name(b), "ko") : b.sortDate.slice(0, 10).localeCompare(a.sortDate.slice(0, 10)) || name(a).localeCompare(name(b), "ko"),
  );
}

// ── 불러온 값 (useSyncExternalStore) ──

export type Remote<T> = { status: "loading" } | { status: "ready"; data: T } | { status: "error"; error: ApiError };

const cache = new Map<string, Remote<unknown>>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

/** key 로 불러 둔 값. 아직 부르지 않았으면 undefined (컴포넌트는 useEffect 에서 loadRemote 를 부른다) */
export function useRemote<T>(key: string | null): Remote<T> | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (key ? (cache.get(key) as Remote<T> | undefined) : undefined),
    () => undefined,
  );
}

/** 불러온다. 이미 보이는 값은 다시 부르는 동안 그대로 둔다 */
export async function loadRemote<T>(key: string, loader: () => Promise<ApiResult<T>>): Promise<void> {
  if (cache.get(key)?.status !== "ready") {
    cache.set(key, { status: "loading" });
    emit();
  }
  const r = await loader();
  cache.set(key, r.ok ? { status: "ready", data: r.data } : { status: "error", error: r });
  emit();
}

/** 저장·승인한 결과를 바로 반영한다 (다시 부르지 않는다) */
export function setRemote<T>(key: string, data: T): void {
  cache.set(key, { status: "ready", data });
  emit();
}
