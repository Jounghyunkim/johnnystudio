import { describe, expect, it } from "vitest";

import { parseBookmarks, toggleSlug } from "./bookmarks";
import { formatBytes, formatDate, hostOf } from "./format";

describe("formatDate", () => {
  it("일·월·연 단위", () => {
    expect(formatDate("2025-12-19")).toBe("2025. 12. 19.");
    expect(formatDate("2026-03")).toBe("2026. 3.");
    expect(formatDate("2024")).toBe("2024");
    expect(formatDate(undefined)).toBe("");
  });
});

describe("formatBytes", () => {
  it("1024 단위로 읽기 쉽게", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(18874368)).toBe("18.0 MB");
    expect(formatBytes(undefined)).toBe("");
  });
});

describe("hostOf", () => {
  it("호스트만 남긴다", () => {
    expect(hostOf("https://arkurator.net/about")).toBe("arkurator.net");
    expect(hostOf("not a url")).toBe("not a url");
  });
});

describe("즐겨찾기 저장 형식", () => {
  it("깨진 값은 빈 목록으로", () => {
    expect(parseBookmarks("{oops")).toEqual([]);
    expect(parseBookmarks('{"a":1}')).toEqual([]);
    expect(parseBookmarks('["a", 1, "b"]')).toEqual(["a", "b"]);
  });
  it("넣었다 뺀다", () => {
    expect(toggleSlug(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSlug(["a", "b"], "a")).toEqual(["b"]);
  });
});
