import type { Metadata } from "next";

import { StoreMine } from "@/components/store/store-mine";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "내 앱",
  description: "Store에 올린 앱의 검토 상태, 바이러스 검사 결과, 버전 관리.",
  robots: { index: false, follow: false },
};

export default function StoreMinePage() {
  return (
    <>
      <PageHeader eyebrow="Store" title="내 앱" description="검토 상태와 반려 사유, 검사 결과를 확인하고 새 버전을 올립니다." />
      <Container className="max-w-4xl py-12">
        <StoreMine />
      </Container>
    </>
  );
}
