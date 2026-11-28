import { Menu, Settings } from "lucide-react";
import Link from "next/link";

import { getProfile } from "@/lib/content";

import { AccountLink, MenuAccount } from "./account-link";
import { LogoMark } from "./logo-mark";
import { NavLinks } from "./nav-links";
import { StudioLink } from "./studio-link";
import { MenuThemeToggle, ThemeToggle } from "./theme-toggle";
import { cx, HEADER_ICON } from "./ui";

export function SiteHeader() {
  // Story ▾ 의 Blog (바깥 블로그). 빌드할 때 profile.yaml 에서 읽는다
  const blog = getProfile().blog;
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-canvas/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-page items-center gap-3 px-4 sm:gap-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2.5 font-bold tracking-tight text-fg">
          <LogoMark />
          {/* 360px 보다 좁으면(오른쪽 아이콘 4개와 함께 들어가지 않는다) 글자는 숨기고 로고만. 화면 읽기 프로그램에는 읽힌다 */}
          <span className="max-[359px]:sr-only">JohnnyStudio</span>
        </Link>

        {/* 1024px(lg) 부터 펼쳐 보인다 (Story ▾ 는 눌러서 펼친다). 그보다 좁으면 메뉴 버튼 안에 있다 */}
        <nav aria-label="주 메뉴" className="ml-4 hidden shrink-0 lg:block">
          <NavLinks blog={blog} />
        </nav>

        {/* 오른쪽 위: 색은 모두 연두색(accent) (2026-11-28 사용자 요청). 테마 · My Studio(★ 개수) · 계정(표시 이름) · 설정 (· 휴대폰 메뉴).
            min-w-0: 폭이 모자라면 이 묶음이 줄어든다. 줄어드는 것은 표시 이름뿐이다 (나머지는 shrink-0) */}
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-2">
          {/* 테마 버튼은 넓은 화면에서만 (좁은 화면은 메뉴 안과 바닥글에 있다) */}
          <ThemeToggle className="hidden lg:inline-flex" />
          <StudioLink />
          <AccountLink />
          {/* 설정 화면(사용자 현황·앱 설정·캐시 지우기). 바닥글 오른쪽 아래에 있던 것을 옮겼다 */}
          <Link href="/settings/" title="설정" className={cx("inline-flex", HEADER_ICON)}>
            <Settings aria-hidden="true" className="size-4" />
            <span className="sr-only">설정</span>
          </Link>
          {/* 모바일 메뉴: JS 없이도 열린다 */}
          <details className="relative shrink-0 lg:hidden">
            <summary className={cx("flex cursor-pointer list-none [&::-webkit-details-marker]:hidden", HEADER_ICON)}>
              <Menu aria-hidden="true" className="size-4" />
              <span className="sr-only">메뉴</span>
            </summary>
            <nav
              aria-label="주 메뉴"
              className="absolute right-0 top-12 max-h-[calc(100dvh-5rem)] w-64 overflow-y-auto rounded-xl border border-line bg-surface p-2 shadow-2xl shadow-black/50 light:shadow-black/10"
            >
              <MenuAccount />
              <NavLinks vertical blog={blog} />
              <MenuThemeToggle />
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
