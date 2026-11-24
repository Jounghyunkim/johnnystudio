"use client";

import { Search, Upload, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo } from "react";

import { formatBytes } from "@/lib/format";
import {
  appHref,
  loadRemote,
  parseStoreQuery,
  type StoreCard,
  type StoreMeta,
  type StoreQuery,
  storeApi,
  toStoreSearch,
  useRemote,
} from "@/lib/store";
import { useLocationSearch } from "@/lib/use-location-search";

import { ButtonLink, cx } from "../ui";
import { AppIcon, ErrorBox, Loading } from "./store-ui";

function Card({ app }: { app: StoreCard }) {
  return (
    <article className="group relative flex h-full gap-4 rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-raised has-[.card-link:focus-visible]:outline-2 has-[.card-link:focus-visible]:outline-offset-2 has-[.card-link:focus-visible]:outline-accent">
      <AppIcon code={app.code} hasIcon={app.has_icon} name={app.name} className="size-14 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="truncate text-base font-semibold text-fg">
          <Link href={appHref(app.code)} className="card-link outline-none after:absolute after:inset-0 after:content-['']">
            {app.name}
          </Link>
        </h3>
        <p className="truncate text-xs text-fg-subtle">
          {app.publisher} · {app.category_label}
        </p>
        {app.summary && <p className="line-clamp-2 text-sm leading-relaxed text-fg-muted">{app.summary}</p>}
        <p className="mt-auto pt-1 font-mono text-xs text-fg-subtle">
          v{app.version} · {formatBytes(app.size)}
        </p>
      </div>
    </article>
  );
}

/** 공개된 회원 앱 목록. 검색 상태는 주소(?q=&category=&sort=)에 남는다 */
export function StoreBrowser() {
  const [search, setSearch] = useLocationSearch();
  const query = useMemo(() => parseStoreQuery(search), [search]);
  const apiSearch = toStoreSearch(query);
  const key = `list:${apiSearch}`;
  const list = useRemote<{ apps: StoreCard[] }>(key);
  const meta = useRemote<StoreMeta>("meta");
  const searchId = useId();
  const sortId = useId();

  useEffect(() => {
    void loadRemote("meta", storeApi.meta);
  }, []);
  useEffect(() => {
    // 글자를 칠 때마다 부르지 않도록 잠깐 기다린다
    const t = setTimeout(() => void loadRemote(key, () => storeApi.list(apiSearch)), 250);
    return () => clearTimeout(t);
  }, [key, apiSearch]);

  const update = (patch: Partial<StoreQuery>) => setSearch(toStoreSearch({ ...query, ...patch }));
  const categories = meta?.status === "ready" ? Object.entries(meta.data.categories) : [];

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            앱 검색
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            id={searchId}
            type="search"
            value={query.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="앱 이름, 소개로 검색"
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
            onChange={(e) => update({ sort: e.target.value === "name" ? "name" : "new" })}
            className="h-10 rounded-full border border-line bg-surface px-4 text-sm text-fg focus:outline-none focus-visible:outline-2 focus-visible:outline-accent"
          >
            <option value="new">최신순</option>
            <option value="name">이름순</option>
          </select>
        </div>
        <ButtonLink href="/store/new/" variant="secondary">
          <Upload aria-hidden="true" className="size-4" />앱 올리기
        </ButtonLink>
      </div>

      {categories.length > 0 && (
        <div role="group" aria-label="분류로 거르기" className="mt-5 flex flex-wrap gap-2">
          {[["", "전체"], ...categories].map(([value, label]) => {
            const active = query.category === value;
            return (
              <button
                key={value || "all"}
                type="button"
                aria-pressed={active}
                onClick={() => update({ category: value })}
                className={cx(
                  "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition-colors",
                  active ? "border-accent bg-accent text-accent-ink" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        {!list || list.status === "loading" ? (
          <Loading />
        ) : list.status === "error" ? (
          <ErrorBox error={list.error} title="앱 목록을 불러오지 못했습니다" />
        ) : (
          <>
            <p aria-live="polite" className="mb-6 text-sm text-fg-subtle">
              {list.data.apps.length}개의 앱
            </p>
            {list.data.apps.length > 0 ? (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {list.data.apps.map((a) => (
                  <li key={a.code}>
                    <Card app={a} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-card border border-dashed border-line-strong px-6 py-16 text-center">
                <p className="font-semibold text-fg">{search ? "찾는 앱이 없습니다" : "아직 공개된 앱이 없습니다"}</p>
                <p className="mt-2 text-sm text-fg-muted">{search ? "다른 검색어를 쓰거나 분류를 풀어 보세요." : "직접 만든 Windows 프로그램이 있다면 첫 앱을 올려 주세요."}</p>
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="mt-6 text-sm font-semibold text-accent hover:underline">
                    모든 앱 보기
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
