"use client";

import { CheckCircle2, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { type FormEvent, type ReactNode, useEffect, useState } from "react";

import { loginHref, useSession } from "@/lib/auth";
import { useIsClient } from "@/lib/bookmarks";
import { listingEditHref } from "@/lib/listing";
import { type ListingDraft, newDraft, saveListing } from "@/lib/listing-draft";
import { type ShowroomMeta, type ShowroomService, looksLikeServiceUrl, serviceHref, showroomApi, showroomListingApi } from "@/lib/showroom";
import { type StoreMe, loadRemote, setRemote, storeApi, useRemote } from "@/lib/store";

import { ListingEditor, importListing } from "../listing/listing-editor";
import { ListingKit } from "../listing/listing-kit";
import { PublisherForm } from "../store/store-upload";
import { ErrorBox, Loading, panelClass } from "../store/store-ui";
import { ButtonLink, buttonClass, cx } from "../ui";

export function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-fg">
        {label}
      </label>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

function SubmitForm({ meta }: { meta: ShowroomMeta }) {
  const [draft, setDraft] = useState<ListingDraft>(() => newDraft({ category: "productivity" in meta.categories ? "productivity" : Object.keys(meta.categories)[0] }));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ service: ShowroomService; failed: string[] } | null>(null);
  const msCategories = meta.listing.ms_categories;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!looksLikeServiceUrl(draft.url)) return setError("서비스 주소는 https:// 로 시작하는 도메인 주소여야 합니다.");
    setError(null);
    setBusy("등록하는 중");
    const r = await showroomApi.create({ name: draft.name, url: draft.url, summary: draft.summary, description: draft.description, category: draft.category });
    if (!r.ok) {
      setBusy(null);
      return setError(r.message);
    }
    // 아이콘·그림·소개 자료를 이어서 올린다 (하나가 실패해도 서비스는 접수된다)
    const s = await saveListing(showroomListingApi, r.data.code, draft, setBusy);
    const failed = s.ok ? s.failed : [...s.failed, `소개 자료: ${s.message}`];
    const fresh = await showroomApi.service(r.data.code);
    setBusy(null);
    const service = fresh.ok ? fresh.data : r.data;
    setRemote(`showroom:service:${service.code}`, service);
    setDone({ service, failed });
  }

  if (done) {
    return (
      <div role="status" className={panelClass}>
        <p className="flex items-center gap-2 text-lg font-semibold text-fg">
          <CheckCircle2 aria-hidden="true" className="size-5 text-accent" />
          접수했습니다
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          운영자가 주소와 내용을 확인한 뒤 공개합니다. 결과는{" "}
          <Link href="/showroom/mine/" className="underline underline-offset-4">
            내 서비스
          </Link>
          에서 볼 수 있습니다.
        </p>
        {done.failed.length > 0 && (
          <ul role="alert" className="mt-3 space-y-1 text-sm text-danger">
            {done.failed.map((f) => (
              <li key={f}>{f}</li>
            ))}
            <li className="text-fg-muted">&lsquo;소개 꾸미기&rsquo;에서 다시 올릴 수 있습니다.</li>
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={serviceHref(done.service.code)}>소개 화면 보기</ButtonLink>
          <ButtonLink href={listingEditHref(done.service.code, "showroom")} variant="secondary">
            소개 꾸미기
          </ButtonLink>
          <ButtonLink href="/showroom/mine/" variant="ghost">
            내 서비스
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <ListingKit
        kind="showroom"
        categories={meta.categories}
        msCategories={msCategories}
        onImport={async (imp) => {
          const r = await importListing(draft, imp, meta.categories, msCategories);
          setDraft(r.draft);
          return r.notes;
        }}
      />
      <ListingEditor kind="showroom" draft={draft} onChange={setDraft} categories={meta.categories} msCategories={msCategories} />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy !== null} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
        {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        {busy ?? "검토 요청하기"}
      </button>
    </form>
  );
}

/** /showroom/new/: 서비스 등록 (로그인 → 표시 이름·약관 → 양식) */
export function ShowroomSubmit() {
  const session = useSession();
  const isClient = useIsClient();
  const signedIn = session.status === "signed-in";
  const me = useRemote<StoreMe>(signedIn ? "me" : null);
  const meta = useRemote<ShowroomMeta>("showroom:meta");

  useEffect(() => {
    void loadRemote("showroom:meta", showroomApi.meta);
  }, []);
  useEffect(() => {
    if (signedIn) void loadRemote("me", storeApi.me);
  }, [signedIn]);

  if (!isClient || session.status === "loading") return <Loading>로그인 상태를 확인하는 중입니다…</Loading>;
  if (session.status === "unavailable") return <ErrorBox error={{ ok: false, status: 0, code: "unavailable", message: "회원 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요." }} />;
  if (session.status === "signed-out") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">로그인이 필요합니다</p>
        <p className="mt-2 text-sm text-fg-muted">서비스를 소개하려면 로그인하세요. 처음이면 이메일 인증으로 가입합니다.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={loginHref("/showroom/new/")}>로그인</ButtonLink>
          <ButtonLink href="/signup/" variant="secondary">
            가입하기
          </ButtonLink>
        </div>
      </div>
    );
  }
  if (!me || me.status === "loading" || !meta || meta.status === "loading") return <Loading />;
  if (me.status === "error") return <ErrorBox error={me.error} />;
  if (meta.status === "error") return <ErrorBox error={meta.error} />;
  const m = me.data;
  if (m.publisher?.blocked) {
    return (
      <div role="alert" className={panelClass}>
        <p className="font-semibold text-danger">이 계정은 서비스를 소개할 수 없습니다</p>
        {m.publisher.blocked_reason && <p className="mt-2 text-sm text-fg-muted">사유: {m.publisher.blocked_reason}</p>}
      </div>
    );
  }
  if (!meta.data.submissions_open && !m.admin) {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">지금은 새 서비스를 받지 않습니다</p>
        <p className="mt-2 text-sm text-fg-muted">잠시 뒤 다시 확인해 주세요.</p>
      </div>
    );
  }
  if (!m.publisher || !m.publisher.terms_current) return <PublisherForm me={m} />;
  return <SubmitForm meta={meta.data} />;
}
