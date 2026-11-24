import type { Metadata } from "next";

import { StoreManage } from "@/components/store/store-manage";
import { Container, PageHeader } from "@/components/ui";

// 운영자 검토 화면. 페이지 자체는 누구나 열 수 있지만 내용은 API 가 운영자에게만 준다 (ADR-0012)
export const metadata: Metadata = {
  title: "Store·Showroom 검토",
  robots: { index: false, follow: false },
};

export default function StoreManagePage() {
  return (
    <>
      <PageHeader eyebrow="Store" title="검토" description="Store 앱과 Showroom 서비스의 검토 대기, 신고, 숨김, 차단한 회원" />
      <Container className="max-w-5xl py-12">
        <StoreManage />
      </Container>
    </>
  );
}
