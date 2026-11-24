import type { Metadata } from "next";
import Link from "next/link";

import { StoreBrowser } from "@/components/store/store-browser";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "Store",
  description: "회원들이 직접 만든 Windows 프로그램을 올리고 내려받는 곳. 운영자가 검토하고 바이러스 검사를 거친 앱만 공개합니다.",
};

/**
 * Store: 회원이 올린 앱 (ADR-0012). 목록은 브라우저에서 API 로 읽는다 (빌드된 HTML 에는 안내만 있다).
 * 운영자의 작품은 Library 에 있다.
 */
export default function StorePage() {
  return (
    <>
      <PageHeader
        eyebrow="Member Store"
        title="Store"
        description="회원들이 직접 만든 Windows 프로그램을 올리고, 누구나 내려받아 써 봅니다. 운영자가 검토하고 바이러스 검사를 거친 앱만 공개합니다."
      >
        <p className="mt-4 text-sm text-fg-subtle">
          JohnnyStudio가 만든 앱은{" "}
          <Link href="/library/" className="underline underline-offset-4 hover:text-fg">
            Library
          </Link>
          에 있습니다. 올리기 전에{" "}
          <Link href="/store/terms/" className="underline underline-offset-4 hover:text-fg">
            Store 이용약관
          </Link>
          을 읽어 주세요.
        </p>
      </PageHeader>
      <Container className="py-12">
        <StoreBrowser />
        <noscript>
          <p className="mt-6 text-sm text-fg-muted">Store 목록은 JavaScript를 켜야 보입니다.</p>
        </noscript>
      </Container>
    </>
  );
}
