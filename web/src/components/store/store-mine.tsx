"use client";

import { ImageUp, LoaderCircle, Pencil, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { loginHref, useSession } from "@/lib/auth";
import { useIsClient } from "@/lib/bookmarks";
import { formatBytes } from "@/lib/format";
import {
  APP_STATUS_LABELS,
  ICON_ACCEPT,
  ICON_MAX_BYTES,
  RELEASE_STATUS_LABELS,
  type StoreApp,
  type StoreMeta,
  appHref,
  loadRemote,
  localDate,
  storeApi,
  useRemote,
} from "@/lib/store";

import { ButtonLink, buttonClass, cx } from "../ui";
import { AppIcon, ErrorBox, Loading, Pill, ScanBadge, dialogClass, inputClass, panelClass, statusTone } from "./store-ui";

type Mine = { apps: StoreApp[] };
type Pending = { kind: "app"; app: StoreApp } | { kind: "release"; app: StoreApp; id: number; version: string } | null;

function EditDialog({ app, meta, onClose }: { app: StoreApp; meta: StoreMeta; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), summary: useId(), description: useId(), category: useId() };

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const r = await storeApi.editApp(app.code, {
      name: String(f.get("name") ?? ""),
      summary: String(f.get("summary") ?? ""),
      description: String(f.get("description") ?? ""),
      category: String(f.get("category") ?? ""),
    });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    await loadRemote("mine", storeApi.myApps);
    ref.current?.close();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="edit-title" className={cx(dialogClass, "max-w-2xl")}>
      <h2 id="edit-title" className="text-lg font-semibold">
        앱 정보 고치기
      </h2>
      <p className="mt-1 text-sm text-fg-muted">공개된 앱이면 고친 내용이 바로 보입니다. 파일을 바꾸려면 새 버전을 올리세요.</p>
      <form onSubmit={submit} className="mt-5 space-y-4">
        <div>
          <label htmlFor={ids.name} className="block text-sm font-semibold">
            앱 이름
          </label>
          <input id={ids.name} name="name" required maxLength={80} defaultValue={app.name} className={cx(inputClass, "mt-2 h-11")} />
        </div>
        <div>
          <label htmlFor={ids.summary} className="block text-sm font-semibold">
            한 줄 소개
          </label>
          <input id={ids.summary} name="summary" maxLength={160} defaultValue={app.summary} className={cx(inputClass, "mt-2 h-11")} />
        </div>
        <div>
          <label htmlFor={ids.description} className="block text-sm font-semibold">
            설명
          </label>
          <textarea id={ids.description} name="description" maxLength={5000} rows={6} defaultValue={app.description} className={cx(inputClass, "mt-2 py-3")} />
        </div>
        <div>
          <label htmlFor={ids.category} className="block text-sm font-semibold">
            분류
          </label>
          <select id={ids.category} name="category" defaultValue={app.category} className={cx(inputClass, "mt-2 h-11")}>
            {Object.entries(meta.categories).map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>
        </div>
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

function ConfirmDelete({ pending, onClose }: { pending: NonNullable<Pending>; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function run() {
    setBusy(true);
    setError(null);
    const r = pending.kind === "app" ? await storeApi.deleteApp(pending.app.code) : await storeApi.deleteRelease(pending.app.code, pending.id);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    await loadRemote("mine", storeApi.myApps);
    ref.current?.close();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="delete-title" className={dialogClass}>
      <h2 id="delete-title" className="text-lg font-semibold">
        {pending.kind === "app" ? "앱을 지울까요?" : "이 버전을 지울까요?"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        {pending.kind === "app" ? (
          <>
            <strong className="font-semibold text-fg">{pending.app.name}</strong>과 모든 버전의 파일이 바로 지워지고 되돌릴 수 없습니다.
          </>
        ) : (
          <>
            <strong className="font-semibold text-fg">
              {pending.app.name} {pending.version}
            </strong>{" "}
            파일이 바로 지워집니다. 마지막 공개 버전이면 앱이 목록에서 빠집니다.
          </>
        )}
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

/** 아이콘 바꾸기: 파일을 고르면 바로 올린다 */
function IconButton({ app }: { app: StoreApp }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function pick(file: File) {
    if (file.size > ICON_MAX_BYTES) return setError("아이콘 그림은 1MB 까지 올릴 수 있습니다.");
    setBusy(true);
    setError(null);
    const r = await storeApi.uploadIcon(app.code, file);
    setBusy(false);
    if (!r.ok) return setError(r.message);
    await loadRemote("mine", storeApi.myApps);
  }

  return (
    <>
      <label htmlFor={id} className={cx(buttonClass("ghost", "sm"), "cursor-pointer focus-within:outline-2 focus-within:outline-accent", busy && "opacity-60")}>
        {busy ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <ImageUp aria-hidden="true" className="size-4" />}
        아이콘 바꾸기
        <input
          id={id}
          type="file"
          accept={ICON_ACCEPT}
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

function AppRow({ app, onEdit, onDelete }: { app: StoreApp; onEdit: () => void; onDelete: (p: NonNullable<Pending>) => void }) {
  return (
    <article className={panelClass}>
      <div className="flex flex-wrap items-start gap-4">
        <AppIcon code={app.code} hasIcon={app.has_icon} name={app.name} version={app.updated_at} className="size-14 shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold text-fg">
            <Link href={appHref(app.code)} className="hover:underline">
              {app.name}
            </Link>
            {app.status && <Pill tone={statusTone(app.status)}>{APP_STATUS_LABELS[app.status]}</Pill>}
            {app.status === "published" && !app.public && <Pill tone="warn">목록에 안 보임</Pill>}
          </h2>
          <p className="mt-1 text-sm text-fg-subtle">
            {app.category_label} · 내려받기 {app.download_count ?? 0}번 · {localDate(app.created_at)} 등록
          </p>
          {app.status_reason && <p className="mt-2 text-sm text-danger">사유: {app.status_reason}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {app.status !== "hidden" && (
            <ButtonLink href={`/store/new/?app=${app.code}`} variant="secondary" size="sm">
              <Upload aria-hidden="true" className="size-4" />새 버전
            </ButtonLink>
          )}
          <button type="button" onClick={onEdit} className={buttonClass("ghost", "sm")}>
            <Pencil aria-hidden="true" className="size-4" />
            고치기
          </button>
          <IconButton app={app} />
          <button type="button" onClick={() => onDelete({ kind: "app", app })} className={cx(buttonClass("ghost", "sm"), "text-danger")}>
            <Trash2 aria-hidden="true" className="size-4" />
            지우기
          </button>
        </div>
      </div>

      <ul className="mt-5 divide-y divide-line border-t border-line">
        {app.releases.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm text-fg">
                <span className="font-mono font-semibold">{r.version}</span>
                {r.status && <Pill tone={statusTone(r.status)}>{RELEASE_STATUS_LABELS[r.status]}</Pill>}
                <ScanBadge scan={r.scan} />
              </p>
              <p className="mt-1 break-all text-xs text-fg-subtle">
                {r.file_name} · {formatBytes(r.size)} · 내려받기 {r.download_count ?? 0}번
              </p>
              {r.status_reason && <p className="mt-1 text-xs text-danger">사유: {r.status_reason}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDelete({ kind: "release", app, id: r.id, version: r.version })}
              className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-fg-subtle hover:bg-raised hover:text-danger"
            >
              <Trash2 aria-hidden="true" className="size-3.5" />이 버전 지우기
            </button>
          </li>
        ))}
      </ul>
    </article>
  );
}

/** /store/mine/: 내가 올린 앱 */
export function StoreMine() {
  const session = useSession();
  const isClient = useIsClient();
  const signedIn = session.status === "signed-in";
  const mine = useRemote<Mine>(signedIn ? "mine" : null);
  const meta = useRemote<StoreMeta>("meta");
  const [editing, setEditing] = useState<StoreApp | null>(null);
  const [deleting, setDeleting] = useState<Pending>(null);

  useEffect(() => {
    if (signedIn) void loadRemote("mine", storeApi.myApps);
  }, [signedIn]);
  useEffect(() => {
    void loadRemote("meta", storeApi.meta);
  }, []);

  if (!isClient || session.status === "loading") return <Loading>로그인 상태를 확인하는 중입니다…</Loading>;
  if (session.status !== "signed-in") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">로그인이 필요합니다</p>
        <div className="mt-5">
          <ButtonLink href={loginHref("/store/mine/")}>로그인</ButtonLink>
        </div>
      </div>
    );
  }
  if (!mine || mine.status === "loading") return <Loading />;
  if (mine.status === "error") return <ErrorBox error={mine.error} />;

  const apps = mine.data.apps;
  return (
    <div className="space-y-5">
      {apps.length === 0 ? (
        <div className="rounded-card border border-dashed border-line-strong px-6 py-14 text-center">
          <p className="font-semibold text-fg">아직 올린 앱이 없습니다</p>
          <div className="mt-6">
            <ButtonLink href="/store/new/">
              <Upload aria-hidden="true" className="size-4" />첫 앱 올리기
            </ButtonLink>
          </div>
        </div>
      ) : (
        apps.map((a) => <AppRow key={a.code} app={a} onEdit={() => setEditing(a)} onDelete={setDeleting} />)
      )}
      {editing && meta?.status === "ready" && <EditDialog app={editing} meta={meta.data} onClose={() => setEditing(null)} />}
      {deleting && <ConfirmDelete pending={deleting} onClose={() => setDeleting(null)} />}
    </div>
  );
}
