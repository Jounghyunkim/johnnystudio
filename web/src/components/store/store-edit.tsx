"use client";

import { ImageUp, LoaderCircle } from "lucide-react";
import { type FormEvent, useEffect, useId, useRef, useState } from "react";

import { ICON_ACCEPT, ICON_MAX_BYTES, type StoreApp, type StoreMeta, storeApi } from "@/lib/store";

import { buttonClass, cx } from "../ui";
import { dialogClass, inputClass } from "./store-ui";

/*
 * 앱 고치기·지우기. 올린 사람('내 앱', 앱 상세)과 운영자(검토 화면, 앱 상세)가 함께 쓴다.
 * 권한은 API 가 판단한다 (올린 사람 또는 JOHNNYSTUDIO_STORE_ADMINS). 끝나면 onSaved·onDone 으로 화면을 새로 읽는다.
 */

/** 앱 정보(이름·소개·설명·분류) 고치기 */
export function AppEditDialog({
  app,
  meta,
  asAdmin = false,
  onSaved,
  onClose,
}: {
  app: StoreApp;
  meta: StoreMeta;
  asAdmin?: boolean;
  onSaved: () => Promise<unknown>;
  onClose: () => void;
}) {
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
    if (r.ok) await onSaved();
    setBusy(false);
    if (!r.ok) return setError(r.message);
    ref.current?.close();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="edit-title" className={cx(dialogClass, "max-w-2xl")}>
      <h2 id="edit-title" className="text-lg font-semibold">
        {asAdmin ? `${app.name} 정보 고치기 (운영자)` : "앱 정보 고치기"}
      </h2>
      <p className="mt-1 text-sm text-fg-muted">
        {asAdmin
          ? "올린 사람의 '내 앱'과 공개 화면에 바로 반영됩니다. 검토 상태는 바뀌지 않습니다. 파일은 올린 사람만 바꿀 수 있습니다."
          : "공개된 앱이면 고친 내용이 바로 보입니다. 파일을 바꾸려면 새 버전을 올리세요."}
      </p>
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

/** 아이콘 바꾸기: 파일을 고르면 바로 올린다 (서버가 256px PNG 로 다시 그린다) */
export function IconButton({ app, onSaved }: { app: StoreApp; onSaved: () => Promise<unknown> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function pick(file: File) {
    if (file.size > ICON_MAX_BYTES) return setError("아이콘 그림은 1MB 까지 올릴 수 있습니다.");
    setBusy(true);
    setError(null);
    const r = await storeApi.uploadIcon(app.code, file);
    if (r.ok) await onSaved();
    setBusy(false);
    if (!r.ok) setError(r.message);
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

export type DeleteTarget = { kind: "app"; app: StoreApp } | { kind: "release"; app: StoreApp; id: number; version: string };

/** 앱(모든 버전) 또는 버전 하나 지우기. 파일까지 바로 지워지고 되돌릴 수 없다 */
export function DeleteDialog({
  target,
  asAdmin = false,
  onDone,
  onClose,
}: {
  target: DeleteTarget;
  asAdmin?: boolean;
  onDone: () => Promise<unknown> | void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  async function run() {
    setBusy(true);
    setError(null);
    const r = target.kind === "app" ? await storeApi.deleteApp(target.app.code) : await storeApi.deleteRelease(target.app.code, target.id);
    if (r.ok) await onDone();
    setBusy(false);
    if (!r.ok) return setError(r.message);
    ref.current?.close();
  }

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="delete-title" className={dialogClass}>
      <h2 id="delete-title" className="text-lg font-semibold">
        {target.kind === "app" ? "앱을 지울까요?" : "이 버전을 지울까요?"}
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-fg-muted">
        {target.kind === "app" ? (
          <>
            <strong className="font-semibold text-fg">{target.app.name}</strong> 앱과 모든 버전의 파일이 바로 지워지고 되돌릴 수 없습니다.
          </>
        ) : (
          <>
            <strong className="font-semibold text-fg">
              {target.app.name} {target.version}
            </strong>{" "}
            파일이 바로 지워집니다. 마지막 공개 버전이면 앱이 목록에서 빠집니다.
          </>
        )}
      </p>
      {asAdmin && (
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          운영자로 지웁니다. 올린 사람({target.app.publisher})의 &lsquo;내 앱&rsquo;에서도 사라집니다. 잠시 내리기만 하려면 &lsquo;숨기기&rsquo;를 쓰세요.
        </p>
      )}
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
