import type { Metadata } from "next";

import { Timeline } from "@/components/timeline";
import { Container, PageHeader } from "@/components/ui";
import { getTimeline } from "@/lib/content";

export const metadata: Metadata = {
  title: "Life Log",
  description: "JohnnyStudio의 작업과 이정표를 시간 순서로 모은 기록.",
};

export default function LogPage() {
  const items = getTimeline();
  return (
    <>
      <PageHeader
        eyebrow="Digital Twin & Life Log"
        title="Life Log"
        description="무엇을 언제 시작했고, 무엇을 바꾸고 옮겨 왔는지. 작품과 이정표를 한 줄로 이었습니다."
      />
      <Container className="py-14">
        <Timeline items={items} byYear />
      </Container>
    </>
  );
}
