import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";
import type { AssetStatus, AssetType } from "@/lib/schema";
import { STATUS_DOT, TYPE_STYLE } from "@/lib/type-style";

import { cx } from "./ui";

const pill = "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset";

export function TypeBadge({ type }: { type: AssetType }) {
  const { icon: Icon, badge } = TYPE_STYLE[type];
  return (
    <span className={cx(pill, badge)}>
      <Icon aria-hidden="true" className="size-3.5" />
      {TYPE_LABELS[type]}
    </span>
  );
}

export function StatusBadge({ status }: { status: AssetStatus }) {
  return (
    <span className={cx(pill, "bg-raised text-fg-muted ring-line")}>
      <span aria-hidden="true" className={cx("size-1.5 rounded-full", STATUS_DOT[status])} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** 개발 미리보기에서만 보이는 초안 표시 */
export function DraftBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-dashed border-line-strong px-2.5 py-0.5 text-xs font-medium text-fg-subtle">
      초안
    </span>
  );
}
