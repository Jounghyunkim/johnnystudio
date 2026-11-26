"use client";

/**
 * 소개 꾸미기 화면 (ADR-0013): /store/listing/?app=코드 · /showroom/listing/?id=코드
 * 올린 뒤에도 기능·그림·사용 방법 등을 고치고, AI 로 만든 소개 자료(zip·md)를 다시 불러온다.
 * 올린(소개한) 사람과 운영자가 고친다 (API 가 다시 확인한다). 운영자가 고치면 검토 상태는 그대로다 (Showroom 주소도 다시 검토하지 않는다).
 */
import { CheckCircle2, LoaderCircle, Save } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useState } from "react";

import { loginHref, useSession } from "@/lib/auth";
import { useIsClient } from "@/lib/bookmarks";
import { type ListingKind, galleryImageSrc, pageOf } from "@/lib/listing";
import { type ListingDraft, afterSave, newDraft, saveListing } from "@/lib/listing-draft";
import { type ShowroomMeta, type ShowroomService, serviceHref, serviceIconSrc, showroomApi, showroomListingApi } from "@/lib/showroom";
import { type StoreApp, type StoreMeta, appHref, iconSrc, loadRemote, parseAppCode, setRemote, storeApi, storeListingApi, useRemote } from "@/lib/store";
import { useLocationSearch } from "@/lib/use-location-search";

import { ErrorBox, Loading, panelClass } from "../store/store-ui";
import { ButtonLink, buttonClass, cx } from "../ui";
import { ListingEditor, importListing } from "./listing-editor";
import { ListingKit } from "./listing-kit";

type Item = { kind: "store"; app: StoreApp; meta: StoreMeta } | { kind: "showroom"; service: ShowroomService; meta: ShowroomMeta };

function itemBase(item: Item) {
  const x = item.kind === "store" ? item.app : item.service;
  return { code: x.code, name: x.name, summary: x.summary, description: x.description, category: x.category, url: item.kind === "showroom" ? item.service.url : "", page: pageOf(x.page) };
}

function EditForm({ item, asAdmin }: { item: Item; asAdmin: boolean }) {
  const base = itemBase(item);
  const kind: ListingKind = item.kind;
  const imageSrc = (id: string) => galleryImageSrc(kind, base.code, id);
  const [draft, setDraft] = useState<ListingDraft>(() => newDraft(base, base.page, imageSrc));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ failed: string[]; reviewAgain: boolean } | null>(null);
  const categories = item.meta.categories;
  const msCategories = item.meta.listing.ms_categories;
  const icon =
    item.kind === "store"
      ? item.app.has_icon
        ? iconSrc(item.app.code, item.app.updated_at)
        : null
      : item.service.has_icon
        ? serviceIconSrc(item.service.code, item.service.updated_at)
        : null;
  const detailHref = kind === "store" ? appHref(base.code) : serviceHref(base.code);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(null);
    setBusy("기본 정보를 저장하는 중");
    const basics = { name: draft.name, summary: draft.summary, description: draft.description, category: draft.category };
    const r = kind === "store" ? await storeApi.editApp(base.code, basics) : await showroomApi.edit(base.code, { ...basics, url: draft.url });
    if (!r.ok) {
      setBusy(null);
      return setError(r.message);
    }
    const s = await saveListing(kind === "store" ? storeListingApi : showroomListingApi, base.code, draft, setBusy);
    setBusy(null);
    if (!s.ok) return setError(s.message);
    // 새로 읽어 캐시를 바꾼다 (상세 화면이 바로 새 내용을 보인다)
    if (kind === "store") {
      const fresh = await storeApi.app(base.code);
      if (fresh.ok) setRemote(`app:${base.code}`, fresh.data);
    } else {
      const fresh = await showroomApi.service(base.code);
      if (fresh.ok) setRemote(`showroom:service:${base.code}`, fresh.data);
    }
    setDraft(afterSave(draft, s.page, imageSrc));
    const before = item.kind === "showroom" ? item.service.status : undefined;
    setSaved({ failed: s.failed, reviewAgain: !asAdmin && kind === "showroom" && before === "published" && draft.url.trim() !== base.url });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      {asAdmin && (
        <p role="note" className={cx(panelClass, "text-sm text-fg-muted")}>
          운영자로서 {kind === "store" ? "회원이 올린 앱" : "회원이 소개한 서비스"}의 소개를 고칩니다 (Store·Showroom 이용약관 제5조 5). 고친 기록이 서버 로그에 남습니다.
          {kind === "showroom" && " 운영자가 바꾼 주소는 다시 검토하지 않고, 검토 상태도 그대로입니다."}
        </p>
      )}
      {saved && (
        <div role="status" className={panelClass}>
          <p className="flex items-center gap-2 font-semibold text-fg">
            <CheckCircle2 aria-hidden="true" className="size-5 text-accent" />
            저장했습니다
          </p>
          {saved.reviewAgain && <p className="mt-2 text-sm text-fg-muted">서비스 주소가 바뀌어 운영자가 다시 검토할 때까지 목록에서 빠집니다.</p>}
          {saved.failed.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm text-danger">
              {saved.failed.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          )}
          <div className="mt-4">
            <ButtonLink href={detailHref} variant="secondary" size="sm">
              소개 화면 보기
            </ButtonLink>
          </div>
        </div>
      )}
      <ListingKit
        kind={kind}
        categories={categories}
        msCategories={msCategories}
        onImport={async (imp) => {
          const r = await importListing(draft, imp, categories, msCategories);
          setDraft(r.draft);
          return r.notes;
        }}
      />
      <ListingEditor kind={kind} draft={draft} onChange={setDraft} categories={categories} msCategories={msCategories} iconSrc={icon} />
      {/*
        저장 막대: 화면 아래에 붙어 있어서 어디까지 내려가 있든 바로 저장한다 (2026-11-26 사용자 요청).
        양식 끝에 닿으면 제자리로 돌아온다 (sticky). 진행·오류도 여기에 보여서 누른 자리에서 결과를 본다. 휴대폰 홈 표시줄 높이(safe-area)만큼 띄운다
      */}
      <div className="sticky bottom-[calc(1rem+env(safe-area-inset-bottom))] z-30 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-surface/90 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur-md light:shadow-black/10 sm:px-5">
        {/* 휴대폰: 오류·진행 문구는 버튼 위 한 줄을 다 쓰고, 평소 안내는 숨겨 막대를 얇게 둔다 */}
        <div className={cx("min-w-0 text-sm sm:flex-1", error || busy ? "basis-full sm:basis-0" : "hidden sm:block")} aria-live="polite">
          {error ? (
            <p role="alert" className="text-danger">
              {error}
            </p>
          ) : busy ? (
            <p className="text-fg-muted">{busy}…</p>
          ) : (
            <p className="text-fg-subtle">고친 내용은 저장해야 소개 화면에 반영됩니다.</p>
          )}
        </div>
        <div className="ml-auto flex shrink-0 flex-wrap gap-2">
          <ButtonLink href={detailHref} variant="ghost">
            소개 화면으로
          </ButtonLink>
          <button type="submit" disabled={busy !== null} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
            {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
            {busy ? "저장하는 중" : "저장하기"}
          </button>
        </div>
      </div>
    </form>
  );
}

