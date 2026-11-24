/**
 * Store 화면 공통 조각 (클라이언트 컴포넌트끼리 쓴다). 색은 토큰과, 토큰이 없는 성공·경고색은 light: 짝을 단 팔레트만 쓴다.
 */
import { LoaderCircle, Package, ShieldAlert, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import type { ReactNode } from "react";

import type { ApiError } from "@/lib/auth";
import { type ScanStatus, SCAN_LABELS, type StoreRelease, iconSrc, localDate } from "@/lib/store";

import { cx } from "../ui";

export const panelClass = "rounded-card border border-line bg-surface p-5 sm:p-6";
export const inputClass =
  "w-full rounded-xl border border-line-strong bg-surface px-4 text-base text-fg placeholder:text-fg-subtle focus:border-fg-subtle focus:outline-none focus-visible:outline-2 focus-visible:outline-accent";
export const dialogClass =
  "m-auto w-[calc(100%-2rem)] max-w-lg rounded-card border border-line-strong bg-surface p-6 text-fg shadow-2xl shadow-black/60 light:shadow-black/15";

export type Tone = "neutral" | "ok" | "warn" | "danger";

const TONE: Record<Tone, string> = {
  neutral: "bg-raised text-fg-muted ring-line",
  ok: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/30 light:bg-emerald-50 light:text-emerald-800 light:ring-emerald-700/30",
  warn: "bg-amber-400/10 text-amber-300 ring-amber-400/30 light:bg-amber-50 light:text-amber-800 light:ring-amber-700/30",
  danger: "bg-danger/10 text-danger ring-danger/40",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset", TONE[tone])}>{children}</span>;
}

export function statusTone(status: string | undefined): Tone {
  if (status === "published") return "ok";
  if (status === "pending") return "warn";
  if (status === "rejected" || status === "hidden") return "danger";
  return "neutral";
}

/** 앱 아이콘 (없으면 상자 모양) */
export function AppIcon({ code, hasIcon, name, version, className }: { code: string; hasIcon: boolean; name: string; version?: string | null; className?: string }) {
  if (hasIcon) {
    return <img src={iconSrc(code, version)} alt={`${name} 아이콘`} width={256} height={256} className={cx("rounded-2xl bg-raised object-contain", className)} />;
  }
  return (
    <span className={cx("flex items-center justify-center rounded-2xl bg-raised text-fg-subtle", className)}>
      <Package aria-hidden="true" className="size-1/2" />
    </span>
  );
}

const SCAN_ICON: Record<ScanStatus, typeof ShieldCheck> = {
  queued: ShieldQuestion,
  scanning: ShieldQuestion,
  clean: ShieldCheck,
  infected: ShieldX,
  error: ShieldAlert,
  skipped: ShieldAlert,
};

// 검사를 실제로 끝낸 결과에만 검사한 날을 붙인다 (검사 안 함·대기에는 붙이지 않는다)
const DONE = new Set<ScanStatus>(["clean", "infected", "error"]);

function scanTone(s: ScanStatus): Tone {
  if (s === "clean") return "ok";
  if (s === "infected") return "danger";
  if (s === "error" || s === "skipped") return "warn";
  return "neutral";
}

/** 바이러스 검사 결과. 엔진·기준일을 함께 쓰고 '안전'을 보장한다고 쓰지 않는다 */
export function ScanBadge({ scan }: { scan: StoreRelease["scan"] }) {
  const Icon = SCAN_ICON[scan.status];
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Pill tone={scanTone(scan.status)}>
        <Icon aria-hidden="true" className="size-3.5" />
        {SCAN_LABELS[scan.status]}
      </Pill>
      {scan.engine && <span className="text-xs text-fg-subtle">{scan.engine}</span>}
      {scan.checked_at && DONE.has(scan.status) && <span className="text-xs text-fg-subtle">· {localDate(scan.checked_at)} 검사</span>}
    </span>
  );
}

export function Loading({ children = "불러오는 중입니다…" }: { children?: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-sm text-fg-subtle">
      <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
      {children}
    </p>
  );
}

export function ErrorBox({ error, title = "불러오지 못했습니다" }: { error: ApiError; title?: string }) {
  return (
    <div role="alert" className={panelClass}>
      <p className="font-semibold text-fg">{title}</p>
      <p className="mt-2 text-sm text-fg-muted">{error.message}</p>
    </div>
  );
}

/** 회원이 쓴 여러 줄 글. HTML 로 넣지 않고 글자로만 보여 준다 */
export function PlainText({ text, className }: { text: string; className?: string }) {
  return <div className={cx("whitespace-pre-line break-words leading-relaxed", className)}>{text}</div>;
}
