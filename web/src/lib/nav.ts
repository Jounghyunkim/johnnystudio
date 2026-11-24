/**
 * 주 메뉴. 서버 컴포넌트(바닥글)와 클라이언트 컴포넌트(헤더) 양쪽에서 쓰므로 "use client" 파일에 두지 않는다.
 * ("use client" 파일에서 내보낸 값은 서버 쪽에서 실제 값이 아니라 참조로만 보인다)
 *
 * Library 는 묶음이다: 작품 전체(/library/) · Store(Windows 앱) · Showroom(웹 서비스). 주소는 각자 그대로 둔다 (ADR-0012).
 */
export type NavItem = {
  href: string;
  label: string;
  /** 펼침 메뉴에서 이름 아래에 보이는 한 줄 */
  description?: string;
  children?: readonly NavItem[];
};

export const NAV: readonly NavItem[] = [
  {
    href: "/library/",
    label: "Library",
    children: [
      { href: "/library/", label: "작품 전체", description: "JohnnyStudio가 만든 모든 작품" },
      { href: "/store/", label: "Store", description: "Windows 앱 내려받기 (공식 + 회원)" },
      { href: "/showroom/", label: "Showroom", description: "회원이 만든 웹 서비스 소개 (공식 + 회원)" },
    ],
  },
  { href: "/log/", label: "Life Log" },
  { href: "/work/", label: "Work with me" },
  { href: "/about/", label: "About" },
];

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** 현재 주소가 메뉴 항목(또는 그 하위)에 해당하는가 */
export function isActive(pathname: string, href: string): boolean {
  const p = trim(pathname);
  const h = trim(href);
  return p === h || p.startsWith(`${h}/`);
}

/** 묶음이면 하위 항목 중 하나라도 해당하는가 */
export function isItemActive(pathname: string, item: NavItem): boolean {
  return item.children ? item.children.some((c) => isActive(pathname, c.href)) : isActive(pathname, item.href);
}

/** 바닥글처럼 한 줄로 늘어놓을 때: 묶음은 그 이름(첫 항목 주소) + 나머지 하위 항목 */
export function flatNav(items: readonly NavItem[] = NAV): { href: string; label: string }[] {
  return items.flatMap((item) =>
    item.children
      ? [{ href: item.href, label: item.label }, ...item.children.filter((c) => c.href !== item.href).map(({ href, label }) => ({ href, label }))]
      : [{ href: item.href, label: item.label }],
  );
}
