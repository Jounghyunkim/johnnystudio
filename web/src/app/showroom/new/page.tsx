import type { Metadata } from "next";

import { ShowroomSubmit } from "@/components/showroom/showroom-submit";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "서비스 등록",
  description: "직접 만든 웹 서비스를 Showroom에 소개합니다. 운영자가 확인한 뒤 공개합니다.",
  robots: { index: false, follow: false },
};

export default function ShowroomNewPage() {
  return (
    <>
      <PageHeader
        eyebrow="Showroom"
        title="서비스 등록"
        description="직접 만든 웹 서비스의 이름·주소·설명을 적어 주세요. 운영자가 주소와 내용을 확인한 뒤 공개합니다."
      />
      <Container className="max-w-3xl py-12">
        <ShowroomSubmit />
      </Container>
    </>
  );
}
