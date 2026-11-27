/**
 * 즐겨찾기 (My Studio). 어디에 저장하는가 (ADR-0017, ideation §3-3 Phase 2):
 * - **로그인하지 않았으면 이 브라우저(localStorage)에만** 둔다. 서버는 모른다.
 * - **로그인했으면 계정(DB, `/api/account/bookmarks`)** 에 둔다. 다른 브라우저·기기에서 로그인해도 같은 목록이다.
 *   로그인하면 이 브라우저에 있던 목록을 계정에 한 번 더하고(겹치는 것은 하나) 브라우저에서는 지운다.
 *   로그아웃하면 이 브라우저에는 남지 않는다 (같이 쓰는 컴퓨터에 남지 않게).
 *
 * 값은 한 목록에 넣은 순서대로 둔다: Library 작품은 slug, Store 회원 앱은 `store:<앱 코드>`.
 * Library 작품과 이어진 공식 앱·서비스는 Library 카드·Store 목록·Store 앱 화면·Showroom 서비스 화면 어디서 눌러도 slug 로 들어간다 (같은 작품이다, ADR-0015).
 * Store 에만 있는 공식 앱은 `store:<코드>`.
 *
 * 계정 목록은 누르는 즉시 화면에 보이고(낙관적), 요청은 하나씩 차례로 보낸다. 마지막 요청의 답(서버의 전체 목록)으로 화면을 맞춘다.
 * 실패하면 마지막으로 확인한 목록으로 되돌리고 다시 불러온다. 다른 탭·기기에서 바꾼 것은 탭으로 돌아올 때 다시 불러와 맞춘다.
 *
 * localStorage 는 사생활 보호 모드나 차단 설정에서 실패할 수 있어서 모든 접근을 try/catch 로 감싼다.
 */
import { useCallback, useSyncExternalStore } from "react";

import { apiCall, type ApiResult, getSessionState, refreshSession, type SessionState, subscribeSession } from "./auth";

/** 저장소 키 (비회원 목록). 설정 화면(lib/site.ts)이 이 값으로 지운다 */
export const BOOKMARKS_KEY = "johnnystudio:bookmarks:v1";
const KEY = BOOKMARKS_KEY;
const EVENT = "johnnystudio:bookmarks";
const API_PATH = "/api/account/bookmarks";
/** 탭으로 돌아왔을 때 이보다 오래됐으면 계정 목록을 다시 불러온다 */
const STALE_MS = 30_000;

