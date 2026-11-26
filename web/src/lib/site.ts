/**
 * 설정 화면(/settings/)의 도우미. 클라이언트 컴포넌트에서만 쓴다 (fetch·window).
 *
 * - 운영자 현황: GET /api/site/admin/stats (개수만, api/app/site.py)
 * - 브라우저 캐시 지우기: POST /api/site/clear-cache. 응답 머리글 Clear-Site-Data: "cache" 를 브라우저가 따른다
 *   (HTTPS·localhost 에서만). 쿠키는 지우지 않으므로 로그인은 그대로다
 * - 이 브라우저에 저장된 JohnnyStudio 값(localStorage 의 `johnnystudio:` 로 시작하는 키) 보기·지우기.
 *   localStorage 는 try/catch 로 감싸고 useSyncExternalStore 로 읽는다 (AGENTS.md §5)
 */
import { useMemo, useSyncExternalStore } from "react";

import { type ApiResult, toApiError } from "./auth";
import { BOOKMARKS_KEY } from "./bookmarks";
import { REMEMBERED_EMAIL_KEY } from "./remember-email";
import { THEME_KEY } from "./theme-script";

type ByStatus = { pending: number; published: number; rejected: number; hidden: number };

export type SiteTrends = {
  /** 하루 가입 수의 날 수 (90) */
  days: number;
  /** 날짜를 나눈 기준 (Asia/Seoul) */
  timezone: string;
  /** 오래된 날부터, 빈 날은 0 */
  signups: { date: string; count: number }[];
  /** 위 기간 전에 가입한 회원 수 (누적 계산의 시작) */
  members_before: number;
  /** 마지막 로그인: today · week(7일 안) · month(30일 안) · older */
  login_recency: { key: "today" | "week" | "month" | "older"; count: number }[];
  /** 공개된 앱 중 내려받기가 많은 것 (8개까지) */
  top_downloads: { code: string; name: string; count: number }[];
};

export type SiteStats = {
  generated_at: string;
  trends: SiteTrends;
  users: { total: number; new_7d: number; new_30d: number; login_7d: number; with_password: number; signed_in: number; active_24h: number };
  store: { publishers: number; blocked: number; apps: ByStatus; releases_pending: number; reports_open: number };
  showroom: { services: ByStatus; reports_open: number };
  server: {
    env: string;
    site_url: string;
    database: string;
    mail_backend: string;
    session_days: number;
    admins: number;
    uploads_open: boolean;
    scan_required: boolean;
    scanner: boolean;
    file_max_mb: number;
    user_quota_mb: number;
    daily_uploads: number;
    terms_version: string;
  };
};

async function call<T>(method: "GET" | "POST", path: string): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/api/site/${path}`, { method, credentials: "same-origin", cache: "no-store", headers: { Accept: "application/json" } });
  } catch {
    return toApiError(0, null);
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  const json: unknown = await res.json().catch(() => null);
  if (res.ok && json !== null) return { ok: true, data: json as T };
  return toApiError(res.ok ? 500 : res.status, json);
}

export const siteApi = {
  stats: () => call<SiteStats>("GET", "admin/stats"),
  clearCache: () => call<undefined>("POST", "clear-cache"),
};

/** 브라우저 캐시를 지운다: 서버가 Clear-Site-Data 를 보내게 하고, Cache Storage(지금은 쓰지 않는다)도 비운다 */
export async function clearBrowserCache(): Promise<ApiResult<undefined>> {
  const r = await siteApi.clearCache();
  try {
    if ("caches" in window) for (const name of await window.caches.keys()) await window.caches.delete(name);
  } catch {
    // Cache Storage 를 쓸 수 없는 환경
  }
  return r;
}

// ── 이 브라우저에 저장된 값 ──

export const SITE_PREFIX = "johnnystudio:";
export type StoredKind = "bookmarks" | "remembered-email" | "theme" | "other";
export type StoredEntry = { key: string; kind: StoredKind; bytes: number };

const KINDS: Record<string, StoredKind> = { [BOOKMARKS_KEY]: "bookmarks", [REMEMBERED_EMAIL_KEY]: "remembered-email", [THEME_KEY]: "theme" };
const ORDER: StoredKind[] = ["bookmarks", "remembered-email", "theme", "other"];

/** 저장소의 키와 값에서 JohnnyStudio 가 쓰는 것만 골라 정해진 순서로 둔다 (다른 사이트·확장의 키는 건드리지 않는다) */
export function siteEntries(items: ReadonlyArray<readonly [string, string]>): StoredEntry[] {
  return items
    .filter(([key]) => key.startsWith(SITE_PREFIX))
    .map(([key, value]) => ({ key, kind: KINDS[key] ?? "other", bytes: new TextEncoder().encode(key + value).length }))
    .sort((a, b) => ORDER.indexOf(a.kind) - ORDER.indexOf(b.kind) || a.key.localeCompare(b.key));
}

const EVENT = "johnnystudio:site-data";

function readRaw(): string {
  try {
    const s = window.localStorage;
    const items: [string, string][] = [];
    for (let i = 0; i < s.length; i++) {
      const key = s.key(i);
      if (key?.startsWith(SITE_PREFIX)) items.push([key, s.getItem(key) ?? ""]);
    }
    return JSON.stringify(siteEntries(items));
  } catch {
    return "[]";
  }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** 저장된 값 목록. 빌드된 HTML(서버 스냅숏)에서는 빈 목록이다 */
export function useStoredEntries(): StoredEntry[] {
  // 원본 문자열을 스냅샷으로 쓴다 (문자열은 값으로 비교되어 불필요한 다시 그리기가 없다. bookmarks.ts 와 같다)
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  return useMemo(() => JSON.parse(raw) as StoredEntry[], [raw]);
}

/**
 * 고른 키를 지운다. JohnnyStudio 키만 지운다. 지운 키의 개수를 돌려준다.
 * 즐겨찾기·테마·기억한 이메일 화면이 바로 새 값을 읽도록 storage 이벤트를 낸다 (다른 탭에서 바뀐 것과 같게 처리된다)
 */
export function removeStored(keys: readonly string[]): number {
  let removed = 0;
  for (const key of keys) {
    if (!key.startsWith(SITE_PREFIX)) continue;
    try {
      window.localStorage.removeItem(key);
      removed++;
    } catch {
      continue;
    }
    window.dispatchEvent(new StorageEvent("storage", { key }));
  }
  window.dispatchEvent(new Event(EVENT));
  return removed;
}
