"use client";

/**
 * AI 로 소개 자료 만들기 + 불러오기 (ADR-0013).
 * 프롬프트를 복사해 AI 코딩 도구에 주면 listing.md + images/ 를 묶은 zip 이 나온다. 그 파일을 여기에 놓으면 양식을 채운다.
 */
import { Check, ClipboardCopy, FileDown, FileUp, LoaderCircle, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { type DragEvent, useEffect, useId, useRef, useState } from "react";

import type { ListingKind } from "@/lib/listing";
import { BUNDLE_ACCEPT, BundleError, type ImportedListing, readListingFile } from "@/lib/listing-bundle";
import { listingPrompt, listingTemplate } from "@/lib/listing-prompt";

import { buttonClass, cx } from "../ui";
import { panelClass } from "../store/store-ui";

/** 프롬프트 복사 버튼 (안내 페이지도 쓴다) */
export function PromptCopyButton({ kind, categories, msCategories, className }: { kind: ListingKind; categories: Record<string, string>; msCategories: Record<string, string>; className?: string }) {
  const [state, setState] = useState<"idle" | "done" | "fail">("idle");
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    try {
      await navigator.clipboard.writeText(listingPrompt(kind, categories, window.location.origin, msCategories));
      setState("done");
    } catch {
      setState("fail");
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState("idle"), 2500);
  }
  return (
    <button type="button" onClick={copy} className={cx(buttonClass("primary"), className)}>
      {state === "done" ? <Check aria-hidden="true" className="size-4" /> : <ClipboardCopy aria-hidden="true" className="size-4" />}
      {state === "done" ? "복사했습니다" : state === "fail" ? "복사하지 못했습니다" : "AI 프롬프트 복사"}
      <span aria-live="polite" className="sr-only">
        {state === "done" ? "프롬프트를 클립보드에 복사했습니다" : ""}
      </span>
    </button>
  );
}

/** listing.md 견본 내려받기 */
export function TemplateLink({ kind, categories, msCategories }: { kind: ListingKind; categories: Record<string, string>; msCategories: Record<string, string> }) {
  const href = `data:text/markdown;charset=utf-8,${encodeURIComponent(listingTemplate(kind, categories, msCategories))}`;
  return (
    <a href={href} download="listing.md" className={buttonClass("secondary")}>
      <FileDown aria-hidden="true" className="size-4" />
      양식(listing.md) 내려받기
    </a>
  );
}

export function PromptPreview({ kind, categories, msCategories }: { kind: ListingKind; categories: Record<string, string>; msCategories: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)} className="text-sm">
      <summary className="cursor-pointer text-fg-muted hover:text-fg">프롬프트 내용 보기</summary>
      {open && <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-canvas p-4 font-mono text-xs leading-relaxed text-fg-muted">{listingPrompt(kind, categories, window.location.origin, msCategories)}</pre>}
    </details>
  );
}

type ImportState = { step: "idle" } | { step: "reading"; name: string } | { step: "done"; summary: string; warnings: string[] } | { step: "error"; message: string };

function summarize(imp: ImportedListing): string {
  const parts = [
    imp.fields.name && `이름`,
    imp.fields.summary && `한 줄 소개`,
    imp.fields.description && `상세 설명`,
    imp.features.length && `기능 ${imp.features.length}개`,
    imp.steps.length && `사용 방법 ${imp.steps.length}단계`,
    imp.faq.length && `질문 ${imp.faq.length}개`,
    imp.links.length && `링크 ${imp.links.length}개`,
    imp.keywords.length && `검색어 ${imp.keywords.length}개`,
    imp.files.size && `그림 ${imp.files.size}장`,
  ].filter(Boolean);
  return parts.length ? `${imp.sourceName}에서 채웠습니다: ${parts.join(" · ")}` : `${imp.sourceName}에서 채울 값을 찾지 못했습니다.`;
}

/**
 * AI 키트 + 불러오기. onImport 가 양식에 값을 넣고, 넣으면서 생긴 알림을 돌려준다.
 * expected: 이 화면의 종류. 파일의 kind 가 다르면 알린다 (값은 채운다)
 */
