/**
 * 주 메뉴. 서버 컴포넌트(바닥글)와 클라이언트 컴포넌트(헤더) 양쪽에서 쓰므로 "use client" 파일에 두지 않는다.
 * ("use client" 파일에서 내보낸 값은 서버 쪽에서 실제 값이 아니라 참조로만 보인다)
 *
 * 헤더: NAV(JohnnyStudio 의 것) | NAV_MEMBER(회원이 함께 올리는 곳: Store·Showroom). 사이에 구분선 "|" 를 둔다 (ADR-0012 결정 13).
 */
export type NavItem = { href: string; label: string };

export const NAV: readonly NavItem[] = [
  { href: "/library/", label: "Library" },
  { href: "/log/", label: "Life Log" },
  { href: "/work/", label: "Work with me" },
  { href: "/about/", label: "About" },
];

/** About 오른쪽, 구분선 뒤: 회원 앱(Store)과 회원 웹 서비스(Showroom) */
export const NAV_MEMBER: readonly NavItem[] = [
  { href: "/store/", label: "Store" },
  { href: "/showroom/", label: "Showroom" },
];

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** 현재 주소가 메뉴 항목(또는 그 하위)에 해당하는가 */
export function isActive(pathname: string, href: string): boolean {
  const p = trim(pathname);
  const h = trim(href);
  return p === h || p.startsWith(`${h}/`);
}

/** 바닥글처럼 한 줄로 늘어놓을 때 */
export function flatNav(): NavItem[] {
  return [...NAV, ...NAV_MEMBER];
}
