"use client";

import { Star } from "lucide-react";
import Link from "next/link";

import { useBookmarks, useIsClient } from "@/lib/bookmarks";

import { cx, HEADER_ICON, HEADER_PILL } from "./ui";

/**
 * 헤더의 My Studio 링크: ★ 아이콘, 즐겨찾기가 있으면 ★ 를 칠하고 바로 옆에 개수 (이름 'My Studio' 는 aria-label 과 title 로).
 * 개수는 브라우저에서 안다 (계정 목록이나 이 브라우저의 목록, 빌드된 HTML 에는 없다)
 */
export function StudioLink() {
  const { slugs } = useBookmarks();
  const isClient = useIsClient();
  const count = isClient ? slugs.length : 0;
  return (
    <Link
      href="/studio/"
      title={count ? `My Studio · 즐겨찾기 ${count}개` : "My Studio"}
      aria-label={count ? `My Studio (즐겨찾기 ${count}개)` : "My Studio"}
      className={cx("inline-flex", count > 0 ? cx(HEADER_PILL, "shrink-0") : HEADER_ICON)}
    >
      <Star aria-hidden="true" className={cx("size-4 shrink-0", count > 0 && "fill-accent")} />
      {count > 0 && <span className="tabular-nums">{count}</span>}
    </Link>
  );
}
