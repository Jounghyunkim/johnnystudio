import type { Metadata } from "next";

import { LinkRequestForm } from "@/components/auth/link-request-form";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "비밀번호 재설정",
  description: "가입한 이메일로 링크를 받아 새 비밀번호를 정합니다.",
  robots: { index: false, follow: false },
};

export default function ResetPage() {
  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="비밀번호 재설정"
        description="가입한 이메일 주소로 링크를 보내 드립니다. 링크를 열면 새 비밀번호를 정할 수 있습니다."
      />
      <Container className="max-w-xl py-12">
        <LinkRequestForm purpose="reset" />
      </Container>
    </>
  );
}
