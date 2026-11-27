/**
 * 주 메뉴. 서버 컴포넌트(바닥글)와 클라이언트 컴포넌트(헤더) 양쪽에서 쓰므로 "use client" 파일에 두지 않는다.
 * ("use client" 파일에서 내보낸 값은 서버 쪽에서 실제 값이 아니라 참조로만 보인다)
 *
 * 헤더: Story ▾ · Work with me · About | Store · Showroom (2026-11-27 사용자 요청, ADR-0018).
 * Story ▾ 아래: Library · Life Log · Blog(바깥 블로그, 새 탭) · 영상 · 사진 · 글 · 하드웨어.
 * 구분선 "|" 뒤는 회원이 함께 올리는 곳이다 (ADR-0012 결정 13).
 * Blog 주소는 content/profile.yaml 의 blog 에서 온다 (없으면 메뉴에서 뺀다).
 */
import { TYPE_LABELS } from "./labels";
import { STORY_KINDS, storyHref } from "./story";

export type NavItem = { href: string; label: string; /** 바깥 사이트 (새 탭) */ external?: boolean };
export type NavGroup = { label: string; items: readonly NavItem[] };
export type NavEntry = NavItem | NavGroup;

export const isGroup = (e: NavEntry): e is NavGroup => "items" in e;

export function storyNav(blog?: string): NavGroup {
  return {
    label: "Story",
    items: [
      { href: "/library/", label: "Library" },
      { href: "/log/", label: "Life Log" },
      ...(blog ? [{ href: blog, label: "Blog", external: true }] : []),
      ...STORY_KINDS.map((k) => ({ href: storyHref(k), label: TYPE_LABELS[k.type] })),
    ],
  };
}

/** 구분선 앞: JohnnyStudio 의 것 */
export function mainNav(blog?: string): NavEntry[] {
  return [storyNav(blog), { href: "/work/", label: "Work with me" }, { href: "/about/", label: "About" }];
}

/** About 오른쪽, 구분선 뒤: 회원 앱(Store)과 회원 웹 서비스(Showroom) */
export const NAV_MEMBER: readonly NavItem[] = [
  { href: "/store/", label: "Store" },
  { href: "/showroom/", label: "Showroom" },
];

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** 현재 주소가 메뉴 항목(또는 그 하위)에 해당하는가. 바깥 주소는 켜지지 않는다 */
export function isActive(pathname: string, href: string): boolean {
  if (!href.startsWith("/")) return false;
  const p = trim(pathname);
  const h = trim(href);
  return p === h || p.startsWith(`${h}/`);
}

/** 묶음(Story) 안의 항목 중 하나가 현재 주소인가 */
export function isGroupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((i) => isActive(pathname, i.href));
}

/** 바닥글처럼 한 줄로 늘어놓을 때 (묶음은 풀어서) */
export function flatNav(blog?: string): NavItem[] {
  return [...mainNav(blog).flatMap((e) => (isGroup(e) ? e.items : [e])), ...NAV_MEMBER];
}
