"use client";

/** 안내 페이지의 프롬프트 복사·양식 내려받기 (분류 목록을 API 에서 읽는다) */
import { useEffect } from "react";

import type { ListingKind } from "@/lib/listing";
import { type ShowroomMeta, showroomApi } from "@/lib/showroom";
import { type StoreMeta, loadRemote, storeApi, useRemote } from "@/lib/store";

import { Loading, panelClass } from "../store/store-ui";
import { cx } from "../ui";
import { PromptCopyButton, PromptPreview, TemplateLink } from "./listing-kit";

function KitRow({ kind, title, categories, msCategories }: { kind: ListingKind; title: string; categories: Record<string, string>; msCategories: Record<string, string> }) {
  return (
    <div className={cx(panelClass, "space-y-4")}>
      <p className="font-semibold text-fg">{title}</p>
      <div className="flex flex-wrap gap-3">
        <PromptCopyButton kind={kind} categories={categories} msCategories={msCategories} />
        <TemplateLink kind={kind} categories={categories} msCategories={msCategories} />
      </div>
      <PromptPreview kind={kind} categories={categories} msCategories={msCategories} />
    </div>
  );
}

export function ListingGuideKit() {
  const store = useRemote<StoreMeta>("meta");
  const showroom = useRemote<ShowroomMeta>("showroom:meta");
  useEffect(() => {
    void loadRemote("meta", storeApi.meta);
    void loadRemote("showroom:meta", showroomApi.meta);
  }, []);
  if (!store || store.status === "loading" || !showroom || showroom.status === "loading") return <Loading />;
  if (store.status === "error" || showroom.status === "error") {
    return <p className="text-sm text-fg-muted">회원 서버에 연결하지 못해 프롬프트를 만들 수 없습니다. 잠시 뒤 다시 열어 주세요.</p>;
  }
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <KitRow kind="store" title="Store · Windows 앱" categories={store.data.categories} msCategories={store.data.listing.ms_categories} />
      <KitRow kind="showroom" title="Showroom · 웹 서비스" categories={showroom.data.categories} msCategories={showroom.data.listing.ms_categories} />
    </div>
  );
}
