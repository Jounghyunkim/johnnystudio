import type { Metadata } from "next";

import { ShowroomServiceView } from "@/components/showroom/showroom-service-view";
import { Container } from "@/components/ui";
import { getLibrarySlugs } from "@/lib/content";

// 서비스마다 주소는 /showroom/service/?id=<코드> 다. 이 페이지가 API 로 읽어 그린다 (ADR-0012)
export const metadata: Metadata = {
  title: "Showroom 서비스",
  description: "웹 서비스의 소개와 주소.",
};

export default function ShowroomServicePage() {
  return (
    <Container className="max-w-5xl py-12 sm:py-16">
      <ShowroomServiceView librarySlugs={getLibrarySlugs().showroom} />
      <noscript>
        <p className="text-sm text-fg-muted">서비스 소개는 JavaScript를 켜야 보입니다.</p>
      </noscript>
    </Container>
  );
}
