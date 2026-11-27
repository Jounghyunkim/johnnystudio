import { describe, expect, it } from "vitest";

import { flatNav, isActive, isGroup, isGroupActive, mainNav, NAV_MEMBER, storyNav } from "./nav";
import { isStoryType, typeHref } from "./story";

const BLOG = "https://atozcode.tistory.com/";

describe("주 메뉴", () => {
  it("Story ▾ · Work with me · About | Store · Showroom (2026-11-27 사용자 요청)", () => {
    expect(mainNav(BLOG).map((e) => e.label)).toEqual(["Story", "Work with me", "About"]);
    expect(NAV_MEMBER.map((i) => i.href)).toEqual(["/store/", "/showroom/"]);
  });

  it("Story 아래: Library · Life Log · Blog · 영상 · 사진 · 글 · 하드웨어", () => {
    const story = storyNav(BLOG);
    expect(story.items.map((i) => i.label)).toEqual(["Library", "Life Log", "Blog", "영상", "사진", "글", "하드웨어"]);
    expect(story.items.map((i) => i.href)).toEqual(["/library/", "/log/", BLOG, "/story/video/", "/story/photo/", "/story/article/", "/story/hardware/"]);
    expect(story.items.find((i) => i.label === "Blog")?.external).toBe(true);
  });

  it("블로그 주소가 없으면 Blog 를 뺀다", () => {
    expect(storyNav().items.map((i) => i.label)).not.toContain("Blog");
  });

  it("하위 페이지에서도 켜지고, Story 는 하위 메뉴 중 하나면 켜진다", () => {
    expect(isActive("/store/app/", "/store/")).toBe(true);
    expect(isActive("/showroom/service/", "/showroom/")).toBe(true);
    expect(isActive("/store/app/", "/library/")).toBe(false);
    expect(isActive("/", BLOG)).toBe(false);
    const story = mainNav(BLOG).find(isGroup)!;
    expect(isGroupActive("/log/", story)).toBe(true);
    expect(isGroupActive("/story/photo/", story)).toBe(true);
    expect(isGroupActive("/work/", story)).toBe(false);
  });

  it("바닥글은 묶음을 풀어 한 줄로 늘어놓는다", () => {
    expect(flatNav(BLOG).map((i) => i.label)).toEqual([
      "Library", "Life Log", "Blog", "영상", "사진", "글", "하드웨어", "Work with me", "About", "Store", "Showroom",
    ]);
  });

  it("영상·사진·글·하드웨어는 Story 페이지, 앱·서비스는 Library 의 유형 칸", () => {
    expect(typeHref("video")).toBe("/story/video/");
    expect(typeHref("gallery")).toBe("/story/photo/");
    expect(typeHref("desktop-app")).toBe("/library/?type=desktop-app");
    expect(["web-app", "desktop-app", "android-app", "web-package"].some((t) => isStoryType(t as never))).toBe(false);
  });
});
