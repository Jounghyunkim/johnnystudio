/**
 * 작품 관리 화면. 파일 이름이 page.dev.tsx 라서 개발 서버(next dev)에서만 페이지가 된다 (next.config.ts 의 pageExtensions).
 * 출시 빌드(out/)에는 들어가지 않는다. 들어가면 check_site.py 가 실패한다 (ADR-0009).
 */
import type { Metadata } from "next";

import { AdminApp } from "@/components/admin/admin-app";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "작품 관리",
  description: "작품을 등록하고 고치고 공개하는 개발 서버 전용 화면",
  robots: { index: false, follow: false },
};

export default function AdminPage() {
  return (
    <>
      <PageHeader
        eyebrow="Studio Admin · 개발 서버 전용"
        title="작품 관리"
        description="새 작품을 등록하고, 빠진 정보를 채우고, 준비되면 공개합니다. 이 화면은 출시 빌드에 들어가지 않습니다."
      />
      <Container className="py-10">
        <AdminApp />
      </Container>
    </>
  );
}
