import { describe, expect, it } from "vitest";

import { flatNav, isActive, isItemActive, NAV } from "./nav";

describe("주 메뉴", () => {
  const library = NAV.find((i) => i.label === "Library")!;

  it("Library 묶음 아래에 작품 전체·Store·Showroom 이 있다", () => {
    expect(library.children?.map((c) => c.href)).toEqual(["/library/", "/store/", "/showroom/"]);
  });

  it("하위 페이지에 있으면 묶음이 켜진다", () => {
    for (const p of ["/library/", "/library/wlt/", "/store/", "/store/app/", "/showroom/service/"]) expect(isItemActive(p, library)).toBe(true);
    expect(isItemActive("/log/", library)).toBe(false);
    expect(isActive("/store/app/", "/library/")).toBe(false); // '작품 전체'는 Store 에서 켜지지 않는다
  });

  it("바닥글은 한 줄로 늘어놓는다", () => {
    expect(flatNav().map((i) => i.label)).toEqual(["Library", "Store", "Showroom", "Life Log", "Work with me", "About"]);
  });
});
