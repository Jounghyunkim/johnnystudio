"use client";

import { Download, Flag, LoaderCircle, Pencil, ShieldAlert, ShieldCheck, Trash2, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, type RefObject, useEffect, useId, useRef, useState } from "react";

import type { ApiResult } from "@/lib/auth";
import { storeBookmarkId } from "@/lib/bookmarks";
import { formatBytes } from "@/lib/format";
import { galleryImageSrc, listingEditHref, pageOf } from "@/lib/listing";
import {
  APP_STATUS_LABELS,
  ARCH_LABELS,
  RELEASE_STATUS_LABELS,
  type StoreApp,
  type StoreMeta,
  type StoreRelease,
  loadRemote,
  localDate,
  parseAppCode,
  storeApi,
  useRemote,
  virusTotalHref,
} from "@/lib/store";
import { useIsClient } from "@/lib/bookmarks";
import { useLocationSearch } from "@/lib/use-location-search";

import { CopyButton } from "../copy-button";
import { KeywordChips, ListingFacts, ListingMain } from "../listing/listing-view";
import { StarButton } from "../star-button";
import { ButtonLink, ExternalButton, buttonClass, cx } from "../ui";
import { type DeleteTarget, DeleteDialog } from "./store-edit";
import { AppIcon, ErrorBox, Loading, Pill, PlainText, ScanBadge, dialogClass, inputClass, panelClass, statusTone } from "./store-ui";

function ReleaseFacts({ r }: { r: StoreRelease }) {
  const facts = [
    ARCH_LABELS[r.arch] ?? r.arch,
    r.file_type.toUpperCase() + (r.is_installer ? " 설치 프로그램" : ""),
    formatBytes(r.size),
    r.created_at && `${localDate(r.created_at)} 등록`,
  ].filter(Boolean);
  return <p className="mt-1 text-sm text-fg-subtle">{facts.join("  ·  ")}</p>;
}

function Checksum({ r }: { r: StoreRelease }) {
  return (
    <div className="mt-5 rounded-xl border border-line bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-fg-subtle">SHA-256</p>
        <CopyButton value={r.sha256} label="SHA-256 체크섬" />
      </div>
      <p className="mt-2 break-all font-mono text-xs leading-relaxed text-fg-muted">{r.sha256}</p>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-fg-muted hover:text-fg">파일이 맞는지 확인하는 방법</summary>
        <div className="mt-3 space-y-2 text-fg-muted">
          <p>내려받은 파일의 값이 위 체크섬과 같으면 올라온 파일 그대로입니다.</p>
          <pre className="overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs text-fg">{`# Windows (PowerShell)\nGet-FileHash ".\\${r.file_name}" -Algorithm SHA256`}</pre>
        </div>
      </details>
    </div>
  );
}

/** onDelete: 올린 사람·운영자에게만 '이 버전 지우기' */
function ReleasePanel({ r, review, onDelete }: { r: StoreRelease; review: boolean; onDelete?: () => void }) {
  return (
    <section aria-label={`버전 ${r.version}`} className={panelClass}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
            버전 <span className="font-mono">{r.version}</span>
            {r.status && r.status !== "published" && <Pill tone={statusTone(r.status)}>{RELEASE_STATUS_LABELS[r.status]}</Pill>}
          </p>
          <ReleaseFacts r={r} />
        </div>
        {r.stored !== false && (
          <a href={r.download_url} download className={buttonClass(review ? "secondary" : "primary")}>
            <Download aria-hidden="true" className="size-4" />
            {review ? "검토용 내려받기" : "내려받기"}
            <span className="sr-only">: {r.file_name}</span>
          </a>
        )}
      </div>

      {r.status_reason && <p className="mt-4 text-sm text-danger">사유: {r.status_reason}</p>}
      {r.notes && <PlainText text={r.notes} className="mt-4 text-sm text-fg-muted" />}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <ScanBadge scan={r.scan} />
        <ExternalButton href={virusTotalHref(r.sha256)} variant="ghost" size="sm" className="-ml-1">
          VirusTotal에서 찾아보기
        </ExternalButton>
      </div>
      {r.scan.detail && <p className="mt-2 text-xs text-fg-subtle">{r.scan.detail}</p>}

      <Checksum r={r} />

      <p className={cx("mt-4 flex items-start gap-2 text-xs", r.signed ? "text-fg-muted" : "text-fg-subtle")}>
        {r.signed ? <ShieldCheck aria-hidden="true" className="mt-px size-4 shrink-0" /> : <ShieldAlert aria-hidden="true" className="mt-px size-4 shrink-0" />}
        {r.signed
          ? "코드 서명이 들어 있습니다 (서명이 유효한지는 확인하지 않았습니다)."
          : "코드 서명이 없어서 Windows가 경고(SmartScreen)를 띄울 수 있습니다. 체크섬으로 파일을 확인하세요."}
      </p>
      {(r.company_name || r.inner_path) && (
        <p className="mt-2 text-xs text-fg-subtle">
          {r.company_name && <>파일에 적힌 개발사: {r.company_name}</>}
          {r.company_name && r.inner_path && " · "}
          {r.inner_path && <>압축 안의 실행 파일: {r.inner_path}</>}
        </p>
      )}
      {onDelete && (
        <div className="mt-4 border-t border-line pt-3">
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-medium text-fg-subtle hover:bg-raised hover:text-danger"
          >
            <Trash2 aria-hidden="true" className="size-3.5" />이 버전 지우기<span className="sr-only">: {r.version}</span>
          </button>
        </div>
      )}
    </section>
  );
}

