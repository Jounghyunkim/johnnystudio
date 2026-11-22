"use client";

/**
 * 작품 관리 목록: 현황 숫자, 거르기·검색·정렬, 작품 줄. 줄마다 검사 결과와 바로 할 일(편집·미리보기)을 보여 준다.
 */
import { ArrowUpRight, CircleAlert, CircleCheck, PencilLine, Search, TriangleAlert } from "lucide-react";
import { useId, useMemo, useState } from "react";

import type { AdminAssetRow, AdminState } from "@/lib/admin/types";
import { TYPE_STYLE } from "@/lib/type-style";

import { DraftBadge, StatusBadge, TypeBadge } from "../badges";
import { cx } from "../ui";
import { inputClass } from "./controls";

type Filter = "all" | "published" | "draft" | "ready" | "attention" | "sample";

const ready = (a: AdminAssetRow) => a.draft && !a.sample && !a.errors.length && !a.missing.length;
const attention = (a: AdminAssetRow) => !a.sample && (a.errors.length > 0 || a.missing.length > 0);

const FILTERS: Array<{ key: Filter; label: string; test: (a: AdminAssetRow) => boolean }> = [
  { key: "all", label: "전체", test: () => true },
  { key: "published", label: "공개", test: (a) => !a.draft },
  { key: "draft", label: "초안", test: (a) => a.draft && !a.sample },
  { key: "ready", label: "공개할 수 있음", test: ready },
  { key: "attention", label: "채울 것 있음", test: attention },
  { key: "sample", label: "샘플", test: (a) => a.sample },
];

function Verdict({ a }: { a: AdminAssetRow }) {
  if (a.errors.length) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-danger">
        <CircleAlert aria-hidden="true" className="size-4" />
        문제 {a.errors.length}개
      </span>
    );
  }
  if (a.missing.length) {
    return (
      <span className="inline-flex items-center gap-1.5 text-sm text-fg-muted">
        <TriangleAlert aria-hidden="true" className="size-4" />
        {a.sample ? "샘플 (공개 불가)" : `채울 것 ${a.missing.length}개`}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-accent">
      <CircleCheck aria-hidden="true" className="size-4" />
      {a.draft ? "공개할 수 있음" : "출시 기준 충족"}
    </span>
  );
}

export function AssetList({ state, onEdit }: { state: AdminState; onEdit: (slug: string) => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recent" | "name">("recent");
  const searchId = useId();
  const sortId = useId();
  const { assets } = state;

  const counts = useMemo(() => Object.fromEntries(FILTERS.map((f) => [f.key, assets.filter(f.test).length])) as Record<Filter, number>, [assets]);
  const rows = useMemo(() => {
    const test = FILTERS.find((f) => f.key === filter)!.test;
    const needle = q.trim().toLowerCase().replace(/^#/, "");
    const found = assets.filter(
      (a) => test(a) && (!needle || a.title.toLowerCase().includes(needle) || a.slug.includes(needle) || a.tags.some((t) => t.toLowerCase().includes(needle))),
    );
    return sort === "name" ? [...found].sort((x, y) => x.title.localeCompare(y.title, "ko")) : found;
  }, [assets, filter, q, sort]);

  const stats: Array<{ label: string; value: number; filter: Filter }> = [
    { label: "전체", value: counts.all, filter: "all" },
    { label: "공개", value: counts.published, filter: "published" },
    { label: "초안", value: counts.draft, filter: "draft" },
    { label: "공개할 수 있음", value: counts.ready, filter: "ready" },
    { label: "채울 것 있음", value: counts.attention, filter: "attention" },
  ];

  return (
    <div className="grid gap-8">
      <ul aria-label="현황" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {stats.map((s) => (
          <li key={s.label}>
            <button
              type="button"
              onClick={() => setFilter(s.filter)}
              aria-pressed={filter === s.filter}
              className={cx(
                "w-full rounded-card border bg-surface p-4 text-left transition-colors",
                filter === s.filter ? "border-accent" : "border-line hover:border-line-strong",
              )}
            >
              <span className="block text-2xl font-bold tabular-nums text-fg">{s.value}</span>
              <span className="mt-1 block text-xs text-fg-muted">{s.label}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="grid gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <label htmlFor={searchId} className="sr-only">
              작품 찾기
            </label>
            <Search aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
            <input id={searchId} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름, slug, 태그" className={cx(inputClass, "h-10 pl-10")} />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor={sortId} className="text-sm text-fg-subtle">
              정렬
            </label>
            <select id={sortId} value={sort} onChange={(e) => setSort(e.target.value === "name" ? "name" : "recent")} className={cx(inputClass, "h-10 w-auto")}>
              <option value="recent">최근 수정</option>
              <option value="name">이름</option>
            </select>
          </div>
        </div>
        <div role="group" aria-label="상태로 거르기" className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              aria-pressed={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cx(
                "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors",
                filter === f.key ? "border-accent bg-accent text-accent-ink" : "border-line text-fg-muted hover:border-line-strong hover:text-fg",
              )}
            >
              {f.label}
              <span className={cx("tabular-nums", filter === f.key ? "text-accent-ink/70 light:text-accent-ink" : "text-fg-subtle")}>{counts[f.key]}</span>
            </button>
          ))}
        </div>
      </div>

      <p aria-live="polite" className="-mb-4 text-sm text-fg-subtle">
        {rows.length}개
      </p>

      {rows.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong px-6 py-14 text-center text-sm text-fg-muted">조건에 맞는 작품이 없습니다.</div>
      ) : (
        <ul className="grid gap-3">
          {rows.map((a) => {
            const Icon = a.type ? TYPE_STYLE[a.type].icon : CircleAlert;
            return (
              <li key={a.slug} className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4 sm:flex-row sm:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-4">
                  <div className="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-canvas">
                    {a.cover ? (
                      <img src={a.cover} alt="" loading="lazy" className="size-full object-cover" />
                    ) : (
                      <Icon aria-hidden="true" className={cx("size-6", a.type ? TYPE_STYLE[a.type].ink : "text-danger")} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-fg">{a.title}</p>
                    <p className="truncate font-mono text-xs text-fg-subtle">{a.slug}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {a.type && <TypeBadge type={a.type} />}
                      {a.status && <StatusBadge status={a.status} />}
                      {a.draft ? <DraftBadge /> : <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">공개</span>}
                      {a.featured && <span className="text-xs text-fg-subtle">· 대표 작품</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:justify-end">
                  <Verdict a={a} />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onEdit(a.slug)}
                      className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong px-3.5 text-sm font-semibold text-fg hover:border-fg-subtle"
                    >
                      <PencilLine aria-hidden="true" className="size-4" />
                      편집<span className="sr-only">: {a.title}</span>
                    </button>
                    <a
                      href={`/library/${a.slug}/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-9 items-center justify-center rounded-full text-fg-subtle hover:bg-raised hover:text-fg"
                    >
                      <ArrowUpRight aria-hidden="true" className="size-4" />
                      <span className="sr-only">{a.title} 미리보기 (새 탭에서 열림)</span>
                    </a>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-fg-subtle">
        다운로드 파일 보관 위치: <code className="break-all font-mono">{state.files.dir}</code>{" "}
        {state.files.production ? "(운영 다운로드 폴더: 배포하면 바로 내려받을 수 있습니다)" : "(이 컴퓨터의 임시 보관. 올린 뒤 나오는 명령으로 서버에 복사합니다)"}
      </p>
    </div>
  );
}
