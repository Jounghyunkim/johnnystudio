"use client";

import { Star } from "lucide-react";

import { useBookmarks } from "@/lib/bookmarks";

import { cx } from "./ui";

/** 즐겨찾기 토글. 브라우저에만 저장된다 (My Studio) */
export function StarButton({ slug, title, withLabel = false }: { slug: string; title: string; withLabel?: boolean }) {
  const { has, toggle } = useBookmarks();
  const on = has(slug);
  return (
    <button
      type="button"
      onClick={() => toggle(slug)}
      aria-pressed={on}
      aria-label={withLabel ? undefined : `${title} 즐겨찾기`}
      title={on ? "즐겨찾기에서 빼기" : "즐겨찾기에 넣기 (My Studio)"}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-full transition-colors",
        withLabel ? "h-11 border border-line-strong bg-raised px-5 text-sm font-semibold text-fg hover:border-fg-subtle" : "size-9 hover:bg-raised",
        on ? "text-accent" : "text-fg-subtle hover:text-fg",
      )}
    >
      <Star aria-hidden="true" className={cx("size-4", on && "fill-accent")} />
      {withLabel && <span>{on ? "즐겨찾기 됨" : "즐겨찾기"}</span>}
    </button>
  );
}
