/**
 * Story ▾ 의 유형별 페이지 (/story/<slug>/, ADR-0018, 2026-11-27 사용자 요청).
 * Store·Showroom 에 없는 작품 유형(영상·사진·글·하드웨어)은 Library(= Store·Showroom 의 공식 앱·서비스, ADR-0015) 대신 여기에 모인다.
 * zod 없이 값만 둔다 (헤더 메뉴 = 클라이언트 컴포넌트에서도 쓴다).
 */
import type { AssetType } from "./asset-types";

export const STORY_KINDS = [
  { slug: "video", type: "video", description: "직접 만든 영상을 모았습니다. 누를 때만 YouTube 영상을 불러옵니다." },
  { slug: "photo", type: "gallery", description: "찍은 사진과 앨범을 모았습니다. 사진을 크게 넘겨 볼 수 있습니다." },
  { slug: "article", type: "article", description: "블로그에 쓴 글을 골라 요약했습니다. 누르면 원문으로 이어집니다." },
  { slug: "hardware", type: "hardware", description: "직접 만든 하드웨어 작품을 만든 과정의 사진과 영상으로 소개합니다." },
] as const satisfies readonly { slug: string; type: AssetType; description: string }[];

export type StoryKind = (typeof STORY_KINDS)[number];

export const storyHref = (kind: Pick<StoryKind, "slug">) => `/story/${kind.slug}/`;

export function storyKindOf(type: AssetType): StoryKind | undefined {
  return STORY_KINDS.find((k) => k.type === type);
}

/** Library 에 넣지 않고 Story 페이지에 모으는 유형 */
export function isStoryType(type: AssetType): boolean {
  return storyKindOf(type) !== undefined;
}

/** 유형 하나를 모아 보는 곳: Story 유형은 그 페이지, 나머지(앱·서비스)는 Library 의 유형 칸 */
export function typeHref(type: AssetType): string {
  const kind = storyKindOf(type);
  return kind ? storyHref(kind) : `/library/?type=${type}`;
}
