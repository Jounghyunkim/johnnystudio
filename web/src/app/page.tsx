import { ArrowRight, BookMarked, Store } from "lucide-react";
import Link from "next/link";

import { AssetGrid } from "@/components/asset-card";
import { Faq, FeaturedSpotlight, Principles, Process, Steps, TypeBoard } from "@/components/landing";
import { LogoFull, LogoMark } from "@/components/logo-mark";
import { Timeline } from "@/components/timeline";
import { ButtonLink, Container, SectionHeading } from "@/components/ui";
import { getAssets, getProfile, getTimeline, toSummary } from "@/lib/content";
import { yearOf } from "@/lib/format";
import { TYPE_STYLE } from "@/lib/type-style";

/** Showroom = 웹 서비스: 유형 아이콘(브라우저 화면)과 같다 */
const ShowroomIcon = TYPE_STYLE["web-app"].icon;

/**
 * 홈 = 랜딩 페이지. 처음 온 방문자가 1분 안에 알아야 할 것 (PHILOSOPHY §8):
 * 무엇을 만드는 곳인지 → 어떻게 쓰는지 → 대표 작품 → 원칙 → 함께 일하는 방식 → 최근 기록 → 자주 묻는 질문 → 다음 행동
 * 문구는 content/profile.yaml (landing·principles·process). 작품 수는 지금 빌드에 실린 것만 센다.
 */
