import type { Metadata } from "next";

import { LinkRequestForm } from "@/components/auth/link-request-form";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "가입",
  description: "이메일 인증으로 JohnnyStudio에 가입합니다. 인증한 뒤 비밀번호를 정합니다.",
};

export default function SignupPage() {
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="가입"
        description="이메일 주소를 적으면 인증 메일을 보내 드립니다. 메일의 링크를 열고 비밀번호를 정하면 가입이 끝납니다."
      />
      <Container className="max-w-xl py-12">
        <LinkRequestForm purpose="signup" />
        <noscript>
          <p className="mt-6 text-sm text-fg-muted">가입하려면 브라우저에서 JavaScript를 켜 주세요.</p>
        </noscript>
      </Container>
    </>
  );
}
