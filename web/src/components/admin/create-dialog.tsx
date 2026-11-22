"use client";

/**
 * 새 작품 만들기: 유형 → 이름 → 주소(slug) → 한 줄 소개. 초안(draft: true) 파일을 만들고 편집기로 넘어간다.
 */
import { LoaderCircle, Plus } from "lucide-react";
import { type FormEvent, useRef, useState } from "react";

import { adminApi } from "@/lib/admin/client";
import { SLUG_RE, SUMMARY_MAX, suggestSlug } from "@/lib/admin/fields";
import type { AdminIssue } from "@/lib/admin/types";
import { ASSET_TYPES, type AssetType } from "@/lib/asset-types";
import { TYPE_ACTIONS, TYPE_LABELS } from "@/lib/labels";
import { TYPE_STYLE } from "@/lib/type-style";

import { buttonClass, cx } from "../ui";
import { TextField } from "./controls";

export function CreateAssetButton({ existing, onCreated }: { existing: string[]; onCreated: (slug: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<AssetType>("web-app");
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [summary, setSummary] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; issues?: AdminIssue[] } | null>(null);

  const effectiveSlug = slugTouched ? slug : suggestSlug(title);
  const slugError = !effectiveSlug
    ? undefined
    : !SLUG_RE.test(effectiveSlug)
      ? "영문 소문자·숫자·하이픈만 씁니다 (예: hardware-monitor)"
      : existing.includes(effectiveSlug)
        ? "같은 주소의 작품이 이미 있습니다"
        : undefined;

  function open() {
    setType("web-app");
    setTitle("");
    setSlug("");
    setSlugTouched(false);
    setSummary("");
    setDate("");
    setError(null);
    dialog.current?.showModal();
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim() || !effectiveSlug || slugError || summary.length > SUMMARY_MAX) {
      setError({ message: !title.trim() ? "이름을 써 주세요." : !effectiveSlug ? "주소(slug)를 써 주세요." : (slugError ?? "한 줄 소개가 너무 깁니다.") });
      return;
    }
    setBusy(true);
    setError(null);
    const r = await adminApi.create({ slug: effectiveSlug, type, title, summary: summary || undefined, date: date || undefined });
    setBusy(false);
    if (!r.ok) {
      setError({ message: r.error.message, issues: r.error.issues });
      return;
    }
    dialog.current?.close();
    onCreated(r.data.slug);
  }

  return (
    <>
      <button type="button" onClick={open} className={buttonClass("primary")}>
        <Plus aria-hidden="true" className="size-4" />새 작품
      </button>

      <dialog
        ref={dialog}
        aria-labelledby="create-title"
        className="m-auto max-h-[92dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-card border border-line-strong bg-surface p-6 text-fg shadow-2xl shadow-black/60 sm:p-8 light:shadow-black/15"
      >
        <form onSubmit={submit} noValidate>
          <h2 id="create-title" className="text-xl font-bold">
            새 작품 등록
          </h2>
          <p className="mt-1 text-sm text-fg-muted">초안으로 만들어집니다. 개발 미리보기에만 보이고, 내용을 채운 뒤 공개합니다.</p>

          <fieldset className="mt-6">
            <legend className="text-sm font-semibold text-fg">유형</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {ASSET_TYPES.map((t) => {
                const { icon: Icon, ink } = TYPE_STYLE[t];
                const checked = type === t;
                return (
                  <label
                    key={t}
                    className={cx(
                      "flex cursor-pointer gap-3 rounded-xl border p-3 transition-colors focus-within:outline-2 focus-within:outline-accent",
                      checked ? "border-accent bg-raised" : "border-line hover:border-line-strong",
                    )}
                  >
                    <input type="radio" name="asset-type" value={t} checked={checked} onChange={() => setType(t)} className="sr-only" />
                    <Icon aria-hidden="true" className={cx("mt-0.5 size-5 shrink-0", ink)} />
                    <span>
                      <span className="block text-sm font-semibold text-fg">{TYPE_LABELS[t]}</span>
                      <span className="block text-xs text-fg-subtle">{TYPE_ACTIONS[t]}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-6 grid gap-5">
            <TextField label="이름" required value={title} onChange={setTitle} placeholder="하드웨어 모니터링 앱" />
            <TextField
              label="주소 (slug)"
              required
              mono
              value={effectiveSlug}
              onChange={(v) => {
                setSlugTouched(true);
                setSlug(v.toLowerCase());
              }}
              placeholder="hardware-monitor"
              hint={`/library/${effectiveSlug || "<slug>"}/ 가 됩니다. 나중에 바꾸면 즐겨찾기·외부 링크가 깨지므로 신중히 정해 주세요.`}
              error={slugError}
            />
            <TextField
              label="한 줄 소개 (나중에 써도 됩니다)"
              counter={SUMMARY_MAX}
              value={summary}
              onChange={setSummary}
              placeholder="CPU·GPU 온도와 사용률을 작은 창에 띄워 주는 Windows 도구"
            />
            <TextField label="날짜 (선택)" value={date} onChange={setDate} placeholder="2025-12" hint="시작했거나 공개한 날: YYYY, YYYY-MM, YYYY-MM-DD" />
          </div>

          {error && (
            <div role="alert" className="mt-5 text-sm text-danger">
              <p>{error.message}</p>
              {error.issues && (
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {error.issues.map((i) => (
                    <li key={`${i.path}:${i.message}`}>{i.path ? `${i.path}: ${i.message}` : i.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="mt-8 flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => dialog.current?.close()} className={buttonClass("ghost")}>
              취소
            </button>
            <button type="submit" disabled={busy} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
              {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
              초안 만들기
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