export default function HomePage() {
  const profile = getProfile();
  const { landing } = profile;
  const assets = getAssets();
  const summaries = assets.map(toSummary);
  const timeline = getTimeline();
  const since = timeline.length ? yearOf(timeline[timeline.length - 1]!.date) : undefined;

  // 대표 작품: featured 먼저, 모자라면 최신 작품으로 3개까지 채운다
  const featured = [...assets.filter((a) => a.featured), ...assets.filter((a) => !a.featured)].slice(0, 3).map(toSummary);

  return (
    <>
      <section aria-labelledby="hero-title" className="hero-glow relative overflow-hidden border-b border-line">
        <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0" />
        <Container className="relative grid items-center gap-12 pb-20 pt-10 sm:pb-24 sm:pt-14 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
          <div className="rise">
            {/* 로고 + 이름: 로고는 왼쪽, 이름은 남은 자리의 가운데(아이콘 높이의 가운데, 2026-11-26 사용자 요청). 그림 속 글자와 겹쳐 두 번 읽히지 않게 그림은 장식(alt="") */}
            {/*
              이름은 줄 폭에 맞춰 가장 크게 (컨테이너 쿼리 cqw): 글자 폭은 약 7.7em, 로고(80·112px)와 간격(16·24px)을 뺀 자리를 7.9 로 나눈다.
              줄 바꿈 없이 칸을 넘지 않고, 줄(@container)의 폭이 글자에 끌려 늘지 않는다 (예전에는 휴대폰에서 왼쪽 칸이 화면 밖으로 밀렸다)
            */}
            <div className="@container mb-8 flex items-center justify-between gap-4 sm:gap-6">
              <LogoFull alt="" className="size-20 shrink-0 sm:size-28" />
              {/* brand-wordmark: 굵은 그라데이션 글자 (globals.css), font-display: 각진 글꼴 Oxanium. 중괄호는 꾸밈이라 읽지 않는다 */}
              <p className="brand-wordmark min-w-0 flex-1 whitespace-nowrap pb-1 text-center font-display text-[length:clamp(1.375rem,calc((100cqw-6rem)/7.9),2.75rem)] font-extrabold tracking-tight sm:text-[length:clamp(2rem,calc((100cqw-8.5rem)/7.9),4.5rem)]">
                <span aria-hidden="true">{"{ "}</span>
                JohnnyStudio
                <span aria-hidden="true">{" }"}</span>
              </p>
            </div>
            <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-line bg-surface/60 px-3 py-1 text-xs font-medium text-fg-muted">
              <span aria-hidden="true" className="size-1.5 rounded-full bg-accent" />
              {landing.eyebrow}
            </p>
            <h1 id="hero-title" className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-fg sm:text-6xl">
              {landing.greeting}
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">{profile.intro}</p>
            <div className="mt-10 flex flex-wrap gap-3">
              <ButtonLink href="/library/">
                Library 둘러보기
                <ArrowRight aria-hidden="true" className="size-4" />
              </ButtonLink>
              {/* 회원이 함께 올리는 곳 (ADR-0012): Windows 앱(Store), 웹 서비스(Showroom) */}
              <ButtonLink href="/store/" variant="secondary">
                <Store aria-hidden="true" className="size-4" />
                Store
              </ButtonLink>
              <ButtonLink href="/showroom/" variant="secondary">
                <ShowroomIcon aria-hidden="true" className="size-4" />
                Showroom
              </ButtonLink>
              <ButtonLink href="/work/" variant="secondary">
                함께 일하기
              </ButtonLink>
            </div>
            <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-4 text-sm">
              <div>
                <dt className="text-fg-subtle">공개 작품</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-fg">{assets.length}</dd>
              </div>
              <div>
                <dt className="text-fg-subtle">기록</dt>
                <dd className="mt-1 text-2xl font-bold tabular-nums text-fg">{timeline.length}</dd>
              </div>
              {since && (
                <div>
                  <dt className="text-fg-subtle">since</dt>
                  <dd className="mt-1 text-2xl font-bold tabular-nums text-fg">{since}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className="rise rise-delay">
            <TypeBoard assets={summaries} />
          </div>
        </Container>
      </section>

      <section aria-labelledby="steps-title" className="py-16 sm:py-24">
        <Container>
          <SectionHeading id="steps-title" title="이렇게 쓰세요" description="가입하지 않아도 처음부터 끝까지 쓸 수 있습니다." />
          <Steps steps={landing.steps} />
        </Container>
      </section>

      <section aria-labelledby="featured-title" className="py-16 sm:py-20">
        <Container>
          <SectionHeading
            id="featured-title"
            title="대표 작품"
            description="지금 가장 먼저 보여 드리고 싶은 작업입니다."
            action={
              <Link href="/library/" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                전체 보기 <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            }
          />
          {featured.length === 1 ? <FeaturedSpotlight asset={featured[0]!} /> : <AssetGrid assets={featured} />}
        </Container>
      </section>

      <section aria-labelledby="principles-title" className="border-y border-line bg-surface/40 py-16 sm:py-24">
        <Container>
          <SectionHeading id="principles-title" title="일하는 원칙" description="무엇을 만들고 어떻게 운영할지 정할 때 이 다섯 가지를 기준으로 삼습니다." />
          <Principles principles={profile.principles} />
        </Container>
      </section>

      <section aria-labelledby="process-title" className="py-16 sm:py-24">
        <Container>
          <SectionHeading
            id="process-title"
            title="함께 일하는 방식"
            description="GitHub의 협업 방식을 의뢰 업무에 맞게 옮겼습니다. 의뢰인에게 GitHub 계정은 필요 없습니다."
            action={
              <Link href="/work/" className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline">
                Work with me <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            }
          />
          <Process process={profile.process} />
        </Container>
      </section>

      <section aria-labelledby="log-title" className="py-16 sm:py-20">
        <Container className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <SectionHeading id="log-title" title="최근 기록" description="언제, 무엇을, 왜 만들었는지 Life Log에 남깁니다." />
            <ButtonLink href="/log/" variant="secondary" size="sm">
              <BookMarked aria-hidden="true" className="size-4" />
              Life Log 전체 보기
            </ButtonLink>
          </div>
          <Timeline items={timeline.slice(0, 4)} />
        </Container>
      </section>

      <section aria-labelledby="faq-title" className="py-16 sm:py-20">
        <Container>
          <SectionHeading id="faq-title" title="자주 묻는 질문" />
          <Faq faq={landing.faq} />
        </Container>
      </section>

      <section aria-labelledby="closing-title" className="py-16 sm:py-24">
        <Container>
          <div className="hero-glow relative overflow-hidden rounded-card border border-line bg-surface px-8 py-14 text-center sm:px-12 sm:py-20">
            <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0" />
            <div className="relative">
              <LogoMark className="mx-auto mb-6 h-12" />
              <h2 id="closing-title" className="text-3xl font-bold tracking-tight text-fg sm:text-4xl">
                {landing.closing.title}
              </h2>
              <p className="mx-auto mt-4 max-w-xl text-fg-muted">{landing.closing.text}</p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <ButtonLink href="/library/">
                  Library 둘러보기
                  <ArrowRight aria-hidden="true" className="size-4" />
                </ButtonLink>
                <ButtonLink href="/work/" variant="secondary">
                  함께 일하기
                </ButtonLink>
              </div>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
