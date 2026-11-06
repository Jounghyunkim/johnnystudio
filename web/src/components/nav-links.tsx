"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

import { isActive, NAV } from "@/lib/nav";

import { cx } from "./ui";

/** 모바일 메뉴(<details>)에 들어 있으면 이동할 때 메뉴를 닫는다 */
function closeMenu(e: MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.closest("details")?.removeAttribute("open");
}

export function NavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className={cx("flex", vertical ? "flex-col gap-1" : "items-center gap-1")}>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={closeMenu}
              aria-current={active ? "page" : undefined}
              className={cx(
                "block whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
                active ? "bg-raised text-fg" : "text-fg-muted hover:text-fg",
                vertical && "rounded-lg",
              )}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