export type ReportBody = { reason: string; detail: string; contact: string };

/** 신고 대화상자 (Store 앱·Showroom 서비스가 함께 쓴다). send 가 실제로 보낸다 */
export function ReportDialog({
  name,
  reasons,
  dialog,
  send,
}: {
  name: string;
  reasons: Record<string, string>;
  dialog: RefObject<HTMLDialogElement | null>;
  send: (body: ReportBody) => Promise<ApiResult<unknown>>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const ids = { reason: useId(), detail: useId(), contact: useId() };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const r = await send({
      reason: String(form.get("reason") ?? ""),
      detail: String(form.get("detail") ?? ""),
      contact: String(form.get("contact") ?? ""),
    });
    setBusy(false);
    if (r.ok) setDone(true);
    else setError(r.message);
  }

  return (
    <dialog ref={dialog} aria-labelledby="report-title" className={dialogClass}>
      <h2 id="report-title" className="text-lg font-semibold">
        앱 신고
      </h2>
      {done ? (
        <>
          <p role="status" className="mt-3 text-sm text-fg-muted">
            신고를 받았습니다. 운영자가 확인한 뒤 필요하면 앱을 내립니다.
          </p>
          <div className="mt-6 flex justify-end">
            <button type="button" onClick={() => dialog.current?.close()} className={buttonClass("secondary")}>
              닫기
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit} className="mt-4 space-y-4">
          <p className="text-sm text-fg-muted">
            <strong className="font-semibold text-fg">{name}</strong>에 문제가 있다면 알려 주세요. 권리 침해 신고는{" "}
            <Link href="/store/terms/#takedown" className="underline underline-offset-4">
              이용약관 제9조
            </Link>
            의 절차를 따릅니다.
          </p>
          <div>
            <label htmlFor={ids.reason} className="block text-sm font-semibold">
              사유
            </label>
            <select id={ids.reason} name="reason" required defaultValue="" className={cx(inputClass, "mt-2 h-11")}>
              <option value="" disabled>
                골라 주세요
              </option>
              {Object.entries(reasons).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor={ids.detail} className="block text-sm font-semibold">
              내용 (10자 이상)
            </label>
            <textarea id={ids.detail} name="detail" required minLength={10} maxLength={4000} rows={4} className={cx(inputClass, "mt-2 py-3")} />
          </div>
          <div>
            <label htmlFor={ids.contact} className="block text-sm font-semibold">
              답을 받을 연락처 (선택)
            </label>
            <input id={ids.contact} name="contact" maxLength={320} autoComplete="email" placeholder="이메일 등" className={cx(inputClass, "mt-2 h-11")} />
            <p className="mt-1 text-xs text-fg-subtle">신고 처리에만 쓰고, 처리한 뒤 1년이 지나면 지웁니다.</p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <button type="button" onClick={() => dialog.current?.close()} className={buttonClass("secondary")}>
              취소
            </button>
            <button type="submit" disabled={busy} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
              {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
              신고하기
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}

/** 앱 상세 (/store/app/?id=코드) */
export function StoreAppView() {
  const [search] = useLocationSearch();
  const isClient = useIsClient();
  const code = parseAppCode(new URLSearchParams(search).get("id"));
  const key = code ? `app:${code}` : null;
  const app = useRemote<StoreApp>(key);
  const meta = useRemote<StoreMeta>("meta");
  const reportDialog = useRef<HTMLDialogElement>(null);
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null);
  const router = useRouter();
  const reloadApp = () => (code ? loadRemote(`app:${code}`, () => storeApi.app(code)) : Promise.resolve());

  useEffect(() => {
    if (code) void loadRemote(`app:${code}`, () => storeApi.app(code));
  }, [code]);
  useEffect(() => {
    void loadRemote("meta", storeApi.meta);
  }, []);

  if (!isClient) return <Loading />;
  if (!code) {
    return (
      <div className={panelClass}>
        <h1 className="text-xl font-semibold text-fg">앱 주소가 올바르지 않습니다</h1>
        <p className="mt-2 text-sm text-fg-muted">
          <Link href="/store/" className="underline underline-offset-4">
            Store 목록
          </Link>
          에서 다시 찾아 주세요.
        </p>
      </div>
    );
  }
  if (!app || app.status === "loading") return <Loading />;
  if (app.status === "error") {
    return app.error.status === 404 ? (
      <div className={panelClass}>
        <h1 className="text-xl font-semibold text-fg">앱을 찾을 수 없습니다</h1>
        <p className="mt-2 text-sm text-fg-muted">
          지워졌거나 아직 공개되지 않은 앱입니다.{" "}
          <Link href="/store/" className="underline underline-offset-4">
            Store 목록으로
          </Link>
        </p>
      </div>
    ) : (
      <ErrorBox error={app.error} />
    );
  }

  const a = app.data;
  const review = Boolean(a.viewer?.owner || a.viewer?.admin) && a.status !== undefined;
  // 이름·설명·분류·아이콘 고치기는 머리글의 '편집'(소개 꾸미기 화면) 하나로 한다 (2026-11-26: 옆 칸의 '정보 고치기'·'아이콘 바꾸기'·'검토 화면'은 겹쳐서 뺐다)
  const asAdmin = Boolean(a.viewer?.admin && !a.viewer.owner);
  const deleteRelease = (r: StoreRelease) => (review ? () => setDeleting({ kind: "release", app: a, id: r.id, version: r.version }) : undefined);
  // 앱을 지우면 이 주소는 404 가 되므로, 올린 사람은 '내 앱'으로, 운영자는 검토 화면으로 간다
  const afterDelete = (t: DeleteTarget) => (t.kind === "app" ? router.replace(asAdmin ? "/store/manage/" : "/store/mine/") : reloadApp());
  const [latest, ...older] = a.releases;
  const page = pageOf(a.page);
  const link = `${window.location.origin}/store/app/?id=${a.code}`;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <AppIcon code={a.code} hasIcon={a.has_icon} name={a.name} version={a.updated_at} className="size-20 shrink-0 sm:size-24" />
        <div className="min-w-0">
          <p className="text-sm text-fg-subtle">
            {a.category_label} · 올린 사람 <span className="text-fg-muted">{a.publisher}</span>
            {a.official && (
              <span className="ml-2 align-middle">
                <Pill tone="ok">공식</Pill>
              </span>
            )}
          </p>
          <h1 className="mt-1 break-words text-3xl font-bold tracking-tight text-fg sm:text-4xl">{a.name}</h1>
          {a.summary && <p className="mt-2 text-base text-fg-muted">{a.summary}</p>}
          {page.keywords.length > 0 && (
            <div className="mt-3">
              <KeywordChips keywords={page.keywords} />
            </div>
          )}
          {/* 즐겨찾기는 공개된 앱만 (My Studio 는 공개 목록에서 찾는다). 편집은 올린 사람·운영자 (소개 꾸미기 화면, API 가 다시 확인한다).
              review 가 아니면 즐겨찾기가, review 면 편집이 보이므로 이 줄은 늘 비지 않는다 */}
          <div className="mt-4 flex flex-wrap gap-2">
            {(!review || a.public) && <StarButton slug={storeBookmarkId(a.code)} title={a.name} withLabel />}
            {review && (
              <ButtonLink href={listingEditHref(a.code)} variant="secondary">
                <Pencil aria-hidden="true" className="size-4" />
                편집
              </ButtonLink>
            )}
          </div>
        </div>
      </header>

      {review && a.status && (a.status !== "published" || !a.public) && (
        <div role="status" className={cx(panelClass, "border-line-strong")}>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-fg">
            <Pill tone={statusTone(a.status)}>{APP_STATUS_LABELS[a.status]}</Pill>
            {a.status === "pending" && "운영자가 검토한 뒤 공개됩니다. 이 화면은 올린 사람과 운영자에게만 보입니다."}
            {a.status === "rejected" && "공개하지 않기로 했습니다."}
            {a.status === "hidden" && "운영자가 공개를 멈췄습니다."}
            {a.status === "published" && !a.public && "공개 상태지만 내려받을 수 있는 버전이 없어 목록에 보이지 않습니다."}
          </p>
          {a.status_reason && <p className="mt-2 text-sm text-fg-muted">사유: {a.status_reason}</p>}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-10">
          <ListingMain
            page={page}
            description={a.description}
            imageSrc={(id) => galleryImageSrc("store", a.code, id)}
            title={a.name}
            lead={
              latest ? (
                <ReleasePanel r={latest} review={review && latest.status !== "published"} onDelete={deleteRelease(latest)} />
              ) : (
                <p className="text-sm text-fg-muted">내려받을 수 있는 버전이 없습니다.</p>
              )
            }
          />

          {older.length > 0 && (
            <details className="rounded-card border border-line">
              <summary className="cursor-pointer px-5 py-4 text-sm font-semibold text-fg-muted hover:text-fg">이전 버전 {older.length}개</summary>
              <div className="space-y-4 px-5 pb-5">
                {older.map((r) => (
                  <ReleasePanel key={r.id} r={r} review={review && r.status !== "published"} onDelete={deleteRelease(r)} />
                ))}
              </div>
            </details>
          )}
        </div>

        <aside className="space-y-5">
          <ListingFacts page={page} kind="store" />
          {a.official ? (
            <div className={panelClass}>
              <p className="flex items-center gap-2 text-sm font-semibold text-fg">
                <Pill tone="ok">공식</Pill>
                JohnnyStudio가 직접 만든 앱입니다
              </p>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                설치 파일의 SHA-256 으로 내려받은 파일이 같은지 확인할 수 있습니다. 만든 이야기와 다른 작품은{" "}
                <Link href="/library/" className="underline underline-offset-4">
                  Library
                </Link>
                에 있습니다.
              </p>
            </div>
          ) : (
            <div className={panelClass}>
              <p className="text-sm font-semibold text-fg">회원이 올린 앱입니다</p>
              <p className="mt-2 text-sm leading-relaxed text-fg-muted">
                운영자가 내용과 바이러스 검사 결과를 보고 공개했지만, 모든 위험을 찾아낸다고 보장하지 않습니다. 믿을 수 있는 개발자의 앱인지 확인하고 설치하세요.
              </p>
              <p className="mt-3 text-xs text-fg-subtle">
                JohnnyStudio가 직접 만든 앱은{" "}
                <Link href="/library/" className="underline underline-offset-4">
                  Library
                </Link>
                에 있습니다.
              </p>
            </div>
          )}
          <div className={panelClass}>
            <p className="text-sm font-semibold text-fg">공유</p>
            <p className="mt-2 break-all font-mono text-xs text-fg-muted">{link}</p>
            <div className="mt-3">
              <CopyButton value={link} label="앱 주소" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {a.viewer?.owner && (
              <ButtonLink href={`/store/new/?app=${a.code}`} variant="secondary" size="sm">
                <Upload aria-hidden="true" className="size-4" />새 버전 올리기
              </ButtonLink>
            )}
            {review && (
              <button type="button" onClick={() => setDeleting({ kind: "app", app: a })} className={buttonClass("danger", "sm")}>
                <Trash2 aria-hidden="true" className="size-4" />
                앱 지우기
              </button>
            )}
            {!a.viewer?.owner && a.status === undefined && meta?.status === "ready" && (
              <button type="button" onClick={() => reportDialog.current?.showModal()} className={buttonClass("ghost", "sm")}>
                <Flag aria-hidden="true" className="size-4" />
                신고
              </button>
            )}
          </div>
        </aside>
      </div>

      {deleting && <DeleteDialog target={deleting} asAdmin={asAdmin} onDone={() => afterDelete(deleting)} onClose={() => setDeleting(null)} />}
      {meta?.status === "ready" && <ReportDialog name={a.name} reasons={meta.data.report_reasons} dialog={reportDialog} send={(body) => storeApi.report(a.code, body)} />}
    </div>
  );
}
