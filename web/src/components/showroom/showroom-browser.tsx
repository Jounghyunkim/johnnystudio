"use client";

import { Search, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";

import { assetHref } from "@/lib/hrefs";
import { type ServiceCard, type ShowroomEntry, type ShowroomMeta, serviceHref, showroomApi, showroomEntries } from "@/lib/showroom";
import { type StoreQuery, loadRemote, parseStoreQuery, toStoreSearch, useRemote } from "@/lib/store";
import type { OfficialShowroomService } from "@/lib/types";
import { useLocationSearch } from "@/lib/use-location-search";

import { type OfficialTarget, OfficialDeleteButton, OfficialDeleteDialog, useOfficialDelete } from "../store/official-delete";
import { Pill, ErrorBox, Loading } from "../store/store-ui";
import { cx } from "../ui";
import { OpenLink, ServiceIcon } from "./showroom-ui";

const cardClass =
  "group relative flex h-full gap-4 rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-raised has-[.card-link:focus-visible]:outline-2 has-[.card-link:focus-visible]:outline-offset-2 has-[.card-link:focus-visible]:outline-accent";
const openClass =
  "relative z-10 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-accent hover:bg-accent/10 light:hover:text-accent-hover";

/** onDeleteOfficial: 운영자에게만(개발 서버) 공식 서비스(Library 작품) 지우기 버튼 */
function Card({ entry, onDeleteOfficial }: { entry: ShowroomEntry; onDeleteOfficial?: (t: OfficialTarget) => void }) {
  const official = entry.kind === "official";
  // DB 의 서비스 중 운영자 계정이 소개한 것도 '공식'이다 (ADR-0014). 회원 링크(ugc)로 다루지 않는다
  const officialBadge = official || Boolean(entry.service.official);
  const name = official ? entry.service.title : entry.service.name;
  // 작품 파일에서 합친 공식 서비스(Showroom 으로 옮기지 않은 것)는 Library 상세, DB 의 서비스는 Showroom 서비스 화면
  const href = official ? assetHref({ slug: entry.service.slug }) : serviceHref(entry.service.code);
  const url = entry.service.url;
  const host = official ? new URL(url).host : entry.service.host;
  return (
    <article className={cardClass}>
      {official ? (
        <ServiceIcon src={entry.service.image} name={name} className="size-14 shrink-0" />
      ) : (
        <ServiceIcon code={entry.service.code} hasIcon={entry.service.has_icon} name={name} className="size-14 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="flex min-w-0 items-center gap-2 text-base font-semibold text-fg">
          {/* 카드 전체가 상세로 가는 링크. '열기'는 그 위에서 따로 눌린다 (z-10) */}
          <Link href={href} className="card-link truncate outline-none after:absolute after:inset-0 after:content-['']">
            {name}
          </Link>
          {officialBadge && <Pill tone="ok">공식</Pill>}
        </h3>
        <p className="truncate text-xs text-fg-subtle">
          {official ? "JohnnyStudio" : entry.service.publisher}
          {(official ? entry.categoryLabel : entry.service.category_label) && ` · ${official ? entry.categoryLabel : entry.service.category_label}`}
        </p>
        {entry.service.summary && <p className="line-clamp-2 text-sm leading-relaxed text-fg-muted">{entry.service.summary}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="truncate font-mono text-xs text-fg-subtle">{host}</p>
          <div className="flex shrink-0 items-center gap-1">
            <OpenLink href={url} name={name} ugc={!officialBadge} className={openClass} />
            {official && onDeleteOfficial && <OfficialDeleteButton target={{ slug: entry.service.slug, title: name }} onClick={onDeleteOfficial} />}
          </div>
        </div>
      </div>
    </article>
  );
}

/** Showroom 목록: Library 의 공식 웹 서비스(빌드 때 HTML 에 들어 있다) + 공개된 회원 서비스(API) */
export function ShowroomBrowser({ official }: { official: readonly OfficialShowroomService[] }) {
  const [search, setSearch] = useLocationSearch();
  const query = useMemo(() => parseStoreQuery(search), [search]);
  const canDeleteOfficial = useOfficialDelete();
  const [deleting, setDeleting] = useState<OfficialTarget | null>(null);
  const apiSearch = toStoreSearch(query);
  const key = `showroom:list:${apiSearch}`;
  const list = useRemote<{ services: ServiceCard[] }>(key);
  const meta = useRemote<ShowroomMeta>("showroom:meta");
  const searchId = useId();
  const sortId = useId();

  useEffect(() => {
    void loadRemote("showroom:meta", showroomApi.meta);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => void loadRemote(key, () => showroomApi.list(apiSearch)), 250);
    return () => clearTimeout(t);
  }, [key, apiSearch]);

  const update = (patch: Partial<StoreQuery>) => setSearch(toStoreSearch({ ...query, ...patch }));
  const categoryMap = meta?.status === "ready" ? meta.data.categories : null;
  const members = list?.status === "ready" ? list.data.services : null;
  const entries = useMemo(() => showroomEntries(official, members ?? [], query, categoryMap), [official, members, query, categoryMap]);
  const pending = !list || list.status === "loading";

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <label htmlFor={searchId} className="sr-only">
            서비스 검색
          </label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input
            id={searchId}
            type="search"
            value={query.q}
            onChange={(e) => update({ q: e.target.value })}
            placeholder="서비스 이름, 소개로 검색"
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
      </div>

      {categoryMap && (
        <div role="group" aria-label="분류로 거르기" className="mt-5 flex flex-wrap gap-2">
          {[["", "전체"], ...Object.entries(categoryMap)].map(([value, label]) => {
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
        {list?.status === "error" && <ErrorBox error={list.error} title="회원 서비스를 불러오지 못했습니다" />}
        {entries.length === 0 && pending ? (
          <Loading />
        ) : (
          <>
            <p aria-live="polite" className="text-sm text-fg-subtle">
              {entries.length}개의 서비스{pending && " · 회원 서비스를 불러오는 중…"}
            </p>
            {entries.length > 0 ? (
              <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {entries.map((e) => (
                  <li key={e.kind === "official" ? `o:${e.service.slug}` : `m:${e.service.code}`}>
                    <Card entry={e} onDeleteOfficial={canDeleteOfficial ? setDeleting : undefined} />
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-card border border-dashed border-line-strong px-6 py-16 text-center">
                <p className="font-semibold text-fg">{search ? "찾는 서비스가 없습니다" : "아직 소개된 서비스가 없습니다"}</p>
                <p className="mt-2 text-sm text-fg-muted">{search ? "다른 검색어를 쓰거나 분류를 풀어 보세요." : "직접 만든 웹 서비스가 있다면 소개해 주세요."}</p>
                {search && (
                  <button type="button" onClick={() => setSearch("")} className="mt-6 text-sm font-semibold text-accent hover:underline">
                    모든 서비스 보기
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
      {deleting && <OfficialDeleteDialog target={deleting} where="Showroom" onClose={() => setDeleting(null)} />}
    </div>
  );
}
