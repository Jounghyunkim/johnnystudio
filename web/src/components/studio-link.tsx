"use client";

import { Star } from "lucide-react";
import Link from "next/link";

import { useBookmarks, useIsClient } from "@/lib/bookmarks";

/** 헤더의 My Studio 링크. 즐겨찾기 개수는 브라우저에서만 안다 */
export function StudioLink() {
  const { slugs } = useBookmarks();
  const isClient = useIsClient();
  const count = isClient ? slugs.length : 0;
  return (
    <Link
      href="/studio/"
      className="inline-flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-line px-2.5 text-sm font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg sm:px-3.5"
    >
      <Star aria-hidden="true" className={count ? "size-4 fill-accent text-accent" : "size-4"} />
      {/* 글자는 휴대폰 폭과, 가운데 메뉴가 막 나타나 자리가 좁은 md 폭에서 숨긴다 (화면 읽기 프로그램에는 늘 읽힌다) */}
      <span className="sr-only sm:not-sr-only md:sr-only lg:not-sr-only">My Studio</span>
      {count > 0 && (
        <span className="rounded-full bg-raised px-1.5 text-xs tabular-nums text-fg">
          {count}
          <span className="sr-only">개 즐겨찾기</span>
        </span>
      )}
    </Link>
  );
}
