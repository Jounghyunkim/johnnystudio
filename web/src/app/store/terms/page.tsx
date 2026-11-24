import type { Metadata } from "next";

import { Container, PageHeader } from "@/components/ui";
import { getPage } from "@/lib/content";
import { formatDate } from "@/lib/format";

const page = getPage("store-terms");

export const metadata: Metadata = {
  title: page.title,
  description: page.description,
};

export default function StoreTermsPage() {
  return (
    <>
      <PageHeader eyebrow="Store" title={page.title} description={page.description}>
        <p className="mt-4 text-sm text-fg-subtle">
          시행일 <time dateTime={page.updated}>{formatDate(page.updated)}</time>
        </p>
      </PageHeader>
      <Container className="max-w-3xl py-12">
        <div className="prose-studio" dangerouslySetInnerHTML={{ __html: page.html }} />
      </Container>
    </>
  );
}
