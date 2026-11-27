import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { formatDate } from "@/lib/format";
import type { AssetSummary } from "@/lib/types";

import { AssetCover } from "./asset-cover";
import { DraftBadge, StatusBadge, TypeBadge } from "./badges";
import { MsStoreIcon } from "./ms-store-icon";
import { StarButton } from "./star-button";
import { cx } from "./ui";

/**
 * 에셋 카드. 카드 전체가 설명 화면 링크이고, 오른쪽 아래 버튼(바로 실행·즐겨찾기)은 그 위에 따로 눌린다.
 * 설명 화면은 Store·Showroom 으로 옮긴 작품이면 Store 앱·Showroom 서비스 화면, 아니면 Library 상세다 (asset.href, ADR-0015).
 */
export function AssetCard({ asset, headingLevel = 3 }: { asset: AssetSummary; headingLevel?: 2 | 3 }) {
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = asset.href;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-card border border-line bg-surface transition-colors hover:border-line-strong hover:bg-raised has-[.card-link:focus-visible]:outline-2 has-[.card-link:focus-visible]:outline-offset-2 has-[.card-link:focus-visible]:outline-accent">
      <AssetCover type={asset.type} cover={asset.cover} coverAlt={asset.coverAlt} icon={asset.icon} className="aspect-[16/10] border-b border-line" />
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
        {/* 4칸(카드 260px 쯤)에서도 한 줄: 날짜·바로가기는 줄을 바꾸지 않고, 바로가기 안쪽 여백을 줄인다 */}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <span className="whitespace-nowrap text-xs tabular-nums text-fg-subtle">{formatDate(asset.date)}</span>
          {/* z-10: 카드 전체 링크 위에서 따로 눌리게 */}
          <div className="relative z-10 flex shrink-0 items-center gap-0.5">
            {asset.quickAction && (
              <a
                href={asset.quickAction.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1 whitespace-nowrap rounded-full px-2.5 text-sm font-semibold text-accent hover:bg-accent/10 light:hover:text-accent-hover"
              >
                {asset.quickAction.icon === "microsoft-store" && <MsStoreIcon className="size-[18px]" />}
                {asset.quickAction.label}
                <ArrowUpRight aria-hidden="true" className="size-4" />
                <span className="sr-only">: {asset.title} (새 탭에서 열림)</span>
              </a>
            )}
            {asset.bookmark && <StarButton slug={asset.bookmark} title={asset.title} />}
          </div>
        </div>
      </div>
    </article>
  );
}

/**
 * 넓은 화면의 칸 수. Library 목록은 4칸 (2026-11-26 사용자 요청 "4×n"), 홈·비슷한 작품·My Studio 는 3칸.
 * 4칸은 1280px(xl)부터: 1024px 에서 4칸이면 카드가 229px 로 좁아져 아래 줄(날짜·바로가기·☆)이 넘친다
 */
const GRID_COLUMNS = {
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
} as const;

export function AssetGrid({ assets, columns = 3 }: { assets: readonly AssetSummary[]; columns?: keyof typeof GRID_COLUMNS }) {
  return (
    <ul className={cx("grid gap-5", GRID_COLUMNS[columns])}>
      {assets.map((a) => (
        <li key={a.slug}>
          <AssetCard asset={a} />
        </li>
      ))}
    </ul>
  );
}
