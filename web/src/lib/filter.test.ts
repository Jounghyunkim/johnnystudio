import { describe, expect, it } from "vitest";

import { countByType, DEFAULT_QUERY, filterAssets, matches, parseQuery, toSearch } from "./filter";
import type { AssetSummary } from "./types";

const a = (over: Partial<AssetSummary>): AssetSummary => ({
  slug: "x",
  title: "X",
  type: "web-app",
  summary: "",
  status: "live",
  tags: [],
  featured: false,
  draft: false,
  ...over,
});

const list = [
  a({ slug: "ark", title: "Arkurator", summary: "RAG 아카이빙 플랫폼", tags: ["AI", "RAG"], date: "2025-12-19" }),
  a({ slug: "hw", title: "하드웨어 모니터링 앱", type: "desktop-app", tags: ["모니터링"], date: "2026-03" }),
  a({ slug: "vid", title: "Bot 영상", type: "video", tags: ["AI"], date: "2024" }),
];

describe("matches", () => {
  it("빈 검색어는 모두 맞는다", () => expect(matches(list[0]!, "  ")).toBe(true));
  it("대소문자를 가리지 않는다", () => expect(matches(list[0]!, "arKUR")).toBe(true));
  it("모든 단어가 들어 있어야 한다", () => {
    expect(matches(list[0]!, "rag 플랫폼")).toBe(true);
    expect(matches(list[0]!, "rag 영상")).toBe(false);
  });
  it("유형 이름으로도 찾는다", () => expect(matches(list[1]!, "데스크톱")).toBe(true));
  it("#태그는 태그와 정확히 같아야 한다", () => {
    expect(matches(list[2]!, "#ai")).toBe(true);
    expect(matches(list[1]!, "#모니")).toBe(false);
  });
});

describe("filterAssets", () => {
  it("최신순이 기본이다", () => {
    expect(filterAssets(list, DEFAULT_QUERY).map((x) => x.slug)).toEqual(["hw", "ark", "vid"]);
  });
  it("유형으로 거른다", () => {
    expect(filterAssets(list, { ...DEFAULT_QUERY, type: "video" }).map((x) => x.slug)).toEqual(["vid"]);
  });
  it("이름순으로 정렬한다 (한국어 정렬: 한글이 영문보다 앞)", () => {
    expect(filterAssets(list, { ...DEFAULT_QUERY, sort: "name" }).map((x) => x.slug)).toEqual(["hw", "ark", "vid"]);
  });
  it("원본 배열을 바꾸지 않는다", () => {
    const copy = [...list];
    filterAssets(list, { ...DEFAULT_QUERY, sort: "name" });
    expect(list).toEqual(copy);
  });
});

describe("countByType", () => {
  it("검색어를 적용한 뒤 유형별로 센다", () => {
    const c = countByType(list, "#ai");
    expect(c.all).toBe(2);
    expect(c["web-app"]).toBe(1);
    expect(c.video).toBe(1);
    expect(c["desktop-app"]).toBe(0);
  });
});

describe("parseQuery / toSearch", () => {
  it("주고받으면 같다", () => {
    const q = { q: "rag", type: "video" as const, sort: "name" as const };
    expect(parseQuery(toSearch(q))).toEqual(q);
  });
  it("기본값은 주소에 쓰지 않는다", () => expect(toSearch(DEFAULT_QUERY)).toBe(""));
  it("모르는 유형·정렬은 기본값으로", () => {
    expect(parseQuery("?type=nope&sort=zzz")).toEqual(DEFAULT_QUERY);
  });
});
