import type { Metadata } from "next";

import { StoreUpload } from "@/components/store/store-upload";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "앱 올리기",
  description: "직접 만든 Windows 프로그램을 Store에 올립니다. 운영자가 검토한 뒤 공개합니다.",
  robots: { index: false, follow: false },
};

export default function StoreNewPage() {
  return (
    <>
      <PageHeader
        eyebrow="Store"
        title="앱 올리기"
        description="설치 파일(.exe .msi .msix .zip .7z)을 놓으면 이름·버전·아이콘을 읽어 채웁니다. 바이러스 검사와 운영자 검토를 거쳐 공개됩니다."
      />
      <Container className="max-w-3xl py-12">
        <StoreUpload />
      </Container>
    </>
  );
}
