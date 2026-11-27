import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AssetGrid } from "@/components/asset-card";
import { AssetCover } from "@/components/asset-cover";
import { DraftBadge, StatusBadge, TypeBadge } from "@/components/badges";
import { StarButton } from "@/components/star-button";
import { Breadcrumb, ButtonLink, Container } from "@/components/ui";
import { AssetViewer, VIEWER_HEADING } from "@/components/viewers/asset-viewer";
import { getAsset, getAssets, toSummary } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { TYPE_LABELS } from "@/lib/labels";
import { storyHref, storyKindOf } from "@/lib/story";

export const dynamicParams = false;

export function generateStaticParams() {
  return getAssets().map((a) => ({ slug: a.slug }));
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const asset = getAsset((await params).slug);
  if (!asset) return {};
  const summary = toSummary(asset);
  // 넘겨 주기만 하는 페이지는 검색엔진에 따로 올리지 않는다 (Store·Showroom 화면이 그 작품의 페이지다)
  const moved = Boolean(summary.storeApp || summary.showroomService);
  return { title: asset.title, description: asset.summary, ...(moved && { robots: { index: false, follow: true } }) };
}

/**
 * Store·Showroom 으로 옮긴 작품의 예전 주소. 예전 링크·바깥 링크가 깨지지 않도록 그 화면으로 바로 넘겨 준다.
 * Next 의 redirect() 는 정적 내보내기에서 JS 로만 넘어가는 빈 오류 페이지가 되므로(lang 도 없다) 쓰지 않고,
 * <meta http-equiv="refresh"> (React 가 <head> 로 올린다)와 눌러서 가는 링크를 둔다. CSP 는 refresh 를 막지 않는다
 */
function MovedNotice({ title, href, store }: { title: string; href: string; store: boolean }) {
  return (
    <Container className="py-20 sm:py-28">
      <meta httpEquiv="refresh" content={`0;url=${href}`} />
      <p className="text-sm text-fg-subtle">Library</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight text-fg sm:text-3xl">{title}</h1>
      <p className="mt-4 text-fg-muted">이 작품의 소개는 {store ? "Store" : "Showroom"}에 있습니다. 잠시 뒤 자동으로 넘어갑니다.</p>
      <ButtonLink href={href} className="mt-8">
        {store ? "Store에서 보기" : "Showroom에서 보기"}
        <ArrowRight aria-hidden="true" className="size-4" />
      </ButtonLink>
    </Container>
  );
}

/**
 * 작품 상세. Store·Showroom 으로 옮긴 작품(storeApp·showroomService)은 따로 설명 페이지를 두지 않고 그 화면으로 넘겨 준다 (ADR-0015).
 * 설명 페이지가 남는 것은 코드가 없는 작품뿐이다 (영상·사진·글·하드웨어, Store 에 옮기지 않은 앱).
 */
export default async function AssetPage({ params }: Props) {
  const asset = getAsset((await params).slug);
  if (!asset) notFound();
  const summary = toSummary(asset);
  if (summary.storeApp || summary.showroomService) return <MovedNotice title={asset.title} href={summary.href} store={Boolean(summary.storeApp)} />;

  // 관련 작품: 태그가 겹치거나 같은 유형인 것, 겹치는 태그가 많은 순
  const related = getAssets()
    .filter((a) => a.slug !== asset.slug)
    .map((a) => ({ a, score: a.tags.filter((t) => asset.tags.includes(t)).length * 2 + (a.type === asset.type ? 1 : 0) }))
    .filter((x) => x.score > 0)
    .sort((x, y) => y.score - x.score)
    .slice(0, 3)
    .map((x) => toSummary(x.a));
  // 현재 위치: Story › (영상·사진·글·하드웨어는 그 유형 페이지, 나머지는 Library) › 작품 (ADR-0018)
  const kind = storyKindOf(asset.type);
  const parent = kind ? { href: storyHref(kind), label: TYPE_LABELS[asset.type] } : { href: "/library/", label: "Library" };

  return (
    <article>
      <header className="hero-glow border-b border-line">
        <Container className="py-10 sm:py-14">
          <Breadcrumb className="mb-8" items={[{ label: "Story" }, parent, { label: asset.title }]} />

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
                <StarButton slug={summary.bookmark ?? asset.slug} title={asset.title} withLabel />
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
              icon={asset.icon}
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
