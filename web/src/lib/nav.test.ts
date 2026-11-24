import { describe, expect, it } from "vitest";

import { flatNav, isActive, NAV, NAV_MEMBER } from "./nav";

describe("주 메뉴", () => {
  it("About 오른쪽(구분선 뒤)에 Store·Showroom", () => {
    expect(NAV.map((i) => i.label)).toEqual(["Library", "Life Log", "Work with me", "About"]);
    expect(NAV_MEMBER.map((i) => i.href)).toEqual(["/store/", "/showroom/"]);
  });

  it("하위 페이지에서도 켜진다", () => {
    expect(isActive("/store/app/", "/store/")).toBe(true);
    expect(isActive("/showroom/service/", "/showroom/")).toBe(true);
    expect(isActive("/store/app/", "/library/")).toBe(false);
  });

  it("바닥글은 한 줄로 늘어놓는다", () => {
    expect(flatNav().map((i) => i.label)).toEqual(["Library", "Life Log", "Work with me", "About", "Store", "Showroom"]);
  });
});
