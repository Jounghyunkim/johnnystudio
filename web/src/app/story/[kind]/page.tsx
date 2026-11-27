import { ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AssetGrid } from "@/components/asset-card";
import { StoryHeader } from "@/components/story-header";
import { ButtonLink, Container, cx, ExternalButton } from "@/components/ui";
import { getAssets, getProfile, toSummary } from "@/lib/content";
import { TYPE_LABELS } from "@/lib/labels";
import { STORY_KINDS, storyHref, type StoryKind } from "@/lib/story";
import { TYPE_STYLE } from "@/lib/type-style";

/**
 * Story ▾ 의 유형별 페이지: 영상·사진·글·하드웨어 (ADR-0018).
 * 작품 파일(content/assets)에서 그 유형만 골라 빌드된 HTML 에 넣는다. 카드를 누르면 그 작품의 Library 상세(설명 페이지)로 간다.
 * 머리글: 현재 위치(Story › 영상)와 Story 탭 (StoryHeader)
 */
export const dynamicParams = false;

export function generateStaticParams() {
  return STORY_KINDS.map((k) => ({ kind: k.slug }));
}

type Props = { params: Promise<{ kind: string }> };

const kindOf = (slug: string): StoryKind | undefined => STORY_KINDS.find((k) => k.slug === slug);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const kind = kindOf((await params).kind);
  if (!kind) return {};
  return { title: TYPE_LABELS[kind.type], description: kind.description };
}

export default async function StoryKindPage({ params }: Props) {
  const kind = kindOf((await params).kind);
  if (!kind) notFound();
  const label = TYPE_LABELS[kind.type];
  const assets = getAssets()
    .filter((a) => a.type === kind.type)
    .map(toSummary);
  // 글은 바깥 블로그로 이어 준다 (블로그 = Story ▾ 의 Blog)
  const blog = kind.type === "article" ? getProfile().blog : undefined;
  const Icon = TYPE_STYLE[kind.type].icon;

  return (
    <>
      <StoryHeader
        current={storyHref(kind)}
        title={label}
        description={kind.description}
        actions={
          blog && (
            <ExternalButton href={blog} variant="secondary">
              Blog 전체 보기
              <ArrowUpRight aria-hidden="true" className="size-4" />
            </ExternalButton>
          )
        }
      />
      <Container className="py-12">
        {assets.length > 0 ? (
          <AssetGrid assets={assets} />
        ) : (
          <div className="rounded-card border border-dashed border-line-strong px-6 py-16 text-center">
            <Icon aria-hidden="true" className={cx("mx-auto size-8", TYPE_STYLE[kind.type].ink)} />
            <p className="mt-4 font-semibold text-fg">{label} 작품을 준비하고 있습니다</p>
            <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
              공개하면 여기에 모입니다. 그동안 Library의 앱과 웹 서비스, Life Log의 기록을 둘러보세요.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <ButtonLink href="/library/">Library 둘러보기</ButtonLink>
              <ButtonLink href="/log/" variant="secondary">
                Life Log
              </ButtonLink>
            </div>
          </div>
        )}
      </Container>
    </>
  );
}
