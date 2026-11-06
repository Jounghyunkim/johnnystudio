/**
 * 테마 상태 (클라이언트 컴포넌트용). 고른 값은 이 브라우저(localStorage)에만 저장한다.
 * 실제 테마는 <html data-theme> 에 있다. 처음 값은 그리기 전에 인라인 스크립트(lib/theme-script.ts)가 붙인다.
 * localStorage 는 try/catch 로 감싸고 useSyncExternalStore 로 읽는다 (AGENTS.md §5).
 */
import { useCallback, useSyncExternalStore } from "react";

import { parseThemePref, resolveTheme, THEME_KEY, type Theme, type ThemePref } from "./theme-script";

const EVENT = "johnnystudio:theme";
const SYSTEM_LIGHT = "(prefers-color-scheme: light)";

function readPref(): ThemePref {
  try {
    return parseThemePref(window.localStorage.getItem(THEME_KEY));
  } catch {
    return "dark";
  }
}

function systemLight(): boolean {
  return window.matchMedia?.(SYSTEM_LIGHT).matches ?? false;
}

function apply(pref: ThemePref): void {
  const theme = resolveTheme(pref, systemLight());
  document.documentElement.setAttribute("data-theme", theme);
  // 휴대폰 브라우저의 주소창 색도 맞춘다. 색은 CSS 토큰(--color-canvas)에서 읽는다 (값을 두 곳에 두지 않는다)
  const canvas = getComputedStyle(document.documentElement).getPropertyValue("--color-canvas").trim();
  if (canvas) document.querySelector('meta[name="theme-color"]')?.setAttribute("content", canvas);
}

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia?.(SYSTEM_LIGHT);
  const sync = () => {
    apply(readPref()); // 다른 탭에서 바꿨거나, '시스템 설정 따르기'인데 운영체제 테마가 바뀐 경우
    onChange();
  };
  window.addEventListener("storage", sync);
  window.addEventListener(EVENT, onChange);
  media?.addEventListener("change", sync);
  return () => {
    window.removeEventListener("storage", sync);
    window.removeEventListener(EVENT, onChange);
    media?.removeEventListener("change", sync);
  };
}

/** 고른 값과 실제 테마. 빌드된 HTML(서버 스냅숏)에서는 기본값(어둡게)이다 */
export function useTheme(): { pref: ThemePref; theme: Theme; setPref: (pref: ThemePref) => void } {
  const pref = useSyncExternalStore(subscribe, readPref, () => "dark" as const);
  const theme = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.getAttribute("data-theme") === "light" ? "light" : "dark"),
    () => "dark" as const,
  );
  const setPref = useCallback((next: ThemePref) => {
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // 저장할 수 없는 환경: 이 페이지에서만 바뀐다
    }
    apply(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { pref, theme, setPref };
}
