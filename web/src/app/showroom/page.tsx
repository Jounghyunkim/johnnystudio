import type { Metadata } from "next";
import Link from "next/link";

import { ShowroomBrowser } from "@/components/showroom/showroom-browser";
import { Container, PageHeader } from "@/components/ui";
import { getOfficialShowroomServices } from "@/lib/content";

export const metadata: Metadata = {
  title: "Showroom",
  description: "회원들이 직접 만든 웹 서비스를 소개하고 바로 써 보는 곳. 운영자가 주소와 내용을 확인한 서비스만 공개합니다.",
};

/**
 * Showroom (ADR-0012): Library 의 웹 서비스(공식, content/ 원본, 빌드된 HTML 에 들어간다) + 회원이 소개한 웹 서비스(브라우저에서 API 로 읽는다).
 * 파일을 내려받는 Store 와 짝이다.
 */
export default function ShowroomPage() {
  return (
    <>
      <PageHeader
        eyebrow="Web Services"
        title="Showroom"
        description="회원들이 직접 만든 웹 서비스를 소개하고, 누구나 바로 써 봅니다. 운영자가 주소와 내용을 확인한 서비스만 공개합니다."
      >
        <p className="mt-4 text-sm text-fg-subtle">
          &lsquo;공식&rsquo; 표시는 JohnnyStudio가 만든 서비스입니다. 내려받는 Windows 앱은{" "}
          <Link href="/store/" className="underline underline-offset-4 hover:text-fg">
            Store
          </Link>
          에 있습니다. 소개하기 전에{" "}
          <Link href="/store/terms/" className="underline underline-offset-4 hover:text-fg">
            이용약관
          </Link>
          을 읽어 주세요.
        </p>
      </PageHeader>
      <Container className="py-12">
        <ShowroomBrowser official={getOfficialShowroomServices()} />
        <noscript>
          <p className="mt-6 text-sm text-fg-muted">회원이 소개한 서비스는 JavaScript를 켜야 보입니다.</p>
        </noscript>
      </Container>
    </>
  );
}