export function ListingKit({
  kind,
  categories,
  msCategories,
  onImport,
}: {
  kind: ListingKind;
  categories: Record<string, string>;
  msCategories: Record<string, string>;
  onImport: (imp: ImportedListing) => Promise<string[]>;
}) {
  const [state, setState] = useState<ImportState>({ step: "idle" });
  const [dragging, setDragging] = useState(false);
  const inputId = useId();

  async function load(file: File) {
    setState({ step: "reading", name: file.name });
    try {
      const imp = await readListingFile(file);
      const notes = await onImport(imp);
      const warnings = [...imp.warnings, ...notes];
      if (imp.kind && imp.kind !== kind) warnings.unshift(`이 파일은 ${imp.kind === "store" ? "Store(Windows 앱)" : "Showroom(웹 서비스)"}용으로 만든 것입니다. 값은 채웠으니 확인해 주세요.`);
      setState({ step: "done", summary: summarize(imp), warnings });
    } catch (err) {
      setState({ step: "error", message: err instanceof BundleError ? err.message : "파일을 읽지 못했습니다." });
    }
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void load(file);
  }

  return (
    <section aria-labelledby={`${inputId}-title`} className={cx(panelClass, "space-y-5")}>
      <div>
        <h2 id={`${inputId}-title`} className="flex items-center gap-2 text-base font-semibold text-fg">
          <Sparkles aria-hidden="true" className="size-4 text-accent" />
          AI로 소개 자료 만들기
        </h2>
        <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-fg-muted">
          <li>
            <strong className="font-semibold text-fg">프롬프트를 복사</strong>해 {kind === "store" ? "앱" : "서비스"} 저장소를 연 AI 코딩 도구(Claude Code, Gemini CLI 등)에 붙여 넣습니다.
          </li>
          <li>
            AI가 코드를 읽고 소개 글·{kind === "showroom" ? "화면 캡처(Playwright)" : "화면 그림"}·아이콘을 만들어 <code className="font-mono text-xs">johnnystudio-listing.zip</code>으로 묶습니다.
          </li>
          <li>그 zip(또는 listing.md)을 아래에 놓으면 양식이 채워집니다. 확인하고 고친 뒤 검토를 요청하세요.</li>
          <li>같은 자료로 Microsoft Store 에도 올릴 수 있습니다. 항목과 글자 수가 Partner Center 와 같고, 아래 &lsquo;Microsoft Store 제출용 항목&rsquo;에서 칸별로 복사합니다.</li>
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <PromptCopyButton kind={kind} categories={categories} msCategories={msCategories} />
          <TemplateLink kind={kind} categories={categories} msCategories={msCategories} />
          <Link href="/store/guide/" target="_blank" className="text-sm text-fg-muted underline underline-offset-4 hover:text-fg">
            항목·양식 안내
          </Link>
        </div>
        <div className="mt-3">
          <PromptPreview kind={kind} categories={categories} msCategories={msCategories} />
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx("rounded-xl border-2 border-dashed px-5 py-6 text-center transition-colors", dragging ? "border-accent bg-accent/5" : "border-line-strong")}
      >
        {state.step === "reading" ? (
          <p aria-live="polite" className="flex items-center justify-center gap-2 text-sm text-fg-muted">
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            {state.name} 읽는 중
          </p>
        ) : (
          <>
            <p className="text-sm font-semibold text-fg">소개 자료 불러오기</p>
            <p className="mt-1 text-xs text-fg-subtle">listing.md 와 images 폴더를 묶은 .zip, 또는 listing.md 하나 (그림은 아래에서 따로 고릅니다)</p>
            <label htmlFor={inputId} className={cx(buttonClass("secondary", "sm"), "mt-4 cursor-pointer focus-within:outline-2 focus-within:outline-accent")}>
              <FileUp aria-hidden="true" className="size-4" />
              파일 고르기
              <input
                id={inputId}
                type="file"
                accept={BUNDLE_ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void load(file);
                  e.target.value = "";
                }}
              />
            </label>
          </>
        )}
      </div>

      {state.step === "done" && (
        <div role="status" className="space-y-2 text-sm">
          <p className="flex items-start gap-2 text-fg">
            <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-accent" />
            {state.summary}
          </p>
          {state.warnings.length > 0 && (
            <ul className="space-y-1 text-amber-300 light:text-amber-800">
              {state.warnings.map((w) => (
                <li key={w} className="flex items-start gap-2">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                  {w}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {state.step === "error" && (
        <p role="alert" className="text-sm text-danger">
          {state.message}
        </p>
      )}
    </section>
  );
}
