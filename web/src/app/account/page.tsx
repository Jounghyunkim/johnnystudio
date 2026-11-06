import type { Metadata } from "next";

import { AccountView } from "@/components/auth/account-view";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "계정",
  description: "로그인한 계정의 정보, 로그아웃, 회원 탈퇴.",
  robots: { index: false, follow: false },
};

export default function AccountPage() {
  return (
    <>
      <PageHeader eyebrow="Account" title="계정" />
      <Container className="max-w-2xl py-12">
        <AccountView />
      </Container>
    </>
  );
}
