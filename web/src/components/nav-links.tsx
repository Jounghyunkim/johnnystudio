"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MouseEvent } from "react";

import { isActive, NAV, NAV_MEMBER, type NavItem } from "@/lib/nav";

import { cx } from "./ui";

/** 모바일 메뉴(<details>)에 들어 있으면 이동할 때 메뉴를 닫는다 */
function closeMenu(e: MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.closest("details")?.removeAttribute("open");
}

function Item({ item, pathname, vertical }: { item: NavItem; pathname: string; vertical: boolean }) {
  const active = isActive(pathname, item.href);
  return (
    <li>
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
}

/** 주 메뉴: Library · Life Log · Work with me · About | Store · Showroom */
export function NavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className={cx("flex", vertical ? "flex-col gap-1" : "items-center gap-1")}>
      {NAV.map((item) => (
        <Item key={item.href} item={item} pathname={pathname} vertical={vertical} />
      ))}
      {/* 구분선: 여기서부터는 회원이 함께 올리는 곳이다. 읽지 않는 꾸밈이다 */}
      {vertical ? (
        <li aria-hidden="true" className="mx-3.5 my-1 border-t border-line" />
      ) : (
        <li aria-hidden="true" className="select-none px-1 text-sm text-line-strong">
          |
        </li>
      )}
      {NAV_MEMBER.map((item) => (
        <Item key={item.href} item={item} pathname={pathname} vertical={vertical} />
      ))}
    </ul>
  );
}
