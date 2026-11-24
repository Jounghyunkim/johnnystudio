import type { Metadata } from "next";

import { StoreAppView } from "@/components/store/store-app-view";
import { Container } from "@/components/ui";

// 앱마다 주소는 /store/app/?id=<코드> 이다. 정적 내보내기라서 앱마다 페이지를 만들지 않고, 이 페이지가 API 로 읽어 그린다 (ADR-0012)
export const metadata: Metadata = {
  title: "Store 앱",
  description: "회원이 올린 Windows 앱의 정보, 바이러스 검사 결과, 체크섬, 내려받기.",
};

export default function StoreAppPage() {
  return (
    <Container className="max-w-5xl py-12 sm:py-16">
      <StoreAppView />
      <noscript>
        <p className="text-sm text-fg-muted">앱 정보는 JavaScript를 켜야 보입니다.</p>
      </noscript>
    </Container>
  );
}
