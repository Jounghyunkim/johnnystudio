import { describe, expect, it } from "vitest";

import { assetHref } from "./hrefs";
import { mergeOfficial, serviceCardSummary, storeCardSummary } from "./library";
import type { ServiceCard } from "./showroom";
import type { StoreCard } from "./store";
import type { AssetSummary } from "./types";

const card = (over: Partial<AssetSummary>): AssetSummary => ({
  slug: "x",
  href: "/library/x/",
  bookmark: "x",
  title: "X",
  type: "desktop-app",
  summary: "작품 파일 소개",
  status: "live",
  date: "2026-01-01",
  tags: ["태그"],
  icon: "/media/x/icon.png",
  featured: false,
  draft: false,
  ...over,
});

const app = (over: Partial<StoreCard>): StoreCard => ({
  code: "Ab12Cd34",
  official: true,
  name: "DB 이름",
  summary: "DB 소개",
  category: "utility",
  category_label: "유틸리티",
  publisher: "JohnnyStudio",
  has_icon: true,
  version: "1.0.0",
  arch: "x64",
  size: 1000,
  updated_at: "2026-11-20T03:00:00+00:00",
  ...over,
});

const service = (over: Partial<ServiceCard>): ServiceCard => ({
  code: "Xy98Zw76",
  official: true,
  name: "DB 서비스",
  url: "https://svc.example/",
  host: "svc.example",
  summary: "DB 서비스 소개",
  category: "ai",
  category_label: "AI",
  publisher: "JohnnyStudio",
  has_icon: false,
  updated_at: "2026-11-21T03:00:00+00:00",
  ...over,
});

const linkedApp = card({ slug: "tool", storeApp: "Ab12Cd34", href: "/store/app/?id=Ab12Cd34", bookmark: "tool", title: "Tool" });
const linkedSvc = card({ slug: "web", type: "web-app", showroomService: "Xy98Zw76", href: "/showroom/service/?id=Xy98Zw76", bookmark: "web", title: "Web", quickAction: { label: "실행", href: "https://old.example/" } });
const plain = card({ slug: "video", type: "video", href: "/library/video/", bookmark: "video", title: "Video" });

describe("assetHref", () => {
  it("Store·Showroom 코드가 있으면 그 화면, 없으면 Library 상세", () => {
    expect(assetHref({ slug: "a", storeApp: "Ab12Cd34" })).toBe("/store/app/?id=Ab12Cd34");
    expect(assetHref({ slug: "a", showroomService: "Xy98Zw76" })).toBe("/showroom/service/?id=Xy98Zw76");
    expect(assetHref({ slug: "a" })).toBe("/library/a/");
  });
});

describe("mergeOfficial: Library 를 Store·Showroom 의 공식 목록에 맞춘다", () => {
  it("목록을 아직 받지 못하면(null) 작품 파일의 카드 그대로", () => {
    expect(mergeOfficial([linkedApp, linkedSvc, plain], null, null)).toEqual([linkedApp, linkedSvc, plain]);
  });

  it("이어진 작품은 이름·소개를 Store·Showroom 의 것으로, 그 밖(slug·즐겨찾기·태그·아이콘·날짜)은 작품 파일 그대로", () => {
    const [a, s, p] = mergeOfficial([linkedApp, linkedSvc, plain], [app({})], [service({})]);
    expect(a).toEqual({ ...linkedApp, title: "DB 이름", summary: "DB 소개" });
    expect(s).toEqual({ ...linkedSvc, title: "DB 서비스", summary: "DB 서비스 소개", quickAction: { label: "실행", href: "https://svc.example/" } });
    expect(p).toBe(plain);
  });

  it("Store·Showroom 에서 내리거나 숨긴 작품은 빠진다 (받은 쪽만)", () => {
    expect(mergeOfficial([linkedApp, linkedSvc, plain], [], null).map((x) => x.slug)).toEqual(["web", "video"]);
    expect(mergeOfficial([linkedApp, linkedSvc, plain], null, []).map((x) => x.slug)).toEqual(["tool", "video"]);
  });

  it("작품 파일 없이 Store·Showroom 에만 올린 공식 앱·서비스를 더한다", () => {
    const more = mergeOfficial([linkedApp], [app({}), app({ code: "New11111", name: "새 앱" })], [service({ code: "Svc22222", name: "새 서비스" })]);
    expect(more.map((x) => [x.slug, x.href, x.bookmark])).toEqual([
      ["tool", "/store/app/?id=Ab12Cd34", "tool"],
      ["store:New11111", "/store/app/?id=New11111", "store:New11111"],
      ["showroom:Svc22222", "/showroom/service/?id=Svc22222", null],
    ]);
  });

  it("공식이 아니라고 온 것은 넣지 않는다", () => {
    expect(mergeOfficial([], [app({ official: false })], [service({ official: false })])).toEqual([]);
  });
});

describe("Store·Showroom 에만 있는 공식 카드", () => {
  it("Store 앱: 데스크톱 앱, 아이콘은 API, 날짜는 마지막 공개 버전", () => {
    expect(storeCardSummary(app({}))).toMatchObject({
      type: "desktop-app",
      title: "DB 이름",
      date: "2026-11-20",
      icon: "/api/store/apps/Ab12Cd34/icon?v=2026-11-20T03%3A00%3A00%2B00%3A00",
      tags: [],
    });
    expect(storeCardSummary(app({ has_icon: false })).icon).toBeUndefined();
  });

  it("Showroom 서비스: 웹 서비스, 카드에서 바로 실행, 즐겨찾기 없음", () => {
    expect(serviceCardSummary(service({}))).toMatchObject({ type: "web-app", bookmark: null, quickAction: { label: "실행", href: "https://svc.example/" }, icon: undefined });
  });
});
