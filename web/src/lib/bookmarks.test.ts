import { describe, expect, it } from "vitest";

import { parseBookmarks, splitBookmarks, storeBookmarkId, toggleSlug } from "./bookmarks";

describe("즐겨찾기", () => {
  it("Library slug 와 Store 앱을 한 목록에 넣고, My Studio 에서 두 구역으로 나눈다", () => {
    let ids: string[] = [];
    ids = toggleSlug(ids, "cmg-monitor");
    ids = toggleSlug(ids, storeBookmarkId("Ab12Cd34"));
    ids = toggleSlug(ids, "wlt");
    expect(ids).toEqual(["cmg-monitor", "store:Ab12Cd34", "wlt"]);
    expect(splitBookmarks(ids)).toEqual({ library: ["cmg-monitor", "wlt"], store: ["Ab12Cd34"] });
    expect(toggleSlug(ids, storeBookmarkId("Ab12Cd34"))).toEqual(["cmg-monitor", "wlt"]);
  });

  it("모양이 틀린 Store 값은 버린다 (손으로 고친 저장소 등)", () => {
    expect(splitBookmarks(["store:", "store:../x", "store:abc", "store:ABCD1234"]).store).toEqual(["ABCD1234"]);
  });

  it("예전 목록(slug 만)은 그대로 Library 구역이다", () => {
    expect(splitBookmarks(parseBookmarks('["arkurator","johnny-dir"]'))).toEqual({ library: ["arkurator", "johnny-dir"], store: [] });
    expect(parseBookmarks("깨진 값")).toEqual([]);
  });
});
