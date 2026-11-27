import type { Metadata } from "next";

import { LibraryBrowser } from "@/components/library-browser";
import { StoryHeader } from "@/components/story-header";
import { Container } from "@/components/ui";
import { getAssets, toSummary } from "@/lib/content";
import { isStoryType } from "@/lib/story";

export const metadata: Metadata = {
  title: "Library",
  description: "JohnnyStudio가 Store와 Showroom에 올린 앱과 웹 서비스를 한곳에서 찾습니다.",
};

export default function LibraryPage() {
  // 영상·사진·글·하드웨어는 Story ▾ 의 유형별 페이지에 모은다 (ADR-0018). Library 는 앱·서비스 (ADR-0015)
  const assets = getAssets()
    .filter((a) => !isStoryType(a.type))
    .map(toSummary);
  return (
    <>
      <StoryHeader
        current="/library/"
        eyebrow="Unified Asset Library"
        title="Library"
        description="JohnnyStudio가 Store와 Showroom에 올린 앱과 웹 서비스를 한자리에 모았습니다. 누르면 Store·Showroom의 소개로 갑니다."
      />
      <Container className="py-12">
        <LibraryBrowser assets={assets} />
      </Container>
    </>
  );
}
