import type { Metadata } from "next";

import { StudioView } from "@/components/studio-view";
import { Container, PageHeader } from "@/components/ui";
import { getAssets, toSummary } from "@/lib/content";

export const metadata: Metadata = {
  title: "My Studio",
  description: "즐겨찾기한 작품을 모아 보는 나만의 화면. 로그인 없이 브라우저에 저장됩니다.",
};

export default function StudioPage() {
  const assets = getAssets().map(toSummary);
  return (
    <>
      <PageHeader
        eyebrow="Personalized Dashboard"
        title="My Studio"
        description="즐겨찾기한 작품만 모아 봅니다. 목록은 이 브라우저에만 저장되고, 로그인이 생기면 기기 사이에 옮길 수 있습니다."
      />
      <Container className="py-12">
        <StudioView assets={assets} />
      </Container>
    </>
  );
}
