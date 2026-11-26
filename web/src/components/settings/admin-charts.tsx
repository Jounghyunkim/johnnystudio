"use client";

/*
 * 설정 > 전체 현황의 차트 (운영자). 값은 /api/site/admin/stats 의 trends 와 개수 (개수만, 회원 정보 없음).
 *
 * 규칙 (dataviz 지침): 한 줄짜리 값은 강조색 하나, 상태는 상태 색(globals.css --color-chart-*) + 이름·개수를 함께,
 * 막대는 24px 이하·끝만 4px 둥글게·바닥은 각지게, 막대 사이 2px, 격자는 1px 실선, 글자는 글자 토큰만 쓴다.
 * 위치·크기는 SVG 속성으로만 정한다 (CSP 가 style 속성을 막는다). 마우스·키보드 모두 같은 툴팁을 보이고, 표로도 볼 수 있다.
 */
import { type KeyboardEvent, type PointerEvent, useEffect, useId, useRef, useState } from "react";

import { columnPath, dayLabel, runningSum, ticks } from "@/lib/chart";
import type { SiteTrends } from "@/lib/site";

import { cx } from "../ui";

const n = (v: number) => v.toLocaleString("ko-KR");

/** 요소의 폭 (SVG 를 그 폭에 맞춰 그린다) */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry?.contentRect.width ?? 0)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

// ── 기간 고르기 (차트 위 한 줄) ──

export const RANGES = [30, 90] as const;
export type Range = (typeof RANGES)[number];

export function RangePicker({ value, onChange }: { value: Range; onChange: (r: Range) => void }) {
  return (
    <div role="group" aria-label="기간" className="inline-flex rounded-full border border-line p-0.5">
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          aria-pressed={value === r}
          onClick={() => onChange(r)}
          className={cx("h-8 rounded-full px-3 text-xs font-medium transition-colors", value === r ? "bg-raised text-fg" : "text-fg-subtle hover:text-fg")}
        >
          최근 {r}일
        </button>
      ))}
    </div>
  );
}

// ── 가입 추이: 하루에 한 막대 ──

