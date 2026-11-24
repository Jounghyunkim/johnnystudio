import { describe, expect, it } from "vitest";

import { appHref, iconSrc, parseAppCode, parseStoreQuery, toStoreSearch, virusTotalHref } from "./store";

describe("Store 주소", () => {
  it("목록 검색 상태를 주소와 오간다", () => {
    expect(parseStoreQuery("")).toEqual({ q: "", category: "", sort: "new" });
    const q = parseStoreQuery("?q=%EB%A9%94%EB%AA%A8&category=utility&sort=name");
    expect(q).toEqual({ q: "메모", category: "utility", sort: "name" });
    expect(toStoreSearch(q)).toBe("?q=%EB%A9%94%EB%AA%A8&category=utility&sort=name");
    expect(toStoreSearch({ q: "  ", category: "", sort: "new" })).toBe("");
    expect(parseStoreQuery("?sort=popular").sort).toBe("new");
  });

  it("앱 코드는 영문·숫자 4~12자만 받는다", () => {
    expect(parseAppCode("AveRZ5ed")).toBe("AveRZ5ed");
    for (const bad of [null, "", "abc", "../admin", "a b c d", "x".repeat(13)]) expect(parseAppCode(bad)).toBeNull();
  });

  it("링크를 만든다", () => {
    expect(appHref("AveRZ5ed")).toBe("/store/app/?id=AveRZ5ed");
    expect(iconSrc("AveRZ5ed")).toBe("/api/store/apps/AveRZ5ed/icon");
    expect(iconSrc("AveRZ5ed", "2026-11-24T03:00:00+00:00")).toBe("/api/store/apps/AveRZ5ed/icon?v=2026-11-24T03%3A00%3A00%2B00%3A00");
    expect(virusTotalHref("ab".repeat(32))).toBe(`https://www.virustotal.com/gui/file/${"ab".repeat(32)}`);
  });
});
