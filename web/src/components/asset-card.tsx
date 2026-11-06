import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { formatDate } from "@/lib/format";
import type { AssetSummary } from "@/lib/types";

import { AssetCover } from "./asset-cover";
import { DraftBadge, StatusBadge, TypeBadge } from "./badges";
import { StarButton } from "./star-button";

/**
 * 에셋 카드. 카드 전체가 상세 페이지 링크이고, 오른쪽 아래 버튼(바로 실행·즐겨찾기)은 그 위에 따로 눌린다.
 */
export function AssetCard({ asset, headingLevel = 3 }: { asset: AssetSummary; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = `/library/${asset.slug}/`;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-line-strong hover:bg-raised has-[.card-link:focus-visible]:outline-2 has-[.card-link:focus-visible]:outline-offset-2 has-[.card-link:focus-visible]:outline-accent">
      <AssetCover type={asset.type} cover={asset.cover} coverAlt={asset.coverAlt} className="aspect-[16/10] border-b border-line" />
      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={asset.type} />
          <StatusBadge status={asset.status} />
          {asset.draft && <DraftBadge />}
        </div>
        <Heading className="text-lg font-semibold leading-snug text-fg">
          <Link href={href} className="card-link outline-none after:absolute after:inset-0 after:content-['']">
            {asset.title}
          </Link>
        </Heading>
        <p className="line-clamp-2 text-sm leading-relaxed text-fg-muted">{asset.summary}</p>
        <div className="mt-auto flex items-center justify-between gap-3 pt-1">
          <span className="text-xs tabular-nums text-fg-subtle">{formatDate(asset.date)}</span>
          {/* z-10: 카드 전체 링크 위에서 따로 눌리게 */}
          <div className="relative z-10 flex items-center gap-1">
            {asset.quickAction && (
              <a
                href={asset.quickAction.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-accent hover:bg-accent/10 light:hover:text-accent-hover"
              >
                {asset.quickAction.label}
                <ArrowUpRight aria-hidden="true" className="size-4" />
                <span className="sr-only">: {asset.title} (새 탭에서 열림)</span>
              </a>
            )}
            <StarButton slug={asset.slug} title={asset.title} />
          </div>
        </div>
      </div>
    </article>
  );
}

export function AssetGrid({ assets }: { assets: readonly AssetSummary[] }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {assets.map((a) => (
        <li key={a.slug}>
          <AssetCard asset={a} />
        </li>
      ))}
    </ul>
  );
}
