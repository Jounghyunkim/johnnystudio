import type { Metadata } from "next";

import { LogoMark } from "@/components/logo-mark";
import { ButtonLink, Container } from "@/components/ui";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
  description: "요청한 페이지를 찾을 수 없습니다.",
};

export default function NotFound() {
  return (
    <section className="hero-glow">
      <Container className="py-28 sm:py-36">
        <LogoMark className="mb-8 h-12" />
        <p className="font-mono text-sm font-semibold text-accent">404</p>
        <h1 className="mt-4 text-3xl font-bold tracking-tight text-fg sm:text-5xl">페이지를 찾을 수 없습니다</h1>
        <p className="mt-4 max-w-xl text-fg-muted">주소가 바뀌었거나 없는 페이지입니다. 찾는 작품이 있다면 Library에서 검색해 보세요.</p>
        <div className="mt-10 flex flex-wrap gap-3">
          <ButtonLink href="/">홈으로</ButtonLink>
          <ButtonLink href="/library/" variant="secondary">
            Library
          </ButtonLink>
        </div>
      </Container>
    </section>
  );
}
