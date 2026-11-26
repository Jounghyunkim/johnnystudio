"use client";

import { Search, X } from "lucide-react";
import { useId, useMemo } from "react";

import { countByType, filterAssets, groupByType, type LibraryQuery, parseQuery, type TypeFilter, toSearch } from "@/lib/filter";
import { TYPE_LABELS } from "@/lib/labels";
import { ASSET_TYPES } from "@/lib/asset-types";
import type { AssetSummary } from "@/lib/types";
import { TYPE_STYLE } from "@/lib/type-style";
import { useLocationSearch } from "@/lib/use-location-search";

import { AssetGrid } from "./asset-card";
import { cx } from "./ui";

/**
 * Library 검색·필터. 빌드된 HTML 에는 모든 카드가 들어 있고(검색엔진·JS 꺼진 환경), 브라우저에서 거른다.
 * 검색 상태는 주소(?q=&type=&sort=)에 남아서 공유하거나 새로고침해도 유지된다.
 */
export function LibraryBrowser({ assets }: { assets: AssetSummary[] }) {
  const [search, setSearch] = useLocationSearch();
  const query = useMemo(() => parseQuery(search), [search]);
  const results = useMemo(() => filterAssets(assets, query), [assets, query]);
  const groups = useMemo(() => groupByType(results), [results]);
  const counts = useMemo(() => countByType(assets, query.q), [assets, query.q]);
  const searchId = useId();
  const sortId = useId();

  const update = (patch: Partial<LibraryQuery>) => setSearch(toSearch({ ...query, ...patch }));
  const types: TypeFilter[] = ["all", ...ASSET_TYPES.filter((t) => assets.some((a) => a.type === t))];

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            작품 검색
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            id={searchId}
            type="search"
            value={query.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="이름, 설명, 태그로 검색 (#태그)"
            className="h-12 w-full rounded-full border border-line bg-surface pl-11 pr-11 text-sm text-fg placeholder:text-fg-subtle focus:border-line-strong focus:outline-none focus-visible:outline-2 focus-visible:outline-accent [&::-webkit-search-cancel-button]:hidden"
          />
          {query.q && (
            <button
              type="button"
              onClick={() => update({ q: "" })}
              className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-fg-subtle hover:bg-raised hover:text-fg"
            >
              <X aria-hidden="true" className="size-4" />
              <span className="sr-only">검색어 지우기</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm text-fg-subtle">
            정렬
          </label>
          <select
            id={sortId}
            value={query.sort}
            onChange={(e) => update({ sort: e.target.value === "name" ? "name" : "recent" })}
            className="h-10 rounded-full border border-line bg-surface px-4 text-sm text-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="recent">최신순</option>
            <option value="name">이름순</option>
          </select>
        </div>
      </div>

      <div role="group" aria-label="유형으로 거르기" className="mt-5 flex flex-wrap gap-2">
        {types.map((t) => {
          const active = query.type === t;
          return (
            <button
              key={t}
              type="button"
              aria-pressed={active}
              onClick={() => update({ type: t })}
              className={cx(
                "inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-sm font-medium transition-colors",
                active ? "border-accent bg-accent text-accent-ink" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {t === "all" ? "전체" : TYPE_LABELS[t]}
              <span className={cx("tabular-nums", active ? "text-accent-ink/70 light:text-accent-ink" : "text-fg-subtle")}>{counts[t]}</span>
            </button>
          );
        })}
      </div>

      <p aria-live="polite" className="mb-6 mt-8 text-sm text-fg-subtle">
        {results.length}개의 작품
      </p>

      {results.length > 0 ? (
        // 유형(카테고리)마다 칸을 나누고, 칸 사이에 가로 점선 (2026-11-26 사용자 요청). 카드 제목은 칸 제목(h2) 아래라 h3
        <div>
          {groups.map((g, i) => {
            const { icon: Icon, ink } = TYPE_STYLE[g.type];
            return (
              <section key={g.type} aria-labelledby={`library-${g.type}`} className={cx(i > 0 && "mt-12 border-t border-dashed border-line-strong pt-10")}>
                <h2 id={`library-${g.type}`} className="mb-5 flex items-center gap-2 text-lg font-semibold tracking-tight text-fg">
                  <Icon aria-hidden="true" className={cx("size-5", ink)} />
                  {TYPE_LABELS[g.type]}
                  <span className="text-sm font-normal tabular-nums text-fg-subtle">{g.assets.length}</span>
                </h2>
                <AssetGrid assets={g.assets} columns={4} />
              </section>
            );
          })}
        </div>
      ) : (
        <div className="rounded-card border border-dashed border-line-strong px-6 py-16 text-center">
          <p className="font-semibold text-fg">찾는 작품이 없습니다</p>
          <p className="mt-2 text-sm text-fg-muted">다른 검색어를 쓰거나 유형 필터를 풀어 보세요.</p>
          <button type="button" onClick={() => setSearch("")} className="mt-6 text-sm font-semibold text-accent hover:underline">
            모든 작품 보기
          </button>
        </div>
      )}
    </div>
  );
}
