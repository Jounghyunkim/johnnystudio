/**
 * 주 메뉴. 서버 컴포넌트(바닥글)와 클라이언트 컴포넌트(헤더) 양쪽에서 쓰므로 "use client" 파일에 두지 않는다.
 * ("use client" 파일에서 내보낸 값은 서버 쪽에서 실제 값이 아니라 참조로만 보인다)
 */
export const NAV = [
  { href: "/library/", label: "Library" },
  { href: "/log/", label: "Life Log" },
  { href: "/work/", label: "Work with me" },
  { href: "/about/", label: "About" },
] as const;

const trim = (p: string) => (p.length > 1 ? p.replace(/\/+$/, "") : p);

/** 현재 주소가 메뉴 항목(또는 그 하위)에 해당하는가 */
export function isActive(pathname: string, href: string): boolean {
  const p = trim(pathname);
  const h = trim(href);
  return p === h || p.startsWith(`${h}/`);
}
