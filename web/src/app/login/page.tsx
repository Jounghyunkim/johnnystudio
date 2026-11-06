import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "로그인",
  description: "이메일과 비밀번호로 JohnnyStudio에 로그인합니다.",
};

export default function LoginPage() {
  return (
    <>
      <PageHeader eyebrow="Account" title="로그인" description="가입한 이메일과 비밀번호로 로그인합니다." />
      <Container className="max-w-xl py-12">
        <LoginForm />
        <noscript>
          <p className="mt-6 text-sm text-fg-muted">로그인하려면 브라우저에서 JavaScript를 켜 주세요.</p>
        </noscript>
      </Container>
    </>
  );
}
