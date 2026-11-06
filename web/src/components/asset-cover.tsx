import type { AssetType } from "@/lib/schema";
import { TYPE_STYLE } from "@/lib/type-style";

import { cx } from "./ui";

/**
 * 대표 이미지. 없으면 유형 아이콘을 은은한 배경 위에 그린다.
 * fill: 이미지가 자기 크기로 상자 높이를 늘리지 않고, 상자(가로세로 비율이나 옆 칸 높이로 정해진)를 채운다.
 */
export function AssetCover({
  type,
  cover,
  coverAlt,
  className,
  eager = false,
  fill = false,
}: {
  type: AssetType;
  cover?: string;
  coverAlt?: string;
  className?: string;
  eager?: boolean;
  fill?: boolean;
}) {
  const style = TYPE_STYLE[type];
  if (cover) {
    return (
      <div className={cx("overflow-hidden bg-canvas", fill && "relative", className)}>
        <img
          src={cover}
          alt={coverAlt ?? ""}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className={cx(
            "size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]",
            fill && "absolute inset-0",
          )}
        />
      </div>
    );
  }
  const Icon = style.icon;
  return (
    <div aria-hidden="true" className={cx("relative flex items-center justify-center overflow-hidden bg-canvas", className)}>
      <div className={cx("absolute inset-0 bg-gradient-to-br", style.placeholder)} />
      <Icon strokeWidth={1.25} className={cx("relative size-14 opacity-80", style.ink)} />
    </div>
  );
}
