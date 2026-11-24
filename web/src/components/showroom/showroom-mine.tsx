"use client";

import { ImageUp, LoaderCircle, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { loginHref, useSession } from "@/lib/auth";
import { useIsClient } from "@/lib/bookmarks";
import { IMAGE_ACCEPT, SERVICE_STATUS_LABELS, type ShowroomMeta, type ShowroomService, serviceHref, showroomApi } from "@/lib/showroom";
import { ICON_ACCEPT, loadRemote, localDate, useRemote } from "@/lib/store";

import { ErrorBox, Loading, Pill, dialogClass, inputClass, panelClass, statusTone } from "../store/store-ui";
import { ButtonLink, buttonClass, cx } from "../ui";
import { Field } from "./showroom-submit";
import { OpenLink, ServiceIcon } from "./showroom-ui";

const reload = () => loadRemote("showroom:mine", showroomApi.mine);

function EditDialog({ svc, meta, onClose }: { svc: ShowroomService; meta: ShowroomMeta; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), url: useId(), summary: useId(), description: useId(), category: useId() };

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    setBusy(true);
    setError(null);
    const r = await showroomApi.edit(svc.code, { name: text("name"), url: text("url"), summary: text("summary"), description: text("description"), category: text("category") });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    await reload();
    ref.current?.close();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="svc-edit-title" className={cx(dialogClass, "max-w-2xl")}>
      <h2 id="svc-edit-title" className="text-lg font-semibold">
        서비스 정보 고치기
      </h2>
      <p className="mt-1 text-sm text-fg-muted">이름·소개·설명·분류는 바로 반영됩니다. 공개된 서비스의 주소를 바꾸면 운영자가 다시 검토할 때까지 목록에서 빠집니다.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <Field id={ids.name} label="서비스 이름">
          <input id={ids.name} name="name" required maxLength={80} defaultValue={svc.name} className={cx(inputClass, "h-11")} />
        </Field>
        <Field id={ids.url} label="서비스 주소">
          <input id={ids.url} name="url" type="url" required maxLength={500} defaultValue={svc.url} className={cx(inputClass, "h-11 font-mono")} />
        </Field>
        <Field id={ids.summary} label="한 줄 소개">
          <input id={ids.summary} name="summary" maxLength={160} defaultValue={svc.summary} className={cx(inputClass, "h-11")} />
        </Field>
        <Field id={ids.description} label="설명">
          <textarea id={ids.description} name="description" maxLength={5000} rows={6} defaultValue={svc.description} className={cx(inputClass, "py-3")} />
        </Field>
        <Field id={ids.category} label="분류">
          <select id={ids.category} name="category" defaultValue={svc.category} className={cx(inputClass, "h-11")}>
            {Object.entries(meta.categories).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
            취소
          </button>
          <button type="submit" disabled={busy} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
            {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            저장
          </button>
        </div>
      </form>
    </dialog>
  );
}

function ConfirmDelete({ svc, onClose }: { svc: ShowroomService; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function run() {
    setBusy(true);
    setError(null);
    const r = await showroomApi.remove(svc.code);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    await reload();
    ref.current?.close();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="svc-delete-title" className={dialogClass}>
      <h2 id="svc-delete-title" className="text-lg font-semibold">
        서비스 소개를 지울까요?
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        <strong className="font-semibold text-fg">{svc.name}</strong>의 소개·아이콘·화면 그림이 바로 지워지고 되돌릴 수 없습니다. 서비스 자체에는 영향이 없습니다.
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" autoFocus onClick={() => ref.current?.close()} className={buttonClass("secondary")}>
          취소
        </button>
        <button type="button" disabled={busy} onClick={run} className={cx(buttonClass("primary"), "bg-danger text-danger-ink hover:bg-danger/90 disabled:opacity-60")}>
          {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
          지우기
        </button>
      </div>
    </dialog>
  );
}

function ImageButton({ svc, kind, meta }: { svc: ShowroomService; kind: "icon" | "screenshot"; meta: ShowroomMeta }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const max = kind === "icon" ? meta.limits.icon_max_bytes : meta.limits.screenshot_max_bytes;
  const label = kind === "icon" ? "아이콘" : "화면 그림";

  async function pick(file: File) {
    if (file.size > max) return setError(`${label}은(는) ${Math.round(max / 1024 / 1024)}MB 까지 올릴 수 있습니다.`);
    setBusy(true);
    setError(null);
    const r = await showroomApi.uploadImage(svc.code, kind, file);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    await reload();
  }

  return (
    <>
      <label htmlFor={id} className={cx(buttonClass("ghost", "sm"), "cursor-pointer focus-within:outline-2 focus-within:outline-accent", busy && "opacity-60")}>
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ImageUp aria-hidden="true" className="size-4" />}
        {label} {kind === "icon" ? (svc.has_icon ? "바꾸기" : "넣기") : svc.has_screenshot ? "바꾸기" : "넣기"}
        <input
          id={id}
          type="file"
          accept={kind === "icon" ? ICON_ACCEPT : IMAGE_ACCEPT}
          disabled={busy}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void pick(file);
            e.target.value = "";
          }}
        />
      </label>
      {error && (
        <p role="alert" className="basis-full text-right text-xs text-danger">
          {error}
        </p>
      )}
    </>
  );
}

