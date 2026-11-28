"use client";

import { CircleUserRound, LogIn } from "lucide-react";
import Link from "next/link";
import type { MouseEvent } from "react";

import { useSession } from "@/lib/auth";
import { type StoreMe, useRemote, useStoreMe } from "@/lib/store";

import { cx, HEADER_ICON, HEADER_PILL } from "./ui";

/**
 * 헤더의 로그인/계정 링크 (2026-11-28 사용자 요청). 로그인 상태는 브라우저에서만 안다 (확인 전에는 '로그인'으로 보인다).
 * 로그인했으면 사람 아이콘 + 표시 이름(→ /account/), 아니면 로그인 아이콘만(→ /login/).
 * 표시 이름은 Store·Showroom 의 것 하나다 (/api/store/me). 정하지 않았거나 휴대폰 폭이면 아이콘만 보이고,
 * 폭이 모자라면 이름 끝을 … 로 줄인다 (헤더 오른쪽 묶음의 min-w-0). 이메일은 title·화면 읽기 프로그램과 휴대폰 메뉴(☰) 맨 위(MenuAccount)에 있다.
 */
export function AccountLink() {
  const session = useSession();
  const me = useStoreMe(session.status === "signed-in" ? session.user.id : null);
  if (session.status === "signed-in") {
    const { email } = session.user;
    const name = me?.status === "ready" ? me.data.publisher?.display_name : undefined;
    return (
      <Link
        href="/account/"
        title={`${name ? `${name} · ` : ""}${email} · 계정 보기`}
        aria-label={`계정 보기: ${name ? `${name} (${email})` : email}`}
        className={cx("inline-flex", name ? cx(HEADER_PILL, "min-w-0 max-sm:w-9 max-sm:px-0") : HEADER_ICON)}
      >
        <CircleUserRound aria-hidden="true" className="size-4 shrink-0" />
        {name && <span className="hidden min-w-0 max-w-40 truncate sm:block">{name}</span>}
      </Link>
    );
  }
  return (
    <Link href="/login/" title="로그인" className={cx("inline-flex", HEADER_ICON)}>
      <LogIn aria-hidden="true" className="size-4" />
      <span className="sr-only">로그인</span>
    </Link>
  );
}

/** 휴대폰 메뉴(☰) 맨 위: 로그인했으면 표시 이름·전체 이메일과 계정 링크, 아니면 로그인 링크. 표시 이름은 AccountLink 가 불러 둔 값을 읽는다 */
export function MenuAccount() {
  const session = useSession();
  const me = useRemote<StoreMe>(session.status === "signed-in" ? "me" : null);
  const name = me?.status === "ready" ? me.data.publisher?.display_name : undefined;
  const close = (e: MouseEvent<HTMLAnchorElement>) => e.currentTarget.closest("details")?.removeAttribute("open");
  if (session.status === "signed-in") {
    return (
      <Link href="/account/" onClick={close} className="mb-1 block rounded-lg border-b border-line px-3.5 pb-3 pt-2 hover:bg-raised">
        <span className="block text-xs text-fg-subtle">로그인한 계정</span>
        {name && <span className="mt-0.5 block break-all text-sm font-semibold text-fg">{name}</span>}
        <span className={cx("mt-0.5 block break-all text-sm", name ? "text-fg-muted" : "font-medium text-fg")}>{session.user.email}</span>
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
