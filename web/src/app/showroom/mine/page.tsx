import type { Metadata } from "next";

import { ShowroomMine } from "@/components/showroom/showroom-mine";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "내 서비스",
  description: "Showroom에 소개한 서비스의 검토 상태와 정보 고치기.",
  robots: { index: false, follow: false },
};

export default function ShowroomMinePage() {
  return (
    <>
      <PageHeader eyebrow="Showroom" title="내 서비스" description="검토 상태와 반려 사유를 확인하고, 소개를 고칩니다." />
      <Container className="max-w-4xl py-12">
        <ShowroomMine />
      </Container>
    </>
  );
}
