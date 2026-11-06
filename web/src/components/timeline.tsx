import Link from "next/link";

import { formatDate, yearOf } from "@/lib/format";
import { LOG_KIND_LABELS, TYPE_LABELS } from "@/lib/labels";
import { TYPE_STYLE } from "@/lib/type-style";
import type { TimelineItem } from "@/lib/types";

import { DraftBadge } from "./badges";
import { cx } from "./ui";

function Item({ item }: { item: TimelineItem }) {
  const Icon = item.assetType ? TYPE_STYLE[item.assetType].icon : null;
  return (
    <li className="relative pb-8 pl-8 last:pb-0">
      <span
        aria-hidden="true"
        className={cx(
          "absolute left-0 top-1.5 size-3 -translate-x-1/2 rounded-full ring-4 ring-canvas",
          item.kind === "start" ? "bg-accent" : item.kind === "asset" ? "bg-fg-muted" : "bg-line-strong",
        )}
      />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-fg-subtle">
        <time dateTime={item.date} className="tabular-nums">
          {formatDate(item.date)}
        </time>
        <span>{LOG_KIND_LABELS[item.kind]}</span>
        {item.assetType && Icon && (
          <span className={cx("inline-flex items-center gap-1", TYPE_STYLE[item.assetType].ink)}>
            <Icon aria-hidden="true" className="size-3.5" />
            {TYPE_LABELS[item.assetType]}
          </span>
        )}
        {item.draft && <DraftBadge />}
      </div>
      <h3 className="mt-1.5 font-semibold text-fg">
        {item.href ? (
          <Link href={item.href} className="hover:text-accent">
            {item.title}
          </Link>
        ) : (
          item.title
        )}
      </h3>
      {item.description && <p className="mt-1 text-sm leading-relaxed text-fg-muted">{item.description}</p>}
    </li>
  );
}

/** Life Log 타임라인. byYear 면 연도별로 묶는다 */
export function Timeline({ items, byYear = false }: { items: readonly TimelineItem[]; byYear?: boolean }) {
  if (!byYear) {
    return (
      <ol className="ml-1.5 border-l border-line">
        {items.map((item, i) => (
          <Item key={`${item.date}-${i}`} item={item} />
        ))}
      </ol>
    );
  }
  const years = [...new Set(items.map((i) => yearOf(i.date)))];
  return (
    <div className="space-y-14">
      {years.map((year) => (
        <section key={year} aria-labelledby={`year-${year}`} className="grid gap-6 sm:grid-cols-[8rem_1fr]">
          <h2 id={`year-${year}`} className="text-2xl font-bold tabular-nums text-fg sm:sticky sm:top-24 sm:self-start">
            {year}
          </h2>
          <ol className="ml-1.5 border-l border-line">
            {items
              .filter((i) => yearOf(i.date) === year)
              .map((item, i) => (
                <Item key={`${item.date}-${i}`} item={item} />
              ))}
          </ol>
        </section>
      ))}
    </div>
  );
}
