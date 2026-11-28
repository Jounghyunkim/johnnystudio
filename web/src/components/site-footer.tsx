import Link from "next/link";

import { getProfile } from "@/lib/content";
import { flatNav } from "@/lib/nav";

import { LogoMark } from "./logo-mark";
import { ThemeChoice } from "./theme-toggle";
import { Container } from "./ui";

export function SiteFooter() {
  const profile = getProfile();
  const year = new Date().getFullYear();
  return (
    <footer className="mt-24 border-t border-line">
      <Container className="grid gap-10 py-12 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5 font-bold text-fg">
            <LogoMark className="h-6" />
            {profile.name}
          </p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-fg-muted">{profile.tagline}</p>
        </div>
        <nav aria-label="바닥글 메뉴">
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">둘러보기</p>
          {/* 항목이 많아(Story 의 하위 메뉴 포함) 두 줄로 나눈다 */}
          <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {[...flatNav(profile.blog), { href: "/studio/", label: "My Studio" }].map((item) => (
              <li key={item.href}>
                {item.external ? (
                  <a href={item.href} target="_blank" rel="noopener noreferrer" className="text-fg-muted hover:text-fg">
                    {item.label}
                    <span className="sr-only"> (새 탭에서 열림)</span>
                  </a>
                ) : (
                  <Link href={item.href} className="text-fg-muted hover:text-fg">
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </nav>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">운영</p>
          <ul className="mt-3 space-y-2 text-sm text-fg-muted">
            <li>집에 있는 홈랩 서버에서 직접 운영합니다.</li>
            <li>추적 쿠키와 분석 스크립트를 쓰지 않습니다.</li>
            <li>
              <Link href="/privacy/" className="hover:text-fg">
                개인정보처리방침
              </Link>
            </li>
            {profile.links.map((l) => (
              <li key={l.href}>
                <a href={l.href} target="_blank" rel="noopener noreferrer" className="hover:text-fg">
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
      <Container className="flex flex-wrap items-center justify-between gap-4 border-t border-line py-6 text-xs text-fg-subtle">
        <span>
          © {year} {profile.name}
        </span>
        {/* 오른쪽 아래: 테마 (설정 버튼은 헤더 오른쪽 위로 옮겼다, 2026-11-28) */}
        <ThemeChoice />
      </Container>
    </footer>
  );
}