/** /showroom/mine/: 내가 소개한 서비스 */
export function ShowroomMine() {
  const session = useSession();
  const isClient = useIsClient();
  const signedIn = session.status === "signed-in";
  const mine = useRemote<{ services: ShowroomService[] }>(signedIn ? "showroom:mine" : null);
  const meta = useRemote<ShowroomMeta>("showroom:meta");
  const [editing, setEditing] = useState<ShowroomService | null>(null);
  const [deleting, setDeleting] = useState<ShowroomService | null>(null);

  useEffect(() => {
    if (signedIn) void reload();
  }, [signedIn]);
  useEffect(() => {
    void loadRemote("showroom:meta", showroomApi.meta);
  }, []);

  if (!isClient || session.status === "loading") return <Loading>로그인 상태를 확인하는 중입니다…</Loading>;
  if (session.status !== "signed-in") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">로그인이 필요합니다</p>
        <div className="mt-5">
          <ButtonLink href={loginHref("/showroom/mine/")}>로그인</ButtonLink>
        </div>
      </div>
    );
  }
  if (!mine || mine.status === "loading" || !meta || meta.status === "loading") return <Loading />;
  if (mine.status === "error") return <ErrorBox error={mine.error} />;
  if (meta.status === "error") return <ErrorBox error={meta.error} />;

  const services = mine.data.services;
  return (
    <div className="space-y-5">
      {services.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="font-semibold text-fg">아직 소개한 서비스가 없습니다</p>
          <div className="mt-6">
            <ButtonLink href="/showroom/new/">
              <Plus aria-hidden="true" className="size-4" />
              서비스 소개하기
            </ButtonLink>
          </div>
        </div>
      ) : (
        services.map((s) => (
          <article key={s.code} className={panelClass}>
            <div className="flex flex-wrap items-start gap-4">
              <ServiceIcon code={s.code} hasIcon={s.has_icon} name={s.name} version={s.updated_at} className="size-14 shrink-0" />
              <div className="min-w-0 flex-1">
                <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-fg">
                  <Link href={serviceHref(s.code)} className="hover:underline">
                    {s.name}
                  </Link>
                  {s.status && <Pill tone={statusTone(s.status)}>{SERVICE_STATUS_LABELS[s.status]}</Pill>}
                </h2>
                <p className="mt-1 break-all text-sm text-fg-subtle">
                  {s.category_label} · {s.host} · {localDate(s.created_at)} 등록
                </p>
                {s.status_reason && <p className="mt-2 text-sm text-danger">사유: {s.status_reason}</p>}
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <OpenLink href={s.url} name={s.name} ugc className={buttonClass("ghost", "sm")} />
                <button type="button" onClick={() => setEditing(s)} className={buttonClass("ghost", "sm")}>
                  <Pencil aria-hidden="true" className="size-4" />
                  고치기
                </button>
                <ImageButton svc={s} kind="icon" meta={meta.data} />
                <ImageButton svc={s} kind="screenshot" meta={meta.data} />
                <button type="button" onClick={() => setDeleting(s)} className={cx(buttonClass("ghost", "sm"), "text-danger")}>
                  <Trash2 aria-hidden="true" className="size-4" />
                  지우기
                </button>
              </div>
            </div>
          </article>
        ))
      )}
      {editing && <EditDialog svc={editing} meta={meta.data} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDelete svc={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
