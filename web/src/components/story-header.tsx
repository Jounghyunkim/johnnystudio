import type { ComponentProps } from "react";

import { getProfile } from "@/lib/content";
import { storyNav } from "@/lib/nav";

import { StoryTabs } from "./story-tabs";
import { Breadcrumb, PageHeader } from "./ui";

/**
 * Story ▾ 아래 페이지(Library · Life Log · 영상 · 사진 · 글 · 하드웨어)의 머리글 (2026-11-28 사용자 요청, ADR-0018 결정 5).
 * 제목 위에 현재 위치(Story › 영상), 아래 가로줄에 Story 탭을 붙여 다른 Story 페이지로 바로 간다.
 * current: 이 페이지의 메뉴 주소 (lib/nav.ts 의 storyNav 항목 중 하나)
 */
export function StoryHeader({
  current,
  ...header
}: { current: string } & Omit<ComponentProps<typeof PageHeader>, "location" | "tabs">) {
  const story = storyNav(getProfile().blog);
  const here = story.items.find((i) => i.href === current);
  if (!here) throw new Error(`Story 메뉴에 없는 주소: ${current}`);
  return (
    <PageHeader
      {...header}
      location={<Breadcrumb items={[{ label: story.label }, { label: here.label }]} />}
      tabs={<StoryTabs group={story} current={current} />}
    />
  );
}