export function parseBookmarks(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

/** Store 회원 앱의 즐겨찾기 값. slug(영문 소문자·숫자·-)에는 ':' 가 없어서 섞이지 않는다 */
const STORE_PREFIX = "store:";
const STORE_CODE = /^[0-9A-Za-z]{4,12}$/;

export function storeBookmarkId(code: string): string {
  return `${STORE_PREFIX}${code}`;
}

/** My Studio 의 두 구역으로 나눈다. 넣은 순서는 그대로, 모양이 틀린 Store 값은 버린다 */
export function splitBookmarks(ids: readonly string[]): { library: string[]; store: string[] } {
  const library: string[] = [];
  const store: string[] = [];
  for (const id of ids) {
    if (!id.startsWith(STORE_PREFIX)) library.push(id);
    else if (STORE_CODE.test(id.slice(STORE_PREFIX.length))) store.push(id.slice(STORE_PREFIX.length));
  }
  return { library, store };
}

export function toggleSlug(slugs: readonly string[], slug: string): string[] {
  return slugs.includes(slug) ? slugs.filter((s) => s !== slug) : [...slugs, slug];
}

// ── 저장 위치를 고르는 핵심 (브라우저·API 를 바꿔 끼워 시험한다) ──

export type BookmarkPlace = "browser" | "account";
export interface BookmarkState {
  place: BookmarkPlace;
  /** loading: 로그인 상태나 계정 목록을 아직 모른다 */
  status: "loading" | "ready" | "error";
  ids: readonly string[];
  /** status 가 error 일 때 화면에 보일 문구 */
  message?: string;
}

type Items = { items: string[] };
export interface BookmarkApi {
  list(): Promise<ApiResult<Items>>;
  add(items: string[]): Promise<ApiResult<Items>>;
  remove(item: string): Promise<ApiResult<Items>>;
}
/** 비회원 목록이 있는 곳. raw 는 바뀌었는지 알아보는 데 쓰는 원본 문자열 */
export interface LocalList {
  raw(): string;
  write(ids: string[]): void;
  clear(): void;
}
export type Viewer = { status: "loading" } | { status: "guest" } | { status: "member"; id: string };

interface Account {
  userId: string;
  status: BookmarkState["status"];
  items: string[];
  /** 서버가 마지막으로 알려 준 목록. 실패하면 여기로 되돌린다 (처음 불러오기 전에는 null) */
  confirmed: string[] | null;
  message?: string;
  syncedAt: number;
}

export function createBookmarkStore(api: BookmarkApi, local: LocalList, onSignedOut: () => void, now: () => number = Date.now) {
  let viewer: Viewer = { status: "loading" };
  let account: Account | null = null;
  let accountState: BookmarkState | null = null;
  let browserRaw: string | null = null;
  let browserState: BookmarkState = { place: "browser", status: "loading", ids: [] };
  const listeners = new Set<() => void>();
  let queue: Promise<void> = Promise.resolve();
  let pending = 0;

  const emit = () => {
    for (const l of listeners) l();
  };

  function getState(): BookmarkState {
    if (account && accountState) return accountState;
    const raw = local.raw();
    const status = viewer.status === "loading" ? "loading" : "ready";
    if (raw !== browserRaw || status !== browserState.status) {
      browserRaw = raw;
      browserState = { place: "browser", status, ids: parseBookmarks(raw) };
    }
    return browserState;
  }

  function update(a: Account, patch: Partial<Pick<Account, "status" | "items" | "message">>): void {
    Object.assign(a, patch);
    if (a.status !== "error") a.message = undefined;
    if (account !== a) return;
    accountState = { place: "account", status: a.status, ids: a.items, ...(a.message ? { message: a.message } : {}) };
    emit();
  }

  /** 요청을 차례로 보낸다. sync: 실패해도 다시 불러오지 않는다 (불러오기 자체이므로) */
  function run(a: Account, call: () => Promise<ApiResult<Items>>, opts: { sync?: boolean; mergedLocal?: boolean } = {}): Promise<void> {
    pending++;
    const step = async () => {
      try {
        if (account !== a) return;
        const r = await call();
        if (account !== a) return;
        if (r.ok) {
          a.confirmed = r.data.items;
          a.syncedAt = now();
          if (opts.mergedLocal) local.clear();
          // 뒤에 기다리는 요청이 있으면 화면은 그대로 둔다 (그 요청의 답이 더 새것이다)
          if (pending === 1) update(a, { items: r.data.items, status: "ready" });
          else if (a.status === "loading") update(a, { status: "ready" });
        } else if (r.status === 401) {
          onSignedOut(); // 세션이 끝났다: 로그인 상태를 다시 물으면 브라우저 목록으로 돌아간다
        } else {
          update(a, { items: a.confirmed ?? a.items, status: "error", message: r.message });
          if (!opts.sync) void run(a, () => api.list(), { sync: true });
        }
      } finally {
        pending--;
      }
    };
    // 한 요청이 예상 밖으로 실패해도 다음 요청은 보낸다
    queue = queue.then(step).catch(() => undefined);
    return queue;
  }

  function setViewer(next: Viewer): void {
    viewer = next;
    const id = next.status === "member" ? next.id : null;
    if (id !== (account?.userId ?? null)) {
      if (id) {
        // 로그인: 이 브라우저의 목록을 계정에 더한다. 불러오는 동안에도 별이 꺼져 보이지 않게 그 목록을 먼저 보인다
        const localIds = parseBookmarks(local.raw());
        const a: Account = { userId: id, status: "loading", items: localIds, confirmed: null, syncedAt: 0 };
        account = a;
        update(a, {});
        void run(a, () => (localIds.length ? api.add(localIds) : api.list()), { mergedLocal: localIds.length > 0 });
        return;
      }
      account = null;
      accountState = null;
    }
    emit();
  }

  function toggle(id: string): void {
    const a = account;
    if (!a) {
      local.write(toggleSlug(parseBookmarks(local.raw()), id));
      emit();
      return;
    }
    const on = a.items.includes(id);
    update(a, { items: toggleSlug(a.items, id), ...(a.status === "error" ? { status: "ready" as const } : {}) });
    void run(a, () => (on ? api.remove(id) : api.add([id])));
  }

  /** 계정 목록을 다시 불러온다 (오류 뒤 '다시 불러오기', 탭으로 돌아왔을 때) */
  function reload(): Promise<void> {
    const a = account;
    if (!a) return Promise.resolve();
    if (a.status === "error") update(a, { status: "loading" });
    return run(a, () => api.list(), { sync: true });
  }

  function refreshIfStale(): void {
    if (account && account.status !== "loading" && pending === 0 && now() - account.syncedAt > STALE_MS) void reload();
  }

  return {
    getState,
    setViewer,
    toggle,
    reload,
    refreshIfStale,
    /** 비회원 목록이 바깥에서 바뀌었다 (다른 탭, 설정 화면에서 지우기) */
    localChanged: emit,
    subscribe(l: () => void): () => void {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    /** 시험용: 보낸 요청이 모두 끝날 때까지 */
    idle: () => queue,
  };
}

// ── 이 브라우저에 붙이기 ──

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

const browserList: LocalList = {
  raw: readRaw,
  write(ids) {
    try {
      window.localStorage.setItem(KEY, JSON.stringify(ids));
    } catch {
      // 저장할 수 없는 환경: 이번 화면에서만 바뀐 것처럼 보이지 않도록 아무것도 하지 않는다
      return;
    }
    window.dispatchEvent(new Event(EVENT));
  },
  clear() {
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      return;
    }
    window.dispatchEvent(new Event(EVENT));
  },
};

const accountApi: BookmarkApi = {
  list: () => apiCall<Items>("GET", API_PATH),
  add: (items) => apiCall<Items>("POST", API_PATH, { items }),
  remove: (item) => apiCall<Items>("DELETE", `${API_PATH}/${encodeURIComponent(item)}`),
};

export function viewerOf(session: SessionState): Viewer {
  if (session.status === "loading") return { status: "loading" };
  // 회원 서버에 닿지 않으면(unavailable) 브라우저 목록을 쓴다. 다음에 로그인 상태가 확인되면 계정에 더해진다
  return session.status === "signed-in" ? { status: "member", id: session.user.id } : { status: "guest" };
}

const store = createBookmarkStore(accountApi, browserList, () => void refreshSession());
let wired = false;

function subscribe(onChange: () => void): () => void {
  const off = store.subscribe(onChange);
  if (!wired) {
    wired = true;
    const sync = () => store.setViewer(viewerOf(getSessionState()));
    subscribeSession(sync);
    sync();
    window.addEventListener("storage", (e) => {
      if (e.key === null || e.key === KEY) store.localChanged(); // 다른 탭, 설정 화면에서 지우기
    });
    window.addEventListener(EVENT, store.localChanged);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") store.refreshIfStale();
    });
  }
  return off;
}

const SERVER_STATE: BookmarkState = { place: "browser", status: "loading", ids: [] };

export function useBookmarks() {
  const state = useSyncExternalStore(subscribe, store.getState, () => SERVER_STATE);
  const has = useCallback((slug: string) => state.ids.includes(slug), [state.ids]);
  return { slugs: state.ids, has, toggle: store.toggle, place: state.place, status: state.status, message: state.message, reload: store.reload };
}

/** 이 브라우저에 남아 있는 비회원 목록의 개수 (설정 화면의 '이 브라우저에 저장된 값') */
export function useBrowserBookmarkCount(): number {
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  return parseBookmarks(raw).length;
}

const noopSubscribe = () => () => {};

/** 브라우저에서 화면이 붙은 뒤에만 true. 저장된 값을 읽기 전의 깜빡임을 막는 데 쓴다 */
export function useIsClient(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
