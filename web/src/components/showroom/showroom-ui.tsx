/**
 * Showroom 공통 조각 (클라이언트 컴포넌트끼리 쓴다). 색·상자 모양은 Store 의 store-ui 를 함께 쓴다.
 */
import { ArrowUpRight, Globe } from "lucide-react";

import { serviceIconSrc, UGC_REL } from "@/lib/showroom";

import { cx } from "../ui";

export function ServiceIcon({ code, hasIcon, name, version, src, className }: { code?: string; hasIcon?: boolean; name: string; version?: string | null; src?: string; className?: string }) {
  const url = src ?? (code && hasIcon ? serviceIconSrc(code, version) : undefined);
  if (url) return <img src={url} alt={`${name} 아이콘`} width={256} height={256} className={cx("rounded-2xl bg-raised object-contain", className)} />;
  return (
    <span className={cx("flex items-center justify-center rounded-2xl bg-raised text-fg-subtle", className)}>
      <Globe aria-hidden="true" className="size-1/2" />
    </span>
  );
}

/** 바깥 서비스 열기. 회원이 준 주소면 ugc=true (검색엔진에 추천하지 않는다) */
export function OpenLink({ href, name, ugc, className, children = "열기" }: { href: string; name: string; ugc: boolean; className?: string; children?: string }) {
  return (
    <a href={href} target="_blank" rel={ugc ? UGC_REL : "noopener noreferrer"} className={className}>
      {children}
      <ArrowUpRight aria-hidden="true" className="size-3.5" />
      <span className="sr-only">: {name} (새 탭에서 열림)</span>
    </a>
  );
}
