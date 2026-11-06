/**
 * 테마 (밝게·어둡게). React 없이 쓰는 부분: 저장 키와, 페이지를 그리기 전에 <html data-theme> 를 붙이는 인라인 스크립트.
 * layout.tsx 의 <head> 에 들어간다. 내용이 빌드할 때 정해지므로 CSP 해시로 허용된다 (web/scripts/inject-csp.mjs).
 *
 * - 저장값: "light" | "dark" | "system". 없으면 기본값 "dark" (이 사이트의 기본은 어두운 테마다)
 * - "system" 이면 운영체제 설정(prefers-color-scheme)을 따른다
 * - 저장소를 읽을 수 없으면(사생활 보호 모드 등) 어두운 테마
 * - JS 가 꺼져 있으면 data-theme 가 없고, CSS 의 기본값(어두운 테마)이 쓰인다
 */
export const THEME_KEY = "johnnystudio:theme:v1";

export type ThemePref = "light" | "dark" | "system";
export type Theme = "light" | "dark";

export const THEME_SCRIPT = `(function(){var d=document.documentElement,t="dark";try{var p=localStorage.getItem("${THEME_KEY}");if(p==="light"||(p==="system"&&matchMedia("(prefers-color-scheme: light)").matches))t="light"}catch(e){}d.setAttribute("data-theme",t)})()`;

/** 저장값 → 실제 테마 (lib/theme.ts 와 위 스크립트가 같은 규칙을 쓴다) */
export function resolveTheme(pref: ThemePref, systemLight: boolean): Theme {
  return pref === "light" || (pref === "system" && systemLight) ? "light" : "dark";
}

export function parseThemePref(raw: string | null): ThemePref {
  return raw === "light" || raw === "system" ? raw : "dark";
}
