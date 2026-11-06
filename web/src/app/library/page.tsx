import type { Metadata } from "next";

import { LibraryBrowser } from "@/components/library-browser";
import { Container, PageHeader } from "@/components/ui";
import { getAssets, toSummary } from "@/lib/content";

export const metadata: Metadata = {
  title: "Library",
  description: "JohnnyStudio의 모든 작품: 웹 서비스, 데스크톱 툴, 영상, 사진, 글, 하드웨어.",
};

export default function LibraryPage() {
  const assets = getAssets().map(toSummary);
  return (
    <>
      <PageHeader
        eyebrow="Unified Asset Library"
        title="Library"
        description="형태가 달라도 같은 자리에서 찾습니다. 웹 서비스는 바로 실행하고, 툴은 바로 내려받으세요."
      />
      <Container className="py-12">
        <LibraryBrowser assets={assets} />
      </Container>
    </>
  );
}
