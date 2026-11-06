import { Menu } from "lucide-react";
import Link from "next/link";

import { AccountLink, MenuAccount } from "./account-link";
import { LogoMark } from "./logo-mark";
import { NavLinks } from "./nav-links";
import { StudioLink } from "./studio-link";
import { MenuThemeToggle, ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-page items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight text-fg">
          <LogoMark />
          <span>JohnnyStudio</span>
        </Link>

        <nav aria-label="주 메뉴" className="ml-4 hidden shrink-0 md:block">
          <NavLinks />
        </nav>

        {/* min-w-0: 폭이 모자라면 이 묶음이 줄어든다. 줄어드는 것은 로그인한 이메일뿐이다 (나머지는 shrink-0) */}
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          {/* 테마 버튼은 넓은 화면에서만 (좁은 화면은 메뉴 안과 바닥글에 있다) */}
          <ThemeToggle className="hidden lg:inline-flex" />
          <StudioLink />
          <AccountLink />
          {/* 모바일 메뉴: JS 없이도 열린다 */}
          <details className="relative shrink-0 md:hidden">
            <summary className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full border border-line text-fg-muted hover:text-fg [&::-webkit-details-marker]:hidden">
              <Menu aria-hidden="true" className="size-4" />
              <span className="sr-only">메뉴</span>
            </summary>
            <nav
              aria-label="주 메뉴"
              className="absolute right-0 top-12 w-64 rounded-xl border border-line bg-surface p-2 shadow-2xl shadow-black/50 light:shadow-black/10"
            >
              <MenuAccount />
              <NavLinks vertical />
              <MenuThemeToggle />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
