"use client";

import { CircleUserRound, LogIn } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

import { useSession } from "@/lib/auth";

import { cx } from "./ui";

const linkClass =
  "inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-full border border-line px-2.5 text-sm font-medium text-fg-muted transition-colors hover:border-line-strong hover:text-fg sm:gap-2 sm:px-3.5";

/**
 * 헤더의 로그인/계정 링크. 로그인 상태는 브라우저에서만 안다 (확인 전에는 '로그인'으로 보인다).
 * 로그인하면 이메일을 보여 준다. 헤더에 남는 폭만큼만 쓰고(min-w-0), 넘치면 끝을 … 로 줄인다. 전체 주소는 title 로 보인다.
 * 휴대폰 폭에서는 자리가 60px 남짓이라 @ 앞부분만 보여 주고, 전체 주소는 메뉴(☰) 맨 위에 둔다 (MenuAccount).
 */
export function AccountLink() {
  const session = useSession();
  if (session.status === "signed-in") {
    const { email } = session.user;
    const local = email.split("@", 1)[0];
    return (
      <Link
        href="/account/"
        className={cx(linkClass, "min-w-0 max-w-64")}
        title={`${email} · 계정 보기`}
        aria-label={`계정: ${email}`}
      >
        <CircleUserRound aria-hidden="true" className="size-4 shrink-0 text-accent" />
        <span className="min-w-0 truncate">
          <span className="sm:hidden">{local}</span>
          <span className="hidden sm:inline">{email}</span>
        </span>
      </Link>
    );
  }
  return (
    <Link href="/login/" className={cx(linkClass, "shrink-0")}>
      <LogIn aria-hidden="true" className="size-4" />
      <span className="hidden sm:inline">로그인</span>
      <span className="sr-only sm:hidden">로그인</span>
    </Link>
  );
}

/** 휴대폰 메뉴(☰) 맨 위: 로그인했으면 전체 이메일과 계정 링크, 아니면 로그인 링크 */
export function MenuAccount() {
  const session = useSession();
  const close = (e: MouseEvent<HTMLAnchorElement>) => e.currentTarget.closest("details")?.removeAttribute("open");
  if (session.status === "signed-in") {
    return (
      <Link href="/account/" onClick={close} className="mb-1 block rounded-lg border-b border-line px-3.5 pb-3 pt-2 hover:bg-raised">
        <span className="block text-xs text-fg-subtle">로그인한 계정</span>
        <span className="mt-0.5 block break-all text-sm font-medium text-fg">{session.user.email}</span>
      </Link>
    );
  }
  return (
    <Link href="/login/" onClick={close} className="mb-1 flex items-center gap-2 rounded-lg border-b border-line px-3.5 pb-3 pt-2 text-sm font-medium text-fg-muted hover:bg-raised hover:text-fg">
      <LogIn aria-hidden="true" className="size-4" />
      로그인 · 가입
    </Link>
  );
}
