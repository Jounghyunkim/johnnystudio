import { describe, expect, it } from "vitest";

import { parseThemePref, resolveTheme, THEME_KEY, THEME_SCRIPT } from "./theme-script";

describe("테마", () => {
  it("저장값이 없거나 이상하면 기본값(어둡게)", () => {
    expect(parseThemePref(null)).toBe("dark");
    expect(parseThemePref("blue")).toBe("dark");
    expect(parseThemePref("light")).toBe("light");
    expect(parseThemePref("system")).toBe("system");
  });

  it("시스템 설정 따르기는 운영체제 테마를 따른다", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("dark", true)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });

  it("인라인 스크립트가 같은 키를 읽고, 실패해도 어두운 테마를 붙인다", () => {
    expect(THEME_SCRIPT).toContain(THEME_KEY);
    expect(THEME_SCRIPT).toContain('t="dark"');
    expect(THEME_SCRIPT).toContain("catch");
    expect(THEME_SCRIPT).not.toContain("</script");
  });
});
