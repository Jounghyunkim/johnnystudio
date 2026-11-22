import type { AssetType } from "@/lib/schema";
import { TYPE_STYLE } from "@/lib/type-style";

import { cx } from "./ui";

/**
 * 대표 이미지. 없으면 앱 아이콘(icon)을, 그것도 없으면 유형 아이콘을 은은한 배경 위에 그린다.
 * 앱 아이콘은 바로 옆에 이름이 있으므로 꾸밈 이미지(alt="")로 둔다.
 * fill: 이미지가 자기 크기로 상자 높이를 늘리지 않고, 상자(가로세로 비율이나 옆 칸 높이로 정해진)를 채운다.
 */
export function AssetCover({
  type,
  cover,
  coverAlt,
  icon,
  className,
  eager = false,
  fill = false,
}: {
  type: AssetType;
  cover?: string;
  coverAlt?: string;
  icon?: string;
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
      {icon ? (
        <img
          src={icon}
          alt=""
          width={256}
          height={256}
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          className="relative size-20 object-contain transition-transform duration-500 group-hover:scale-105 sm:size-24"
        />
      ) : (
        <Icon strokeWidth={1.25} className={cx("relative size-14 opacity-80", style.ink)} />
      )}
    </div>
  );
}
