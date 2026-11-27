"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type MouseEvent, useEffect, useRef } from "react";

import { isActive, isGroup, isGroupActive, mainNav, NAV_MEMBER, type NavGroup, type NavItem } from "@/lib/nav";

import { cx } from "./ui";

/** 메뉴(<details>: Story ▾, 모바일 메뉴)에 들어 있으면 이동할 때 메뉴를 닫는다 */
function closeMenu(e: MouseEvent<HTMLAnchorElement>) {
  e.currentTarget.closest("details")?.removeAttribute("open");
}

const itemClass = (active: boolean, vertical: boolean) =>
  cx(
    "flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-2 text-sm font-medium transition-colors",
    active ? "bg-raised text-fg" : "text-fg-muted hover:text-fg",
    vertical && "rounded-lg",
  );

function Item({ item, pathname, vertical }: { item: NavItem; pathname: string; vertical: boolean }) {
  if (item.external) {
    return (
      <li>
        <a href={item.href} target="_blank" rel="noopener noreferrer" onClick={closeMenu} className={itemClass(false, vertical)}>
          {item.label}
          <ArrowUpRight aria-hidden="true" className="size-3.5 text-fg-subtle" />
          <span className="sr-only">(새 탭에서 열림)</span>
        </a>
      </li>
    );
  }
  const active = isActive(pathname, item.href);
  return (
    <li>
      <Link href={item.href} onClick={closeMenu} aria-current={active ? "page" : undefined} className={itemClass(active, vertical)}>
        {item.label}
      </Link>
    </li>
  );
}

/**
 * 넓은 화면의 묶음 메뉴 (Story ▾). <details> 라서 JS 없이도 열린다.
 * 바깥을 누르거나 포커스가 밖으로 나가거나 Esc 를 누르면 닫는다 (Esc 는 'Story' 로 포커스를 돌린다)
 */
function Dropdown({ group, pathname }: { group: NavGroup; pathname: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const details = ref.current;
    if (!details) return;
    const outside = (e: Event) => {
      if (details.open && e.target instanceof Node && !details.contains(e.target)) details.open = false;
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || !details.open) return;
      details.open = false;
      details.querySelector("summary")?.focus();
    };
    const blur = (e: FocusEvent) => {
      if (details.open && !(e.relatedTarget instanceof Node && details.contains(e.relatedTarget))) details.open = false;
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    details.addEventListener("focusout", blur);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
      details.removeEventListener("focusout", blur);
    };
  }, []);
  const active = isGroupActive(pathname, group);
  return (
    <li className="relative">
      <details ref={ref} className="group">
        <summary className={cx(itemClass(active, false), "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
          {group.label}
          <ChevronDown aria-hidden="true" className="size-3.5 transition-transform group-open:rotate-180" />
        </summary>
        <ul
          aria-label={group.label}
          className="absolute left-0 top-full z-50 mt-2 w-52 space-y-0.5 rounded-xl border border-line bg-surface p-1.5 shadow-2xl shadow-black/50 light:shadow-black/10"
        >
          {group.items.map((item) => (
            <Item key={item.href} item={item} pathname={pathname} vertical />
          ))}
        </ul>
      </details>
    </li>
  );
}

/** 모바일 메뉴 안의 묶음: 이름 아래에 항목을 들여 늘어놓는다 (메뉴가 이미 펼쳐져 있으므로 한 번 더 접지 않는다) */
function Group({ group, pathname }: { group: NavGroup; pathname: string }) {
  return (
    <li>
      <p className="px-3.5 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">{group.label}</p>
      <ul aria-label={group.label} className="ml-3.5 space-y-0.5 border-l border-line pl-1.5">
        {group.items.map((item) => (
          <Item key={item.href} item={item} pathname={pathname} vertical />
        ))}
      </ul>
    </li>
  );
}

/** 주 메뉴: Story ▾ · Work with me · About | Store · Showroom. blog: Story ▾ 의 Blog 주소 (profile.yaml) */
export function NavLinks({ vertical = false, blog }: { vertical?: boolean; blog?: string }) {
  const pathname = usePathname() ?? "/";
  return (
    <ul className={cx("flex", vertical ? "flex-col gap-1" : "items-center gap-1")}>
      {mainNav(blog).map((entry) =>
        isGroup(entry) ? (
          vertical ? (
            <Group key={entry.label} group={entry} pathname={pathname} />
          ) : (
            <Dropdown key={entry.label} group={entry} pathname={pathname} />
          )
        ) : (
          <Item key={entry.href} item={entry} pathname={pathname} vertical={vertical} />
        ),
      )}
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
