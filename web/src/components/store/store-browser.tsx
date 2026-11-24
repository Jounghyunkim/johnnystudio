"use client";

import { ArrowUpRight, Search, Upload, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo } from "react";

import { formatBytes } from "@/lib/format";
import {
  appHref,
  loadRemote,
  parseStoreQuery,
  type StoreCard,
  type StoreEntry,
  type StoreMeta,
  type StoreQuery,
  storeApi,
  storeEntries,
  toStoreSearch,
  useRemote,
} from "@/lib/store";
import type { OfficialStoreApp } from "@/lib/types";
import { useLocationSearch } from "@/lib/use-location-search";

import { ButtonLink, cx } from "../ui";
import { ReviewLink } from "./review-link";
import { AppIcon, ErrorBox, Loading, Pill } from "./store-ui";

const cardClass =
  "group relative flex h-full gap-4 rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-raised has-[.card-link:focus-visible]:outline-2 has-[.card-link:focus-visible]:outline-offset-2 has-[.card-link:focus-visible]:outline-accent";

/** Library 의 공식 앱. 누르면 Library 상세로 간다 */
function OfficialCard({ app, categoryLabel }: { app: OfficialStoreApp; categoryLabel: string }) {
  return (
    <article className={cardClass}>
      {app.image ? (
        <img src={app.image} alt={`${app.title} 아이콘`} width={256} height={256} className="size-14 shrink-0 rounded-2xl bg-raised object-contain" />
      ) : (
        <AppIcon code="none" hasIcon={false} name={app.title} className="size-14 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold text-fg">
          <Link href={`/library/${app.slug}/`} className="card-link truncate outline-none after:absolute after:inset-0 after:content-['']">
            {app.title}
          </Link>
          <Pill tone="ok">공식</Pill>
        </h3>
        <p className="truncate text-xs text-fg-subtle">JohnnyStudio{categoryLabel && ` · ${categoryLabel}`}</p>
        {app.summary && <p className="line-clamp-2 text-sm leading-relaxed text-fg-muted">{app.summary}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="font-mono text-xs text-fg-subtle">
            v{app.version}
            {app.size !== undefined && ` · ${formatBytes(app.size)}`}
          </p>
          {/* z-10: 카드 전체 링크(Library 상세) 위에서 따로 눌리게 */}
          {app.microsoftStore && (
            <a
              href={app.microsoftStore}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-accent hover:bg-accent/10 light:hover:text-accent-hover"
            >
              MS Store
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
              <span className="sr-only">: {app.title} (새 탭에서 열림)</span>
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function EntryCard({ entry }: { entry: StoreEntry }) {
  return entry.kind === "official" ? <OfficialCard app={entry.app} categoryLabel={entry.categoryLabel} /> : <Card app={entry.app} />;
}

function Card({ app }: { app: StoreCard }) {
  return (
    <article className={cardClass}>
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

/**
 * Store 목록: Library 의 공식 앱(빌드 때 넘겨받아 HTML 에 들어 있다) + 공개된 회원 앱(API).
 * 검색 상태는 주소(?q=&category=&sort=)에 남는다
 */
export function StoreBrowser({ official }: { official: readonly OfficialStoreApp[] }) {
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
  const categoryMap = meta?.status === "ready" ? meta.data.categories : null;
  const categories = categoryMap ? Object.entries(categoryMap) : [];
  const members = list?.status === "ready" ? list.data.apps : null;
  const entries = useMemo(() => storeEntries(official, members ?? [], query, categoryMap), [official, members, query, categoryMap]);
  const membersPending = !list || list.status === "loading";

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
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/store/new/" variant="secondary">
            <Upload aria-hidden="true" className="size-4" />앱 올리기
          </ButtonLink>
          <ReviewLink />
        </div>
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

      <div className="mt-8 space-y-6">
        {list?.status === "error" && <ErrorBox error={list.error} title="회원 앱을 불러오지 못했습니다" />}
        {entries.length === 0 && membersPending ? (
          <Loading />
        ) : (
          <>
            <p aria-live="polite" className="text-sm text-fg-subtle">
              {entries.length}개의 앱{membersPending && " · 회원 앱을 불러오는 중…"}
            </p>
            {entries.length > 0 ? (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((e) => (
                  <li key={e.kind === "official" ? `o:${e.app.slug}` : `m:${e.app.code}`}>
                    <EntryCard entry={e} />
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
