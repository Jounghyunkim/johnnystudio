import type { Metadata } from "next";

import { StudioView } from "@/components/studio-view";
import { Container, PageHeader } from "@/components/ui";
import { getAssets, toSummary } from "@/lib/content";

export const metadata: Metadata = {
  title: "My Studio",
  description: "즐겨찾기한 작품과 Store 앱을 모아 보는 나만의 화면. 로그인하면 계정에 저장되어 다른 브라우저에서도 볼 수 있습니다.",
};

export default function StudioPage() {
  const assets = getAssets().map(toSummary);
  return (
    <>
      <PageHeader
        eyebrow="Personalized Dashboard"
        title="My Studio"
        description="즐겨찾기한 JohnnyStudio 작품과 Store 앱을 나눠서 모아 봅니다. 로그인하면 계정에 저장되어 다른 브라우저·기기에서도 같은 목록을 봅니다. 로그인하지 않으면 이 브라우저에만 저장됩니다."
      />
      <Container className="py-12">
        <StudioView assets={assets} />
      </Container>
    </>
  );
}
