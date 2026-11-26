/**
 * 즐겨찾기 (My Studio, Phase 1): 로그인 없이 브라우저(localStorage)에 저장한다.
 * Phase 2 에서 로그인하면 이 목록을 서버로 가져간다. (ideation §3-3)
 *
 * 값은 한 목록에 넣은 순서대로 둔다: Library 작품은 slug, Store 회원 앱은 `store:<앱 코드>`.
 * Library 의 '공식' 앱은 Store 화면에서 눌러도 slug 로 들어간다 (같은 작품이다).
 *
 * localStorage 는 사생활 보호 모드나 차단 설정에서 실패할 수 있어서 모든 접근을 try/catch 로 감싼다.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

/** 저장소 키. 설정 화면(lib/site.ts)이 이 값으로 지운다 */
export const BOOKMARKS_KEY = "johnnystudio:bookmarks:v1";
const KEY = BOOKMARKS_KEY;
const EVENT = "johnnystudio:bookmarks";

function readRaw(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
}

export function parseBookmarks(raw: string): string[] {
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function write(slugs: string[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(slugs));
  } catch {
    // 저장할 수 없는 환경: 이번 화면에서만 바뀐 것처럼 보이지 않도록 아무것도 하지 않는다
    return;
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange); // 다른 탭에서 바뀐 경우
  window.addEventListener(EVENT, onChange); // 이 탭에서 바뀐 경우
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
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

export function useBookmarks() {
  // 원본 문자열을 스냅샷으로 쓴다. 문자열은 값으로 비교되어 불필요한 다시 그리기가 없다
  const raw = useSyncExternalStore(subscribe, readRaw, () => "[]");
  const slugs = useMemo(() => parseBookmarks(raw), [raw]);
  const toggle = useCallback((slug: string) => write(toggleSlug(parseBookmarks(readRaw()), slug)), []);
  const has = useCallback((slug: string) => slugs.includes(slug), [slugs]);
  return { slugs, has, toggle };
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
