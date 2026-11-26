/**
 * Store 카드 (Store 목록, My Studio). 클라이언트 컴포넌트끼리 쓴다.
 * 카드 전체가 상세 링크이고, 오른쪽 위 즐겨찾기(☆)와 오른쪽 아래 MS Store 는 그 위에 따로 눌린다.
 * 별을 아래 줄에 두면 좁은 카드에서 버전·크기가 두 줄로 밀려서 오른쪽 위에 둔다.
 */
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";

import { storeBookmarkId } from "@/lib/bookmarks";
import { formatBytes } from "@/lib/format";
import { type StoreCard, type StoreEntry, appHref } from "@/lib/store";
import type { OfficialStoreApp } from "@/lib/types";

import { MsStoreIcon } from "../ms-store-icon";
import { StarButton } from "../star-button";
import { type OfficialTarget, OfficialDeleteButton } from "./official-delete";
import { AppIcon, Pill } from "./store-ui";

export const cardClass =
  "group relative flex h-full gap-4 rounded-card border border-line bg-surface p-5 transition-colors hover:border-line-strong hover:bg-raised has-[.card-link:focus-visible]:outline-2 has-[.card-link:focus-visible]:outline-offset-2 has-[.card-link:focus-visible]:outline-accent";

/** 오른쪽 위 즐겨찾기. z-10: 카드 전체 링크 위에서 따로 눌리게 */
function CornerStar({ slug, title }: { slug: string; title: string }) {
  return (
    <div className="absolute right-2.5 top-2.5 z-10">
      <StarButton slug={slug} title={title} />
    </div>
  );
}

/** Library 의 공식 앱. 누르면 Library 상세로 간다. onDelete 가 있으면(운영자, 개발 서버) 작품 지우기 버튼 */
function OfficialCard({ app, categoryLabel, onDelete }: { app: OfficialStoreApp; categoryLabel: string; onDelete?: (t: OfficialTarget) => void }) {
  return (
    <article className={cardClass}>
      {app.image ? (
        <img src={app.image} alt={`${app.title} 아이콘`} width={256} height={256} className="size-14 shrink-0 rounded-2xl bg-raised object-contain" />
      ) : (
        <AppIcon code="none" hasIcon={false} name={app.title} className="size-14 shrink-0" />
      )}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="flex min-w-0 items-center gap-2 pr-7 text-base font-semibold text-fg">
          <Link href={`/library/${app.slug}/`} className="card-link truncate outline-none after:absolute after:inset-0 after:content-['']">
            {app.title}
          </Link>
          <Pill tone="ok">공식</Pill>
        </h3>
        <p className="truncate text-xs text-fg-subtle">JohnnyStudio{categoryLabel && ` · ${categoryLabel}`}</p>
        {app.summary && <p className="line-clamp-2 text-sm leading-relaxed text-fg-muted">{app.summary}</p>}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p className="min-w-0 truncate font-mono text-xs text-fg-subtle">
            v{app.version}
            {app.size !== undefined && ` · ${formatBytes(app.size)}`}
          </p>
          {/* z-10: 카드 전체 링크(Library 상세) 위에서 따로 눌리게 */}
          <div className="flex shrink-0 items-center gap-1">
            {app.microsoftStore && (
              <a
                href={app.microsoftStore}
                target="_blank"
                rel="noopener noreferrer"
                className="relative z-10 inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold text-accent hover:bg-accent/10 light:hover:text-accent-hover"
              >
                <MsStoreIcon />
                MS Store
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
                <span className="sr-only">: {app.title} (새 탭에서 열림)</span>
              </a>
            )}
            {onDelete && <OfficialDeleteButton target={{ slug: app.slug, title: app.title }} onClick={onDelete} />}
          </div>
        </div>
      </div>
      {/* Library 작품과 같은 즐겨찾기 (slug) */}
      <CornerStar slug={app.slug} title={app.title} />
    </article>
  );
}

/** onDeleteOfficial: Store 목록에서 운영자에게만 넘긴다 (My Studio 에는 없다) */
export function EntryCard({ entry, onDeleteOfficial }: { entry: StoreEntry; onDeleteOfficial?: (t: OfficialTarget) => void }) {
  return entry.kind === "official" ? (
    <OfficialCard app={entry.app} categoryLabel={entry.categoryLabel} onDelete={onDeleteOfficial} />
  ) : (
    <MemberCard app={entry.app} />
  );
}

/** DB 의 앱 카드 (Store 목록, My Studio). 운영자 계정이 올린 앱은 '공식' (ADR-0014) */
export function MemberCard({ app }: { app: StoreCard }) {
  return (
    <article className={cardClass}>
      <AppIcon code={app.code} hasIcon={app.has_icon} name={app.name} className="size-14 shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <h3 className="flex min-w-0 items-center gap-2 pr-7 text-base font-semibold text-fg">
          <Link href={appHref(app.code)} className="card-link truncate outline-none after:absolute after:inset-0 after:content-['']">
            {app.name}
          </Link>
          {app.official && <Pill tone="ok">공식</Pill>}
        </h3>
        <p className="truncate text-xs text-fg-subtle">
          {app.publisher} · {app.category_label}
        </p>
        {app.summary && <p className="line-clamp-2 text-sm leading-relaxed text-fg-muted">{app.summary}</p>}
        <p className="mt-auto pt-1 font-mono text-xs text-fg-subtle">
          v{app.version} · {formatBytes(app.size)}
        </p>
      </div>
      <CornerStar slug={storeBookmarkId(app.code)} title={app.name} />
    </article>
  );
}
