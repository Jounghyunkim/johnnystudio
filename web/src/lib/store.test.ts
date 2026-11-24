import { describe, expect, it } from "vitest";

import { appHref, iconSrc, parseAppCode, parseStoreQuery, storeEntries, toStoreSearch, virusTotalHref } from "./store";

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

describe("Store 목록 합치기 (공식 앱 + 회원 앱)", () => {
  const categories = { utility: "유틸리티", productivity: "생산성", other: "기타" };
  const official = [
    { slug: "wlt", title: "WLT", summary: "경량 터미널", tags: ["개발 도구", "데스크톱"], version: "0.3.2", date: "2026-11-16" },
    { slug: "johnny-planner", title: "JohnnyPlanner", summary: "학습 플래너", tags: ["교육", "생산성"], version: "0.1.0", date: "2026-11-24" },
  ];
  const member = {
    code: "AveRZ5ed", name: "Alpha Notes", summary: "메모", category: "utility", category_label: "유틸리티", publisher: "개발자",
    has_icon: false, version: "1.0.0", arch: "x64", size: 10, updated_at: "2026-11-20T03:00:00+00:00",
  };
  const q = (patch: Partial<{ q: string; category: string; sort: "new" | "name" }> = {}) => ({ q: "", category: "", sort: "new" as const, ...patch });

  it("최신순으로 섞고, 공식 앱 분류는 태그로 정한다", () => {
    const entries = storeEntries(official, [member], q(), categories);
    expect(entries.map((e) => (e.kind === "official" ? e.app.slug : e.app.code))).toEqual(["johnny-planner", "AveRZ5ed", "wlt"]);
    expect(entries[0]).toMatchObject({ kind: "official", category: "productivity", categoryLabel: "생산성" });
    expect(entries[2]).toMatchObject({ category: "other", categoryLabel: "기타" }); // '개발 도구'는 이 분류 목록에 없다
  });

  it("검색·분류는 공식 앱에도 같은 규칙으로", () => {
    expect(storeEntries(official, [], q({ q: "플래너" }), categories).map((e) => e.kind === "official" && e.app.slug)).toEqual(["johnny-planner"]);
    expect(storeEntries(official, [], q({ category: "productivity" }), categories)).toHaveLength(1);
    expect(storeEntries(official, [], q({ category: "productivity" }), null)).toHaveLength(0); // 분류 목록을 아직 모르면
    expect(storeEntries(official, [member], q({ sort: "name" }), categories).map((e) => (e.kind === "official" ? e.app.title : e.app.name))).toEqual(["Alpha Notes", "JohnnyPlanner", "WLT"]);
  });
});