export function SignupChart({ trends, range }: { trends: SiteTrends; range: Range }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const tableId = useId();
  const all = trends.signups;
  const data = all.slice(-range);
  // 누적: 기간 앞의 회원 + 그날까지 가입
  const start = trends.members_before + all.slice(0, all.length - data.length).reduce((a, d) => a + d.count, 0);
  const cumulative = runningSum(
    data.map((d) => d.count),
    start,
  );
  const total = data.reduce((a, d) => a + d.count, 0);
  const peak = data.reduce((best, d, i) => (d.count > data[best]!.count ? i : best), 0);
  const yTicks = ticks(Math.max(...data.map((d) => d.count), 0));
  const yMax = yTicks[yTicks.length - 1] || 1;

  const H = 200;
  const m = { top: 12, right: 8, bottom: 26, left: 34 };
  const W = Math.max(width, 280);
  const innerW = W - m.left - m.right;
  const innerH = H - m.top - m.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(24, Math.max(1.5, slot - 2));
  const y = (v: number) => m.top + innerH - (v / yMax) * innerH;
  const pick = (clientX: number, target: SVGSVGElement) => {
    const px = clientX - target.getBoundingClientRect().left - m.left;
    setActive(Math.min(data.length - 1, Math.max(0, Math.floor(px / slot))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(data.length - 1);
    else if (step) setActive((i) => Math.min(data.length - 1, Math.max(0, (i ?? data.length - 1) + step)));
    else return;
    e.preventDefault();
  };
  const xLabels = [0, Math.floor((data.length - 1) / 2), data.length - 1];
  const a = active === null ? null : data[active];
  const summary = `최근 ${range}일 동안 새 회원 ${n(total)}명${total ? `, 가장 많은 날은 ${dayLabel(data[peak]!.date)} ${n(data[peak]!.count)}명` : ""}. 지금 회원 ${n(cumulative[cumulative.length - 1] ?? 0)}명`;

  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-fg">가입 추이</span>
        <span className="text-xs text-fg-subtle">
          새 회원 {n(total)}명 · 하루 평균 {(total / range).toFixed(1)}명{total > 0 && ` · 가장 많은 날 ${dayLabel(data[peak]!.date)} (${n(data[peak]!.count)}명)`}
        </span>
      </figcaption>
      <div ref={ref} className="w-full">
        {width > 0 && (
          <svg
            width={W}
            height={H}
            role="img"
            aria-label={`${summary}. 화살표 키로 날짜를 옮겨 볼 수 있고, 아래 '표로 보기'에 모든 값이 있습니다.`}
            tabIndex={0}
            onPointerMove={(e: PointerEvent<SVGSVGElement>) => pick(e.clientX, e.currentTarget)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive((i) => i ?? data.length - 1)}
            onBlur={() => setActive(null)}
            onKeyDown={onKey}
            className="block touch-pan-y rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {yTicks.map((t) => (
              <g key={t}>
                <line x1={m.left} x2={W - m.right} y1={y(t)} y2={y(t)} className="stroke-line" strokeWidth={1} shapeRendering="crispEdges" />
                <text x={m.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-fg-subtle text-[11px] tabular-nums">
                  {n(t)}
                </text>
              </g>
            ))}
            {active !== null && <rect x={m.left + active * slot} y={m.top} width={slot} height={innerH} className="fill-fg/5" />}
            {data.map((d, i) => {
              if (!d.count) return null;
              const h = Math.max(2, innerH - (y(d.count) - m.top));
              return (
                <path key={d.date} d={columnPath(m.left + i * slot + (slot - barW) / 2, m.top + innerH - h, barW, h)} className={i === active ? "fill-accent-hover" : "fill-accent"} />
              );
            })}
            {xLabels.map((i, k) => (
              <text
                key={i}
                x={m.left + i * slot + slot / 2}
                y={H - 6}
                textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
                className="fill-fg-subtle text-[11px]"
              >
                {dayLabel(data[i]!.date)}
              </text>
            ))}
            {a && active !== null && (
              <Tooltip
                x={Math.min(W - m.right - 156, Math.max(m.left, m.left + active * slot + slot / 2 - 78))}
                y={Math.max(m.top, Math.min(y(a.count) - 54, m.top + innerH - 48))}
                value={`${n(a.count)}명`}
                label={`${dayLabel(a.date)} 가입 · 누적 ${n(cumulative[active]!)}명`}
              />
            )}
          </svg>
        )}
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-xs text-fg-subtle hover:text-fg" aria-controls={tableId}>
          표로 보기
        </summary>
        <div id={tableId} className="mt-2 max-h-64 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-raised text-fg-muted">
              <tr>
                <th className="px-3 py-2 font-medium">날짜 ({trends.timezone === "Asia/Seoul" ? "한국 시간" : trends.timezone})</th>
                <th className="px-3 py-2 text-right font-medium">새 회원</th>
                <th className="px-3 py-2 text-right font-medium">누적</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line tabular-nums text-fg">
              {data
                .map((d, i) => ({ ...d, cum: cumulative[i]! }))
                .reverse()
                .map((d) => (
                  <tr key={d.date}>
                    <td className="px-3 py-1.5">{d.date}</td>
                    <td className="px-3 py-1.5 text-right">{n(d.count)}</td>
                    <td className="px-3 py-1.5 text-right text-fg-muted">{n(d.cum)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

/** SVG 안의 툴팁: 값이 먼저(굵게), 이름이 뒤 */
function Tooltip({ x, y, value, label }: { x: number; y: number; value: string; label: string }) {
  return (
    <g transform={`translate(${x},${y})`} pointerEvents="none">
      <rect width={156} height={46} rx={8} className="fill-raised stroke-line-strong" strokeWidth={1} />
      <text x={10} y={19} className="fill-fg text-[13px] font-semibold tabular-nums">
        {value}
      </text>
      <text x={10} y={36} className="fill-fg-muted text-[11px]">
        {label}
      </text>
    </g>
  );
}

// ── 가로 막대 목록 (값은 막대 끝에 글자로) ──

export function BarRows({ title, note, rows, unit }: { title: string; note?: string; rows: { key: string; label: string; value: number }[]; unit: string }) {
  const max = Math.max(...rows.map((r) => r.value), 0);
  return (
    <figure className="space-y-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-fg">{title}</span>
        {note && <span className="text-xs text-fg-subtle">{note}</span>}
      </figcaption>
      {rows.length === 0 ? (
        <p className="text-sm text-fg-subtle">아직 없습니다.</p>
      ) : (
        <ul className="space-y-2.5">
          {rows.map((r) => {
            const pct = max ? (r.value / max) * 100 : 0;
            return (
              // 넓은 화면: 이름 | 막대 | 값. 좁은 화면(휴대폰): 이름 · 값 한 줄, 막대는 그 아래 (막대가 이름 칸에 눌려 짧아지지 않게)
              <li key={r.key} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto]">
                <span className="truncate text-fg-muted" title={r.label}>
                  {r.label}
                </span>
                {/* 끝만 둥글게: 둥근 왼쪽 모서리를 SVG 밖(x=-4)으로 밀어 바닥(왼쪽)이 각지게 보인다 */}
                <svg className="order-3 col-span-2 h-3 w-full sm:order-none sm:col-span-1" aria-hidden="true">
                  {r.value > 0 && <rect x={-4} y={0} height={12} width={`${Math.max(pct, 1)}%`} rx={4} className="fill-accent" />}
                </svg>
                <span className="min-w-[3.5rem] text-right font-semibold tabular-nums text-fg">
                  {n(r.value)}
                  <span className="ml-0.5 text-xs font-normal text-fg-subtle">{unit}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </figure>
  );
}

// ── 상태 나눔: 얇은 한 줄 막대 + 범례(이름·개수·비율) ──

const TONE_FILL = { good: "fill-chart-good", warn: "fill-chart-warn", bad: "fill-chart-bad", neutral: "fill-chart-neutral" } as const;
export type Tone = keyof typeof TONE_FILL;

export function StatusBar({ title, parts }: { title: string; parts: { key: string; label: string; value: number; tone: Tone }[] }) {
  const clip = `clip${useId().replace(/[^A-Za-z0-9_-]/g, "")}`; // url(#…) 에 쓸 수 있는 글자만
  const total = parts.reduce((a, p) => a + p.value, 0);
  const shown = parts.filter((p) => p.value > 0);
  const ends = runningSum(shown.map((p) => p.value));
  const segs = shown.map((p, i) => ({ ...p, x: (((ends[i] ?? 0) - p.value) / total) * 100, w: (p.value / total) * 100 }));
  const pct = (v: number) => (total ? Math.round((v / total) * 100) : 0);
  return (
    <figure className="space-y-2.5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <span className="text-sm font-semibold text-fg">{title}</span>
        <span className="text-xs text-fg-subtle">모두 {n(total)}개</span>
      </figcaption>
      <svg className="block h-2 w-full" role="img" aria-label={`${title}: ${parts.map((p) => `${p.label} ${n(p.value)}개`).join(", ")}`}>
        <defs>
          <clipPath id={clip}>
            <rect x={0} y={0} width="100%" height={8} rx={4} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${clip})`}>
          <rect x={0} y={0} width="100%" height={8} className="fill-raised" />
          {segs.map((s) => (
            <rect key={s.key} x={`${s.x}%`} y={0} width={`${s.w}%`} height={8} className={TONE_FILL[s.tone]}>
              <title>{`${s.label} ${n(s.value)}개 (${pct(s.value)}%)`}</title>
            </rect>
          ))}
          {/* 칸 사이 2px 틈 (바탕색) */}
          {segs.slice(1).map((s) => (
            <line key={s.key} x1={`${s.x}%`} x2={`${s.x}%`} y1={0} y2={8} strokeWidth={2} className="stroke-surface" />
          ))}
        </g>
      </svg>
      <ul className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-1.5">
            <svg className="size-2.5 shrink-0" aria-hidden="true">
              <rect width={10} height={10} rx={2} className={TONE_FILL[p.tone]} />
            </svg>
            <span className="text-fg-muted">{p.label}</span>
            <span className="font-semibold tabular-nums text-fg">{n(p.value)}</span>
            <span className="tabular-nums text-fg-subtle">{pct(p.value)}%</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
