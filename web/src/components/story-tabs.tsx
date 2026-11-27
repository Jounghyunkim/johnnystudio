"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef } from "react";

import type { NavGroup } from "@/lib/nav";

import { cx } from "./ui";

const tabClass = (active: boolean) =>
  cx(
    // 가로 스크롤 상자 안이라 바깥으로 그린 포커스 테두리는 잘린다 → 안쪽으로 그린다
    "inline-flex h-12 items-center gap-1 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors focus-visible:-outline-offset-2",
    active ? "border-accent text-fg" : "border-transparent text-fg-muted hover:border-line-strong hover:text-fg",
  );

/**
 * Story 아래 페이지의 탭 메뉴 (Library · Life Log · Blog · 영상 · 사진 · 글 · 하드웨어).
 * 머리글 아래 가로줄에 붙어 있고, 지금 페이지의 탭에 밑줄을 긋는다. 좁은 화면에서는 탭 줄만 옆으로 넘기고,
 * 처음 그릴 때 지금 탭이 보이도록 가운데로 옮긴다 (JS 가 없으면 왼쪽부터 보인다. 현재 위치는 위의 Breadcrumb 에도 있다)
 */
export function StoryTabs({ group, current }: { group: NavGroup; current: string }) {
  const ref = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const list = ref.current;
    const active = list?.querySelector<HTMLElement>("[aria-current='page']");
    if (!list || !active || list.scrollWidth <= list.clientWidth) return;
    list.scrollLeft = active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2;
  }, [current]);

  return (
    // -mb-px: 지금 탭의 밑줄이 머리글의 가로줄 위에 겹친다.
    // 좁은 화면은 탭 줄이 화면 끝까지 넘어가고(-mx-4), 넓은 화면은 첫 탭 글자가 제목 왼쪽 끝에 맞는다(탭 안쪽 여백 px-3 만큼 -mx-3)
    <nav aria-label={`${group.label} 메뉴`} className="-mb-px">
      <ul
        ref={ref}
        className="relative -mx-4 flex gap-1 overflow-x-auto px-1 [scrollbar-width:none] sm:-mx-3 sm:px-0 [&::-webkit-scrollbar]:hidden"
      >
        {group.items.map((item) => {
          const active = item.href === current;
          return (
            <li key={item.href} className="shrink-0">
              {item.external ? (
                <a href={item.href} target="_blank" rel="noopener noreferrer" className={tabClass(false)}>
                  {item.label}
                  <ArrowUpRight aria-hidden="true" className="size-3.5 text-fg-subtle" />
                  <span className="sr-only">(새 탭에서 열림)</span>
                </a>
              ) : (
                <Link href={item.href} aria-current={active ? "page" : undefined} className={tabClass(active)}>
                  {item.label}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
