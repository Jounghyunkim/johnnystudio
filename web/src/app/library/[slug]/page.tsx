import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetGrid } from "@/components/asset-card";
import { AssetCover } from "@/components/asset-cover";
import { DraftBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { StarButton } from "@/components/star-button";
import { Container } from "@/components/ui";
import { AssetViewer, VIEWER_HEADING } from "@/components/viewers/asset-viewer";
import { getAsset, getAssets, toSummary } from "@/lib/content";
import { formatDate } from "@/lib/format";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAssets().map((a) => ({ slug: a.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const asset = getAsset((await params).slug);
  return asset ? { title: asset.title, description: asset.summary } : {};
}

export default async function AssetPage({ params }: Props) {
  const asset = getAsset((await params).slug);
  if (!asset) notFound();

  // 관련 작품: 태그가 겹치거나 같은 유형인 것, 겹치는 태그가 많은 순
  const related = getAssets()
    .filter((a) => a.slug !== asset.slug)
    .map((a) => ({ a, score: a.tags.filter((t) => asset.tags.includes(t)).length * 2 + (a.type === asset.type ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((x) => toSummary(x.a));

  return (
    <article>
      <header className="hero-glow border-b border-line">
        <Container className="py-10 sm:py-14">
          <nav aria-label="현재 위치" className="mb-8 text-sm text-fg-subtle">
            <ol className="flex items-center gap-1.5">
              <li>
                <Link href="/library/" className="hover:text-fg">
                  Library
                </Link>
              </li>
              <li aria-hidden="true">
                <ChevronRight className="size-3.5" />
              </li>
              <li aria-current="page" className="text-fg-muted">
                {asset.title}
              </li>
            </ol>
          </nav>

          <div className="grid items-center gap-10 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <TypeBadge type={asset.type} />
                <StatusBadge status={asset.status} />
                {asset.draft && <DraftBadge />}
              </div>
              <h1 className="mt-5 text-3xl font-bold tracking-tight text-fg sm:text-5xl">{asset.title}</h1>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">{asset.summary}</p>

              <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                {asset.date && (
                  <div className="flex gap-2">
                    <dt className="text-fg-subtle">시작</dt>
                    <dd className="tabular-nums text-fg-muted">{formatDate(asset.date)}</dd>
                  </div>
                )}
                {asset.updated && (
                  <div className="flex gap-2">
                    <dt className="text-fg-subtle">업데이트</dt>
                    <dd className="tabular-nums text-fg-muted">{formatDate(asset.updated)}</dd>
                  </div>
                )}
              </dl>

              {asset.tags.length > 0 && (
                <ul aria-label="태그" className="mt-5 flex flex-wrap gap-2">
                  {asset.tags.map((t) => (
                    <li key={t}>
                      <Link
                        href={`/library/?q=${encodeURIComponent(`#${t}`)}`}
                        className="inline-block rounded-full border border-line px-3 py-1 text-xs text-fg-muted hover:border-line-strong hover:text-fg"
                      >
                        #{t}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-8 flex flex-wrap gap-3">
                <StarButton slug={asset.slug} title={asset.title} withLabel />
                {asset.links.map((l) => (
                  <a
                    key={l.href}
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-11 items-center gap-1.5 rounded-full px-4 text-sm font-semibold text-fg-muted hover:bg-raised hover:text-fg"
                  >
                    {l.label}
                    <ArrowUpRight aria-hidden="true" className="size-4" />
                  </a>
                ))}
              </div>
            </div>

            <AssetCover
              type={asset.type}
              cover={asset.cover}
              coverAlt={asset.coverAlt}
              eager
              className="aspect-[4/3] rounded-card border border-line"
            />
          </div>
        </Container>
      </header>

      <Container className="grid gap-14 py-14">
        <section id="viewer" aria-labelledby="viewer-title">
          <h2 id="viewer-title" className="mb-5 text-xl font-bold text-fg">
            {VIEWER_HEADING[asset.type]}
          </h2>
          <AssetViewer asset={asset} />
        </section>

        {asset.html && (
          <section aria-labelledby="about-title" className="max-w-3xl">
            <h2 id="about-title" className="mb-5 text-xl font-bold text-fg">
              소개
            </h2>
            {/* 저장소 안의 신뢰된 Markdown 파일에서만 만든 HTML 이다 (content/assets) */}
            <div className="prose-studio" dangerouslySetInnerHTML={{ __html: asset.html }} />
          </section>
        )}

        {related.length > 0 && (
          <section aria-labelledby="related-title">
            <h2 id="related-title" className="mb-5 text-xl font-bold text-fg">
              비슷한 작품
            </h2>
            <AssetGrid assets={related} />
          </section>
        )}
      </Container>
    </article>
  );
}
