import { FileCode2, HardDrive, Server, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";

import { Container, PageHeader, SectionHeading } from "@/components/ui";
import { getProfile } from "@/lib/content";

export const metadata: Metadata = {
  title: "About",
  description: "JohnnyStudio의 철학과 운영 방식, 앞으로의 계획.",
};

const STACK = [
  { icon: Server, title: "집에 있는 홈랩 서버", text: "미니 PC 한 대가 이 사이트를 내줍니다. 인프라를 직접 소유하고 운영합니다." },
  { icon: FileCode2, title: "콘텐츠는 파일", text: "모든 작품과 기록은 저장소의 텍스트 파일입니다. 이력이 남고, 언제든 옮길 수 있습니다." },
  { icon: HardDrive, title: "정적 사이트", text: "미리 만들어 둔 HTML을 nginx 가 그대로 내줍니다. 빠르고, 공격받을 곳이 적습니다." },
  { icon: ShieldCheck, title: "추적 없음", text: "추적 쿠키와 분석 스크립트를 쓰지 않습니다. 쿠키는 로그인했을 때 로그인 유지에만 씁니다. 즐겨찾기는 내 브라우저에만 저장됩니다." },
];

// ideation.md §6 단계 계획
const ROADMAP = [
  { phase: "Phase 1", title: "공개 허브", text: "Library, Life Log, Work with me, 로그인 없는 My Studio", now: true },
  { phase: "Phase 2", title: "회원과 My Studio", text: "로그인, 기기 간 즐겨찾기 동기화, 문의 폼", now: false },
  { phase: "Phase 3", title: "Client Room", text: "의뢰인 전용 공간: 결과물 버전, 검수, 납품, 피드백 스레드", now: false },
  { phase: "Phase 4", title: "자동 Life Log와 JohnnyBot", text: "외부 활동 자동 수집, 작품을 안내하는 AI 에이전트", now: false },
];

export default function AboutPage() {
  const profile = getProfile();
  return (
    <>
      <PageHeader eyebrow="About" title={profile.tagline} description={profile.intro} />

      <Container className="grid gap-20 py-16">
        <section aria-labelledby="principles-title">
          <SectionHeading id="principles-title" title="원칙" description="기능을 고를 때 이 다섯 가지를 기준으로 삼습니다." />
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.principles.map((p, i) => (
              <li key={p.title} className="rounded-card border border-line bg-surface p-6">
                <p className="font-mono text-xs text-fg-subtle">0{i + 1}</p>
                <h3 className="mt-3 font-semibold text-fg">{p.titleKo}</h3>
                <p className="text-xs text-fg-subtle">{p.title}</p>
                <p className="mt-3 text-sm leading-relaxed text-fg-muted">{p.summary}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="stack-title">
          <SectionHeading id="stack-title" title="이렇게 운영합니다" description="Sovereignty & Self-Hosting을 실제로 지키는 방법입니다." />
          <ul className="grid gap-4 sm:grid-cols-2">
            {STACK.map((s) => (
              <li key={s.title} className="flex gap-4 rounded-card border border-line bg-surface p-6">
                <s.icon aria-hidden="true" className="size-6 shrink-0 text-accent" />
                <div>
                  <h3 className="font-semibold text-fg">{s.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{s.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="roadmap-title">
          <SectionHeading id="roadmap-title" title="로드맵" description="공개 → 개인화 → 협업 → 지능화 순서로 쌓아 갑니다." />
          <ol className="grid gap-4 lg:grid-cols-4">
            {ROADMAP.map((r) => (
              <li key={r.phase} className={r.now ? "rounded-card border border-accent/50 bg-surface p-6" : "rounded-card border border-line p-6"}>
                <p className="flex items-center justify-between text-xs font-semibold">
                  <span className={r.now ? "text-accent" : "text-fg-subtle"}>{r.phase}</span>
                  {r.now && <span className="rounded-full bg-accent/10 px-2 py-0.5 text-accent light:text-accent-hover">지금</span>}
                </p>
                <h3 className="mt-3 font-semibold text-fg">{r.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-fg-muted">{r.text}</p>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="owner-title" className="max-w-3xl">
          <SectionHeading id="owner-title" title="만드는 사람" />
          {/* TODO(content): 운영자 소개. 실명·경력 공개 범위는 ideation §9-7 에서 정한다 */}
          <p className="rounded-card border border-dashed border-line-strong p-6 text-sm text-fg-muted">소개 글을 준비하고 있습니다.</p>
        </section>
      </Container>
    </>
  );
}
