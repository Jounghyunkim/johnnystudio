import type { Metadata } from "next";

import { VerifyView } from "@/components/auth/verify-view";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "이메일 확인",
  description: "메일로 받은 링크로 이메일 주소를 확인합니다.",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function VerifyPage() {
  return (
    <>
      <PageHeader eyebrow="Account" title="이메일 확인" />
      <Container className="max-w-xl py-12">
        <VerifyView />
        <noscript>
          <p className="mt-6 text-sm text-fg-muted">로그인하려면 브라우저에서 JavaScript를 켜 주세요.</p>
        </noscript>
      </Container>
    </>
  );
}