export function ListingEditPage({ kind }: { kind: ListingKind }) {
  const session = useSession();
  const isClient = useIsClient();
  const [search] = useLocationSearch();
  const code = parseAppCode(new URLSearchParams(search).get(kind === "store" ? "app" : "id"));
  const signedIn = session.status === "signed-in";
  const itemKey = code ? (kind === "store" ? `app:${code}` : `showroom:service:${code}`) : null;
  const metaKey = kind === "store" ? "meta" : "showroom:meta";
  const remote = useRemote<StoreApp | ShowroomService>(signedIn ? itemKey : null);
  const meta = useRemote<StoreMeta | ShowroomMeta>(metaKey);

  useEffect(() => {
    if (kind === "store") void loadRemote<StoreMeta>(metaKey, storeApi.meta);
    else void loadRemote<ShowroomMeta>(metaKey, showroomApi.meta);
  }, [kind, metaKey]);
  useEffect(() => {
    if (!signedIn || !code || !itemKey) return;
    if (kind === "store") void loadRemote<StoreApp>(itemKey, () => storeApi.app(code));
    else void loadRemote<ShowroomService>(itemKey, () => showroomApi.service(code));
  }, [signedIn, code, itemKey, kind]);

  const back = kind === "store" ? "/store/mine/" : "/showroom/mine/";
  if (!isClient || session.status === "loading") return <Loading>로그인 상태를 확인하는 중입니다…</Loading>;
  if (session.status === "unavailable") return <ErrorBox error={{ ok: false, status: 0, code: "unavailable", message: "회원 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요." }} />;
  if (session.status === "signed-out") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">로그인이 필요합니다</p>
        <div className="mt-4">
          <ButtonLink href={loginHref(`/${kind}/listing/${search}`)}>로그인</ButtonLink>
        </div>
      </div>
    );
  }
  if (!code) return <ErrorBox error={{ ok: false, status: 400, code: "bad_code", message: "주소가 올바르지 않습니다." }} />;
  if (!remote || remote.status === "loading" || !meta || meta.status === "loading") return <Loading />;
  if (remote.status === "error") return <ErrorBox error={remote.error} title={kind === "store" ? "앱을 찾지 못했습니다" : "서비스를 찾지 못했습니다"} />;
  if (meta.status === "error") return <ErrorBox error={meta.error} />;

  const viewer = remote.data.viewer;
  const allowed = Boolean(viewer?.owner || viewer?.admin);
  if (!allowed) {
    return (
      <div role="alert" className={panelClass}>
        <p className="font-semibold text-fg">{kind === "store" ? "올린 사람과 운영자만 고칠 수 있습니다" : "소개한 사람과 운영자만 고칠 수 있습니다"}</p>
        <p className="mt-2 text-sm text-fg-muted">
          <Link href={back} className="underline underline-offset-4">
            {kind === "store" ? "내 앱" : "내 서비스"}
          </Link>
          에서 고칠 것을 골라 주세요.
        </p>
      </div>
    );
  }
  const item: Item =
    kind === "store" ? { kind, app: remote.data as StoreApp, meta: meta.data as StoreMeta } : { kind, service: remote.data as ShowroomService, meta: meta.data as ShowroomMeta };
  return <EditForm key={code} item={item} asAdmin={Boolean(viewer?.admin && !viewer.owner)} />;
}
