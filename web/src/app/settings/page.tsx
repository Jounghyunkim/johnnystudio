import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppPanel, GeneralPanel, UsersPanel } from "@/components/settings/settings-panels";
import { Container, PageHeader } from "@/components/ui";

export const metadata: Metadata = {
  title: "설정",
  description: "사용자 현황, 화면 테마·로그인 이메일 같은 앱 설정, 캐시 지우기.",
  robots: { index: false, follow: false },
};

// 칸의 제목과 차례는 빌드된 HTML 에 둔다 (안쪽 내용은 브라우저에서 그린다: components/settings/settings-panels.tsx)
const SECTIONS = [
  { id: "users", title: "사용자 현황", description: "내 계정의 상태입니다. 운영자에게는 회원·Store·Showroom 전체 현황도 보입니다." },
  { id: "app", title: "앱 설정", description: "화면 테마와 로그인 편의 설정입니다. 이 브라우저에만 저장합니다." },
  { id: "general", title: "일반 설정", description: "캐시와 이 브라우저에 저장된 값을 지웁니다." },
] as const;

const PANELS: Record<(typeof SECTIONS)[number]["id"], ReactNode> = {
  users: <UsersPanel />,
  app: <AppPanel />,
  general: <GeneralPanel />,
};

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Settings" title="설정" description="사용자 현황, 앱 설정, 캐시 지우기를 한곳에서 합니다." />
      <Container className="max-w-4xl py-12">
        <nav aria-label="설정 차례" className="flex flex-wrap gap-2">
          {SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border border-line px-3.5 py-1.5 text-sm text-fg-muted hover:border-line-strong hover:text-fg">
              {s.title}
            </a>
          ))}
        </nav>
        <div className="mt-10 space-y-14">
          {SECTIONS.map((s) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className="scroll-mt-24 space-y-5">
              <div>
                <h2 id={`${s.id}-title`} className="text-2xl font-bold tracking-tight text-fg">
                  {s.title}
                </h2>
                <p className="mt-1.5 text-sm text-fg-muted">{s.description}</p>
              </div>
              {PANELS[s.id]}
            </section>
          ))}
        </div>
      </Container>
    </>
  );
}
