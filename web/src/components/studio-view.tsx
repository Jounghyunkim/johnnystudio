"use client";

import { Star } from "lucide-react";

import { useBookmarks, useIsClient } from "@/lib/bookmarks";
import type { AssetSummary } from "@/lib/types";

import { AssetGrid } from "./asset-card";
import { ButtonLink } from "./ui";

/**
 * My Studio: 즐겨찾기한 작품 모아 보기. 목록은 이 브라우저에만 있다.
 * 최근에 넣은 것이 먼저 온다. 사라진 작품의 즐겨찾기는 조용히 건너뛴다.
 */
export function StudioView({ assets }: { assets: AssetSummary[] }) {
  const { slugs } = useBookmarks();
  const isClient = useIsClient();

  if (!isClient) {
    return <p className="text-sm text-fg-subtle">즐겨찾기를 불러오는 중입니다…</p>;
  }

  const bySlug = new Map(assets.map((a) => [a.slug, a]));
  const starred = [...slugs].reverse().flatMap((s) => bySlug.get(s) ?? []);

  if (starred.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-line-strong px-6 py-16 text-center">
        <Star aria-hidden="true" className="mx-auto size-8 text-fg-subtle" />
        <p className="mt-4 font-semibold text-fg">아직 즐겨찾기한 작품이 없습니다</p>
        <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
          Library의 카드에서 ☆ 를 누르면 여기에 모입니다. 로그인할 필요가 없습니다.
        </p>
        <ButtonLink href="/library/" className="mt-6">
          Library 둘러보기
        </ButtonLink>
      </div>
    );
  }

  return (
    <div>
      <p aria-live="polite" className="mb-6 text-sm text-fg-subtle">
        즐겨찾기 {starred.length}개
      </p>
      <AssetGrid assets={starred} />
    </div>
  );
}
