"use client";

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type MouseEvent, useEffect, useRef } from "react";

import { isActive, isItemActive, NAV, type NavItem } from "@/lib/nav";

import { cx } from "./ui";

/** 메뉴(<details>) 안에서 이동하면 메뉴를 닫는다 (펼침 메뉴와 모바일 메뉴 모두) */
function closeMenu(e: MouseEvent<HTMLAnchorElement>) {
  let el: HTMLElement | null = e.currentTarget;
  while ((el = el.parentElement?.closest("details") ?? null)) el.removeAttribute("open");
}

const itemClass = "block whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors";

/**
 * 넓은 화면의 펼침 메뉴 (Library ▾). JS 없이도 <details> 로 열린다.
 * 바깥을 누르거나 Esc 를 누르면 닫는다 (DOM 속성만 바꾼다. 상태를 두지 않는다).
 */
function Dropdown({ item, pathname }: { item: NavItem; pathname: string }) {
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onPointer = (e: PointerEvent) => {
      if (el.open && !el.contains(e.target as Node)) el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && el.open) {
        el.open = false;
        el.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  const active = isItemActive(pathname, item);
  return (
    <details ref={ref} className="group/nav relative">
      <summary
        className={cx(
          itemClass,
          "flex cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden",
          active ? "bg-raised text-fg" : "text-fg-muted hover:text-fg",
        )}
      >
        {item.label}
        <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open/nav:rotate-180" />
      </summary>
      <div className="absolute left-0 top-12 z-50 w-80 rounded-xl border border-line bg-surface p-2 shadow-2xl shadow-black/50 light:shadow-black/10">
        <ul className="flex flex-col gap-1">
          {item.children?.map((c) => {
            const current = isActive(pathname, c.href);
            return (
              <li key={c.href}>
                <Link
                  href={c.href}
                  onClick={closeMenu}
                  aria-current={current ? "page" : undefined}
                  className={cx("block rounded-lg px-3 py-2.5 transition-colors", current ? "bg-raised" : "hover:bg-raised")}
                >
                  <span className={cx("block text-sm font-semibold", current ? "text-fg" : "text-fg-muted")}>{c.label}</span>
                  {c.description && <span className="mt-0.5 block text-xs text-fg-subtle">{c.description}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </details>
  );
}

export function NavLinks({ vertical = false }: { vertical?: boolean }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className={cx("flex", vertical ? "flex-col gap-1" : "items-center gap-1")}>
      {NAV.map((item) => {
        if (item.children && !vertical) {
          return (
            <li key={item.href}>
              <Dropdown item={item} pathname={pathname} />
            </li>
          );
        }
        if (item.children) {
          // 모바일 메뉴: 묶음 이름 아래에 하위 항목을 들여 쓴다
          return (
            <li key={item.href}>
              <p className="px-3.5 pb-1 pt-2 text-xs font-semibold text-fg-subtle">{item.label}</p>
              <ul className="flex flex-col gap-1">
                {item.children.map((c) => {
                  const current = isActive(pathname, c.href);
                  return (
                    <li key={c.href}>
                      <Link
                        href={c.href}
                        onClick={closeMenu}
                        aria-current={current ? "page" : undefined}
                        className={cx(itemClass, "rounded-lg pl-6", current ? "bg-raised text-fg" : "text-fg-muted hover:text-fg")}
                      >
                        {c.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        }
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={closeMenu}
              aria-current={active ? "page" : undefined}
              className={cx(itemClass, active ? "bg-raised text-fg" : "text-fg-muted hover:text-fg", vertical && "rounded-lg")}
            >
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
