import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";

import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getProfile } from "@/lib/content";
import { THEME_SCRIPT } from "@/lib/theme-script";

const profile = getProfile();

export const metadata: Metadata = {
  title: { default: profile.name, template: `%s · ${profile.name}` },
  description: profile.intro,
  // TODO(launch): 출시할 때 색인을 허용한다 (deploy/README.md 출시 체크리스트)
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#09090b",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // data-theme 은 아래 인라인 스크립트가 그리기 전에 붙인다. 서버 HTML 에는 없으므로 이 속성의 차이는 경고하지 않는다
    <html lang="ko" suppressHydrationWarning>
      <head>
        {/* 저장된 테마를 그리기 전에 적용한다 (밝은 테마를 고른 사람에게 어두운 화면이 번쩍이지 않게). CSP 는 해시로 허용 */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="flex min-h-dvh flex-col">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-accent-ink"
        >
          본문으로 건너뛰기
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
