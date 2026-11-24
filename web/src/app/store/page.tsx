import type { Metadata } from "next";
import Link from "next/link";

import { StoreBrowser } from "@/components/store/store-browser";
import { Container, PageHeader } from "@/components/ui";
import { getOfficialStoreApps } from "@/lib/content";

export const metadata: Metadata = {
  title: "Store",
  description: "JohnnyStudio의 Windows 앱과 회원들이 직접 만든 프로그램을 한곳에서 내려받는 곳. 회원 앱은 운영자가 검토하고 바이러스 검사를 거친 것만 공개합니다.",
};

/**
 * Store (ADR-0012): Library 의 Windows 앱(공식, content/ 원본, 빌드된 HTML 에 들어간다) + 회원이 올린 앱(브라우저에서 API 로 읽는다).
 */
export default function StorePage() {
  return (
    <>
      <PageHeader
        eyebrow="Windows Apps"
        title="Store"
        description="JohnnyStudio가 만든 Windows 앱과 회원들이 직접 만든 프로그램을 한곳에서 내려받아 써 봅니다. 회원 앱은 운영자가 검토하고 바이러스 검사를 거친 것만 공개합니다."
      >
        <p className="mt-4 text-sm text-fg-subtle">
          &lsquo;공식&rsquo; 표시는 JohnnyStudio가 만든 앱이고, 자세한 소개는{" "}
          <Link href="/library/" className="underline underline-offset-4 hover:text-fg">
            Library
          </Link>
          에 있습니다. 앱을 올리기 전에{" "}
          <Link href="/store/terms/" className="underline underline-offset-4 hover:text-fg">
            Store 이용약관
          </Link>
          을 읽어 주세요.
        </p>
      </PageHeader>
      <Container className="py-12">
        <StoreBrowser official={getOfficialStoreApps()} />
        <noscript>
          <p className="mt-6 text-sm text-fg-muted">회원이 올린 앱은 JavaScript를 켜야 보입니다.</p>
        </noscript>
      </Container>
    </>
  );
}
