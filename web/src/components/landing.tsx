/**
 * 홈(랜딩) 페이지의 섹션들. 모두 서버 컴포넌트다 (상호작용은 FAQ 의 <details> 뿐이고 JS 가 필요 없다).
 * 문구는 content/profile.yaml 의 landing·principles·process 에서 온다.
 */
import { ArrowRight, ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";

import { ASSET_TYPES, type AssetType } from "@/lib/asset-types";
import { formatDate } from "@/lib/format";
import { TYPE_ACTIONS, TYPE_LABELS } from "@/lib/labels";
import type { Profile } from "@/lib/schema";
import { TYPE_STYLE } from "@/lib/type-style";
import type { AssetSummary } from "@/lib/types";

import { AssetCover } from "./asset-cover";
import { DraftBadge, StatusBadge, TypeBadge } from "./badges";
import { StarButton } from "./star-button";
import { ButtonLink, cx, ExternalButton } from "./ui";

type Landing = Profile["landing"];

/** 히어로 오른쪽: 다루는 작품 유형과 지금 공개된 개수. 작품이 있는 유형만 Library 필터로 이어진다 */
export function TypeBoard({ assets }: { assets: AssetSummary[] }) {
  const counts = new Map<AssetType, number>();
  for (const a of assets) counts.set(a.type, (counts.get(a.type) ?? 0) + 1);

  return (
    <div className="rounded-card border border-line bg-surface/80 p-2 shadow-2xl shadow-black/40 backdrop-blur-sm light:shadow-black/5">
      <p className="flex items-center justify-between px-3 pb-2 pt-3 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
        <span>다루는 작품</span>
        <span className="normal-case tracking-normal">유형 {ASSET_TYPES.length}가지</span>
      </p>
      <ul className="space-y-0.5">
        {ASSET_TYPES.map((type) => {
          const style = TYPE_STYLE[type];
          const Icon = style.icon;
          const n = counts.get(type) ?? 0;
          const body = (
            <>
              <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-lg bg-raised", style.ink)}>
                <Icon aria-hidden="true" className="size-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className={cx("block text-sm font-semibold", n > 0 ? "text-fg" : "text-fg-muted")}>{TYPE_LABELS[type]}</span>
                <span className="block text-xs leading-snug text-fg-subtle">{TYPE_ACTIONS[type]}</span>
              </span>
              {n > 0 ? (
                <span className="shrink-0 rounded-full bg-raised px-2 py-0.5 text-xs tabular-nums text-fg">
                  {n}
                  <span className="sr-only">개 공개</span>
                </span>
              ) : (
                <span className="shrink-0 text-xs text-fg-subtle">준비 중</span>
              )}
            </>
          );
          return (
            <li key={type}>
              {n > 0 ? (
                <Link href={`/library/?type=${type}`} className="flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-raised">
                  {body}
                </Link>
              ) : (
                <div className="flex items-center gap-3 px-3 py-2.5">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * 대표 작품이 하나뿐일 때의 넓은 카드 (3열 격자에 한 칸만 차면 비어 보인다).
 * 대표 이미지 · 설명 · 태그(누르면 Library 에서 그 태그로 검색) · 자세히 보기 · 바로 실행 · 즐겨찾기
 */
export function FeaturedSpotlight({ asset }: { asset: AssetSummary }) {
  const href = `/library/${asset.slug}/`;
  return (
    <article className="group grid overflow-hidden rounded-card border border-line bg-surface md:grid-cols-[1.1fr_1fr]">
      <AssetCover
        type={asset.type}
        cover={asset.cover}
        coverAlt={asset.coverAlt}
        fill
        className="aspect-[16/10] border-b border-line md:aspect-auto md:min-h-80 md:border-b-0 md:border-r"
      />
      <div className="flex flex-col gap-4 p-6 sm:p-10">
        <div className="flex flex-wrap items-center gap-2">
          <TypeBadge type={asset.type} />
          <StatusBadge status={asset.status} />
          {asset.draft && <DraftBadge />}
        </div>
        <h3 className="text-2xl font-bold tracking-tight text-fg sm:text-3xl">
          <Link href={href} className="hover:underline hover:underline-offset-4">
            {asset.title}
          </Link>
        </h3>
        <p className="leading-relaxed text-fg-muted">{asset.summary}</p>
        {asset.tags.length > 0 && (
          <ul aria-label="태그" className="flex flex-wrap gap-2">
            {asset.tags.slice(0, 6).map((tag) => (
              <li key={tag}>
                <Link
                  href={`/library/?q=${encodeURIComponent(`#${tag}`)}`}
                  className="inline-block rounded-full border border-line px-2.5 py-0.5 text-xs text-fg-muted hover:border-line-strong hover:text-fg"
                >
                  #{tag}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {asset.date && <p className="text-xs tabular-nums text-fg-subtle">{formatDate(asset.date)}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          <ButtonLink href={href}>
            자세히 보기
            <ArrowRight aria-hidden="true" className="size-4" />
          </ButtonLink>
          {asset.quickAction && (
            <ExternalButton href={asset.quickAction.href} variant="secondary">
              {asset.quickAction.label}
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ExternalButton>
          )}
          <StarButton slug={asset.slug} title={asset.title} withLabel />
        </div>
      </div>
    </article>
  );
}

/** 이렇게 쓰세요: 둘러보기 → 바로 쓰기 → 모아 두기 → 함께 일하기 */
export function Steps({ steps }: { steps: Landing["steps"] }) {
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {steps.map((s, i) => (
        <li key={s.title} className="flex flex-col rounded-card border border-line bg-surface p-6">
          <span aria-hidden="true" className="font-mono text-sm text-accent">
            {String(i + 1).padStart(2, "0")}
          </span>
          <h3 className="mt-3 text-lg font-semibold text-fg">{s.title}</h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-fg-muted">{s.text}</p>
          <Link href={s.href} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
            {s.action}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** 원칙 다섯 가지 + About 으로 가는 칸 (3열에서 마지막 줄을 채운다) */
export function Principles({ principles }: { principles: Profile["principles"] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {principles.map((p) => (
        <li key={p.title} className="rounded-card border border-line bg-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">{p.title}</p>
          <h3 className="mt-2 font-semibold text-fg">{p.titleKo}</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{p.summary}</p>
        </li>
      ))}
      <li>
        <Link
          href="/about/"
          className="flex h-full min-h-36 flex-col justify-between rounded-card border border-dashed border-line-strong p-6 transition-colors hover:border-fg-subtle hover:bg-surface"
        >
          <span className="text-sm text-fg-muted">원칙이 실제로 어떻게 지켜지는지, 운영 방식과 로드맵</span>
          <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent">
            About 보기 <ArrowRight aria-hidden="true" className="size-4" />
          </span>
        </Link>
      </li>
    </ul>
  );
}

/** 의뢰 진행: 요청 → 작업 → 검수 → 납품 (GitHub 개념과 짝) */
export function Process({ process }: { process: Profile["process"] }) {
  return (
    <ol className="grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      {process.map((p, i) => (
        <li key={p.title} className="bg-surface p-6">
          <div className="flex items-center justify-between gap-3">
            <span aria-hidden="true" className="font-mono text-sm text-accent">
              {i + 1}
            </span>
            <span className="rounded-full border border-line px-2 py-0.5 font-mono text-xs text-fg-subtle">{p.github}</span>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-fg">{p.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">{p.summary}</p>
        </li>
      ))}
    </ol>
  );
}

/** 자주 묻는 질문. <details> 라서 JS 없이 열리고, 키보드(Enter·Space)로도 열린다 */
export function Faq({ faq }: { faq: Landing["faq"] }) {
  return (
    <div className="grid items-start gap-3 md:grid-cols-2">
      {faq.map((f) => (
        <details key={f.q} className="group rounded-card border border-line bg-surface px-6 py-5 open:border-line-strong">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-4 font-semibold text-fg [&::-webkit-details-marker]:hidden">
            {f.q}
            <ChevronDown aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180" />
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">
            {f.a}
            {f.link && (
              <>
                {" "}
                <Link href={f.link.href} className="font-medium text-accent underline underline-offset-4">
                  {f.link.label}
                </Link>
              </>
            )}
          </p>
        </details>
      ))}
    </div>
  );
}
