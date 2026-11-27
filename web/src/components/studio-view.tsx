"use client";

import { Cloud, HardDrive, Star } from "lucide-react";
import { type ReactNode, useEffect, useMemo } from "react";

import { loginHref, useSession } from "@/lib/auth";
import { splitBookmarks, useBookmarks, useIsClient } from "@/lib/bookmarks";
import { type StoreCard, loadRemote, storeApi, useRemote } from "@/lib/store";
import type { AssetSummary } from "@/lib/types";

import { AssetGrid } from "./asset-card";
import { MemberCard } from "./store/store-cards";
import { ErrorBox } from "./store/store-ui";
import { ButtonLink } from "./ui";

// Store 목록 화면과 같은 캐시 (기본 검색: 최신순 전체)
const STORE_LIST_KEY = "list:";

function Section({ id, title, note, count, children }: { id: string; title: string; note: string; count: number | null; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-5">
      <div>
        <h2 id={id} className="text-xl font-bold tracking-tight text-fg">
          {title} {count !== null && <span className="text-fg-subtle">{count}</span>}
        </h2>
        <p className="mt-1 text-sm text-fg-muted">{note}</p>
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ children, href, label }: { children: ReactNode; href: string; label: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-dashed border-line-strong px-5 py-4">
      <p className="text-sm text-fg-muted">{children}</p>
      <ButtonLink href={href} variant="secondary" size="sm">
        {label}
      </ButtonLink>
    </div>
  );
}

/** 목록이 어디에 저장되는지 (ADR-0017). 로그인하지 않았으면 로그인하면 계정으로 옮겨진다고 알린다 */
function WhereSaved() {
  const { place, status, message, reload } = useBookmarks();
  const session = useSession();
  if (place === "account") {
    const who = session.status === "signed-in" ? `${session.user.email} 계정에` : "계정에";
    return (
      <div className="space-y-3">
        <p className="flex items-start gap-2 text-sm text-fg-muted">
          <Cloud aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
          <span>{who} 저장됩니다. 다른 브라우저·기기에서 로그인해도 같은 목록이 보입니다.</span>
        </p>
        {status === "error" && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-danger/40 px-5 py-4">
            <p className="text-sm text-danger">즐겨찾기를 계정과 맞추지 못했습니다. {message}</p>
            <button type="button" onClick={() => void reload()} className="text-sm font-semibold text-fg underline-offset-4 hover:underline">
              다시 불러오기
            </button>
          </div>
        )}
      </div>
    );
  }
  return (
    <p className="flex items-start gap-2 text-sm text-fg-muted">
      <HardDrive aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-fg-subtle" />
      <span>
        로그인하지 않아 이 브라우저에만 저장됩니다.{" "}
        <a href={loginHref("/studio/")} className="font-semibold text-accent underline-offset-4 hover:underline">
          로그인하면
        </a>{" "}
        계정으로 옮겨서 다른 브라우저·기기에서도 볼 수 있습니다.
      </span>
    </p>
  );
}

/** Store 구역: 회원 앱. 공개 목록을 한 번 받아 브라우저에서 거른다 (Store 목록 요청에는 무엇을 즐겨찾기했는지 싣지 않는다) */
function StoreSection({ codes }: { codes: string[] }) {
  const list = useRemote<{ apps: StoreCard[] }>(codes.length ? STORE_LIST_KEY : null);

  useEffect(() => {
    if (codes.length) void loadRemote(STORE_LIST_KEY, () => storeApi.list(""));
  }, [codes.length]);

  const starred = useMemo(() => {
    if (list?.status !== "ready") return [];
    const byCode = new Map(list.data.apps.map((a) => [a.code, a]));
    // 최근에 넣은 것이 먼저. 숨겨지거나 지워진 앱은 조용히 건너뛴다
    return [...codes].reverse().flatMap((c) => byCode.get(c) ?? []);
  }, [list, codes]);

  const note = "회원이 올린 Windows 앱. JohnnyStudio의 '공식' 앱은 위 JohnnyStudio에 모입니다.";
  if (codes.length === 0) {
    return (
      <Section id="studio-store" title="Store" note={note} count={0}>
        <EmptyLine href="/store/" label="Store 둘러보기">
          Store의 회원 앱 카드에서 ☆ 를 누르면 여기에 모입니다.
        </EmptyLine>
      </Section>
    );
  }
  return (
    <Section id="studio-store" title="Store" note={note} count={list?.status === "ready" ? starred.length : null}>
      {list?.status === "error" ? (
        <ErrorBox error={list.error} title="Store 앱을 불러오지 못했습니다" />
      ) : list?.status !== "ready" ? (
        <p className="text-sm text-fg-subtle">Store 앱을 불러오는 중입니다…</p>
      ) : starred.length === 0 ? (
        <EmptyLine href="/store/" label="Store 둘러보기">
          즐겨찾기한 앱이 지금은 공개되어 있지 않습니다.
        </EmptyLine>
      ) : (
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {starred.map((a) => (
            <li key={a.code}>
              <MemberCard app={a} />
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * My Studio: 즐겨찾기 모아 보기. 로그인했으면 계정(DB)에, 아니면 이 브라우저에 저장된 목록이다 (lib/bookmarks.ts, ADR-0017).
 * JohnnyStudio(Library 작품, Store 의 '공식' 앱 포함)와 Store(회원 앱) 두 구역으로 나눈다.
 * 최근에 넣은 것이 먼저 온다. 사라진 작품·앱의 즐겨찾기는 조용히 건너뛴다.
 */
export function StudioView({ assets }: { assets: AssetSummary[] }) {
  const { slugs, status } = useBookmarks();
  const isClient = useIsClient();
  const { library, store } = useMemo(() => splitBookmarks(slugs), [slugs]);

  // 로그인 상태·계정 목록을 아직 모르면 '없습니다'를 먼저 보이지 않는다
  if (!isClient || (status === "loading" && slugs.length === 0)) {
    return <p className="text-sm text-fg-subtle">즐겨찾기를 불러오는 중입니다…</p>;
  }

  if (slugs.length === 0) {
    return (
      <div className="space-y-6">
        <WhereSaved />
        <div className="rounded-card border border-dashed border-line-strong px-6 py-16 text-center">
          <Star aria-hidden="true" className="mx-auto size-8 text-fg-subtle" />
          <p className="mt-4 font-semibold text-fg">아직 즐겨찾기한 것이 없습니다</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">
            Library와 Store의 카드에서 ☆ 를 누르면 여기에 모입니다. 로그인하지 않아도 쓸 수 있습니다.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/library/">Library 둘러보기</ButtonLink>
            <ButtonLink href="/store/" variant="secondary">
              Store 둘러보기
            </ButtonLink>
          </div>
        </div>
      </div>
    );
  }

  const bySlug = new Map(assets.map((a) => [a.slug, a]));
  const works = [...library].reverse().flatMap((s) => bySlug.get(s) ?? []);

  return (
    <div className="space-y-8">
      <WhereSaved />
      <div className="space-y-14">
        <Section id="studio-library" title="JohnnyStudio" note="JohnnyStudio가 만든 작품 (Library, Store의 '공식' 앱)" count={works.length}>
          {works.length > 0 ? (
            <AssetGrid assets={works} />
          ) : (
            <EmptyLine href="/library/" label="Library 둘러보기">
              Library의 카드에서 ☆ 를 누르면 여기에 모입니다.
            </EmptyLine>
          )}
        </Section>
        <StoreSection codes={store} />
      </div>
    </div>
  );
}
