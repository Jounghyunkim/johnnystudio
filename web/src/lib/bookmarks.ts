/**
 * 즐겨찾기 (My Studio, Phase 1): 로그인 없이 브라우저(localStorage)에 저장한다.
 * Phase 2 에서 로그인하면 이 목록을 서버로 가져간다. (ideation §3-3)
 *
 * localStorage 는 사생활 보호 모드나 차단 설정에서 실패할 수 있어서 모든 접근을 try/catch 로 감싼다.
 */
import { useCallback, useMemo, useSyncExternalStore } from "react";

const KEY = "johnnystudio:bookmarks:v1";
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
