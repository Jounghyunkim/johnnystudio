import type { Metadata } from "next";

import { ListingEditPage } from "@/components/listing/listing-edit-page";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "서비스 소개 꾸미기",
  description: "Showroom에 소개한 서비스의 기능·화면·사용 방법을 꾸밉니다.",
  robots: { index: false, follow: false },
};

export default function ShowroomListingPage() {
  return (
    <>
      <PageHeader
        eyebrow="Showroom"
        title="서비스 소개 꾸미기"
        description="기능·화면 그림·사용 방법·자주 묻는 질문을 채워 리뷰 글처럼 읽히는 소개를 만듭니다. AI로 만든 소개 자료(zip·md)를 불러올 수도 있습니다."
      />
      <Container className="max-w-3xl py-12">
        <ListingEditPage kind="showroom" />
      </Container>
    </>
  );
}
