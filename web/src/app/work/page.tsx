import { Bell, FileCheck2, History, Lock, Mail, MessagesSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Container, PageHeader, SectionHeading, buttonClass } from "@/components/ui";
import { getAssets, getProfile } from "@/lib/content";

export const metadata: Metadata = {
  title: "Work with me",
  description: "JohnnyStudio와 함께 일하는 방법: 제공 서비스, 진행 방식, 연락처.",
};

const CLIENT_ROOM = [
  { icon: FileCheck2, text: "결과물을 버전으로 올리고, 승인하거나 수정을 요청합니다" },
  { icon: MessagesSquare, text: "요청·피드백마다 스레드로 이야기하고, 상태를 함께 봅니다" },
  { icon: History, text: "모든 결정과 파일이 이력으로 남습니다" },
  { icon: Bell, text: "검수 요청과 답글은 이메일로 알려 드립니다" },
];

export default function WorkPage() {
  const profile = getProfile();
  const titles = new Map(getAssets().map((a) => [a.slug, a.title]));
  const email = profile.contact.email;

  return (
    <>
      <PageHeader
        eyebrow="Seamless Collaboration"
        title="Work with me"
        description="요청부터 검수, 납품까지 모든 과정을 한곳에 기록하며 일합니다. 무엇이 언제 왜 바뀌었는지 언제든 다시 볼 수 있습니다."
      />

      <Container className="grid gap-20 py-16">
        <section aria-labelledby="services-title">
          <SectionHeading id="services-title" title="할 수 있는 일" />
          <ul className="grid gap-4 sm:grid-cols-2">
            {profile.services.map((s) => (
              <li key={s.title} className="rounded-card border border-line bg-surface p-6">
                <h3 className="font-semibold text-fg">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-fg-muted">{s.summary}</p>
                {s.related.length > 0 && (
                  <p className="mt-4 text-xs text-fg-subtle">
                    사례:{" "}
                    {s.related
                      .filter((slug) => titles.has(slug))
                      .map((slug, i) => (
                        <span key={slug}>
                          {i > 0 && ", "}
                          <Link href={`/library/${slug}/`} className="text-accent hover:underline">
                            {titles.get(slug)}
                          </Link>
                        </span>
                      ))}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="process-title">
          <SectionHeading id="process-title" title="진행 방식" description="GitHub의 협업 방식을 의뢰 업무에 맞게 옮겼습니다. GitHub 계정은 필요 없습니다." />
          <ol className="grid gap-4 md:grid-cols-4">
            {profile.process.map((p, i) => (
              <li key={p.title} className="relative rounded-card border border-line bg-surface p-6">
                <span className="flex size-8 items-center justify-center rounded-full bg-accent font-mono text-sm font-bold text-accent-ink">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-semibold text-fg">{p.title}</h3>
                <p className="font-mono text-xs text-fg-subtle">{p.github}</p>
                <p className="mt-3 text-sm leading-relaxed text-fg-muted">{p.summary}</p>
              </li>
            ))}
          </ol>
        </section>

        <section id="client-room" aria-labelledby="client-room-title" className="rounded-card border border-line bg-surface p-8 sm:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <Lock aria-hidden="true" className="size-5 text-accent" />
            <h2 id="client-room-title" className="text-xl font-bold text-fg">
              Client Room
            </h2>
            <span className="rounded-full bg-raised px-2.5 py-0.5 text-xs text-fg-subtle">준비 중 · Phase 3</span>
          </div>
          <p className="mt-3 max-w-2xl text-fg-muted">
            의뢰인만 들어오는 전용 공간입니다. 이메일 초대 링크로 들어오고, 결과물 다운로드 링크는 시간이 지나면 만료됩니다.
          </p>
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {CLIENT_ROOM.map((c) => (
              <li key={c.text} className="flex items-start gap-3 text-sm text-fg-muted">
                <c.icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
                {c.text}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="contact-title" className="hero-glow rounded-card border border-line p-8 text-center sm:p-12">
          <h2 id="contact-title" className="text-2xl font-bold tracking-tight text-fg">
            이야기를 시작해 볼까요?
          </h2>
          {email ? (
            <>
              <p className="mt-3 text-fg-muted">만들고 싶은 것과 일정을 알려 주세요.</p>
              <a href={`mailto:${email}`} className={buttonClass("primary") + " mt-8"}>
                <Mail aria-hidden="true" className="size-4" />
                {email}
              </a>
            </>
          ) : (
            <p className="mt-3 text-fg-muted">{profile.contact.note ?? "연락처를 준비하고 있습니다."}</p>
          )}
        </section>
      </Container>
    </>
  );
}
