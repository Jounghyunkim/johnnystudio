import { describe, expect, it } from "vitest";

import { BOOKMARKS_KEY } from "./bookmarks";
import { REMEMBERED_EMAIL_KEY } from "./remember-email";
import { siteEntries } from "./site";
import { THEME_KEY } from "./theme-script";

describe("설정: 이 브라우저에 저장된 값", () => {
  it("JohnnyStudio 키만 고르고, 즐겨찾기 → 이메일 → 테마 → 그 밖의 순서로 둔다", () => {
    const entries = siteEntries([
      ["other-site:token", "x"],
      ["johnnystudio:zzz", "1"],
      [THEME_KEY, "light"],
      [BOOKMARKS_KEY, '["wlt"]'],
      [REMEMBERED_EMAIL_KEY, "dev@example.com"],
      ["johnnystudio:aaa", "2"],
    ]);
    expect(entries.map((e) => [e.key, e.kind])).toEqual([
      [BOOKMARKS_KEY, "bookmarks"],
      [REMEMBERED_EMAIL_KEY, "remembered-email"],
      [THEME_KEY, "theme"],
      ["johnnystudio:aaa", "other"],
      ["johnnystudio:zzz", "other"],
    ]);
  });

  it("크기는 키와 값의 UTF-8 바이트다", () => {
    expect(siteEntries([["johnnystudio:x", "한"]]).map((e) => e.bytes)).toEqual(["johnnystudio:x".length + 3]);
  });
});
