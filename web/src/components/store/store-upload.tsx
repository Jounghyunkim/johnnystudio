"use client";

import { CheckCircle2, FileUp, LoaderCircle, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { type DragEvent, type FormEvent, type ReactNode, useEffect, useId, useState } from "react";

import { loginHref, useSession } from "@/lib/auth";
import { useIsClient } from "@/lib/bookmarks";
import { formatBytes } from "@/lib/format";
import {
  ACCEPT,
  ARCH_LABELS,
  type Analysis,
  type StoreApp,
  type StoreMe,
  type StoreMeta,
  appHref,
  loadRemote,
  parseAppCode,
  setRemote,
  storeApi,
  storeListingApi,
  useRemote,
} from "@/lib/store";
import { LISTING_LIMITS, emptyPage, listingEditHref } from "@/lib/listing";
import { type ListingDraft, newDraft, saveListing } from "@/lib/listing-draft";
import { useLocationSearch } from "@/lib/use-location-search";

import { ListingEditor, importListing } from "../listing/listing-editor";
import { ListingKit } from "../listing/listing-kit";
import { ButtonLink, buttonClass, cx } from "../ui";
import { AppIcon, ErrorBox, Loading, inputClass, panelClass } from "./store-ui";

const EXTENSIONS = ACCEPT.split(",");

function Field({ id, label, hint, children }: { id: string; label: string; hint?: string; children: ReactNode }) {
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

/** 처음 올리기 전: 표시 이름, Store·Showroom 이용약관 동의, 만 14세 확인 (Showroom 등록 화면도 쓴다) */
export function PublisherForm({ me }: { me: StoreMe }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ids = { name: useId(), terms: useId(), age: useId() };

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError(null);
    const r = await storeApi.setPublisher({
      display_name: String(form.get("display_name") ?? ""),
      agree_terms: form.get("agree_terms") === "on",
      age_14: form.get("age_14") === "on",
    });
    setBusy(false);
    if (r.ok) setRemote<StoreMe>("me", { ...me, publisher: r.data.publisher });
    else setError(r.message);
  }

  return (
    <form onSubmit={submit} className={cx(panelClass, "space-y-5")}>
      <div>
        <h2 className="text-lg font-semibold text-fg">{me.publisher ? "바뀐 이용약관 확인" : "올리기 전에"}</h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          {me.publisher
            ? "Store·Showroom 이용약관이 바뀌었습니다. 확인하고 다시 동의해 주세요."
            : "앱·서비스 화면에 보일 표시 이름을 정하고 Store·Showroom 이용약관에 동의해 주세요. 이메일 주소는 다른 사람에게 보이지 않습니다."}
        </p>
      </div>
      <Field id={ids.name} label="표시 이름" hint="2~30자. 앱 화면에 '올린 사람'으로 보입니다. 운영자로 오해할 수 있는 이름은 쓸 수 없습니다.">
        <input id={ids.name} name="display_name" required minLength={2} maxLength={30} defaultValue={me.publisher?.display_name ?? ""} className={cx(inputClass, "h-12")} />
      </Field>
      <div className="space-y-3 text-sm text-fg">
        <label htmlFor={ids.terms} className="flex items-start gap-3">
          <input id={ids.terms} name="agree_terms" type="checkbox" required className="mt-1 size-4 accent-accent" />
          <span>
            <Link href="/store/terms/" target="_blank" className="underline underline-offset-4">
              Store·Showroom 이용약관
            </Link>
            에 동의합니다. 악성코드·피싱이나 다른 사람의 권리를 침해하는 프로그램·서비스는 올리지 않습니다.
          </span>
        </label>
        <label htmlFor={ids.age} className="flex items-start gap-3">
          <input id={ids.age} name="age_14" type="checkbox" required className="mt-1 size-4 accent-accent" />
          <span>만 14세 이상입니다.</span>
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
        {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
        동의하고 계속하기
      </button>
    </form>
  );
}

/** 설치 파일 분석 결과 (아이콘·형식·아키텍처·서명·SHA-256·경고) */
function AnalysisPanel({ a }: { a: Analysis }) {
  return (
    <section aria-label="파일 분석 결과" className={panelClass}>
      <div className="flex items-start gap-4">
        {a.icon ? (
          <img src={a.icon} alt="파일에서 찾은 아이콘" width={256} height={256} className="size-16 shrink-0 rounded-2xl bg-raised" />
        ) : (
          <AppIcon code="none" hasIcon={false} name="" className="size-16 shrink-0" />
        )}
        <div className="min-w-0">
          <p className="break-all font-semibold text-fg">{a.file_name}</p>
          <p className="mt-1 text-sm text-fg-subtle">
            {[formatBytes(a.size), a.file_type.toUpperCase(), ARCH_LABELS[a.arch] ?? a.arch, a.signed ? "코드 서명 포함" : "코드 서명 없음"].join("  ·  ")}
          </p>
          <p className="mt-2 break-all font-mono text-xs text-fg-subtle">SHA-256 {a.sha256}</p>
        </div>
      </div>
      {a.warnings.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-amber-300 light:text-amber-800">
          {a.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2">
              <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              {w}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 새 앱: 분석 결과 → AI 키트(프롬프트 복사·소개 자료 불러오기) → 소개 자료 편집 → 버전 → 검토 요청 (ADR-0013).
 * 앱을 만든 뒤 아이콘·그림·소개 자료를 이어서 올린다. 그림 하나가 실패해도 앱은 접수된다.
 */
function NewAppForm({ analysis: a, meta, onDone, onCancel }: { analysis: Analysis; meta: StoreMeta; onDone: (app: StoreApp, failed: string[]) => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<ListingDraft>(() =>
    newDraft(
      { name: a.suggested.name, summary: a.suggested.summary, version: a.suggested.version, category: "utility" in meta.categories ? "utility" : Object.keys(meta.categories)[0] },
      { ...emptyPage(), developer: a.company_name.slice(0, LISTING_LIMITS.developer), copyright: a.legal_copyright.slice(0, LISTING_LIMITS.copyright) },
    ),
  );
  const [arch, setArch] = useState(a.arch);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ids = { version: useId(), arch: useId(), notes: useId() };
  const msCategories = meta.listing.ms_categories;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setBusy("앱을 접수하는 중");
    const r = await storeApi.createApp({
      upload_id: a.upload_id,
      name: draft.name,
      summary: draft.summary,
      description: draft.description,
      category: draft.category,
      version: draft.version,
      notes: draft.notes,
      arch,
    });
    if (!r.ok) {
      setBusy(null);
      return setError(r.message);
    }
    const s = await saveListing(storeListingApi, r.data.code, draft, setBusy);
    const failed = s.ok ? s.failed : [...s.failed, `소개 자료: ${s.message}`];
    const fresh = await storeApi.app(r.data.code);
    setBusy(null);
    const app = fresh.ok ? fresh.data : r.data;
    setRemote(`app:${app.code}`, app);
    onDone(app, failed);
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <AnalysisPanel a={a} />
      <ListingKit
        kind="store"
        categories={meta.categories}
        msCategories={msCategories}
        onImport={async (imp) => {
          const r = await importListing(draft, imp, meta.categories, msCategories);
          setDraft(r.draft);
          return r.notes;
        }}
      />
      <ListingEditor kind="store" draft={draft} onChange={setDraft} categories={meta.categories} msCategories={msCategories} iconSrc={a.icon} releaseNotes />
      <fieldset className={cx(panelClass, "space-y-5")}>
        <legend className="sr-only">버전</legend>
        <p aria-hidden="true" className="text-base font-semibold text-fg">
          버전
        </p>
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id={ids.version} label="버전" hint="예: 1.2.0">
            <input id={ids.version} required maxLength={40} value={draft.version} onChange={(e) => setDraft({ ...draft, version: e.target.value })} className={cx(inputClass, "h-12 font-mono")} />
          </Field>
          <Field id={ids.arch} label="아키텍처" hint="설치 프로그램은 32비트라도 64비트 앱을 깔 수 있습니다.">
            <select id={ids.arch} value={arch} onChange={(e) => setArch(e.target.value)} className={cx(inputClass, "h-12")}>
              {Object.entries(ARCH_LABELS).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field id={ids.notes} label="바뀐 점 (선택)" hint={`${LISTING_LIMITS.notes}자까지 (Microsoft Store 의 '이번 버전의 새로운 기능'과 같은 한도)`}>
          <textarea id={ids.notes} maxLength={LISTING_LIMITS.notes} rows={3} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} className={cx(inputClass, "py-3")} />
        </Field>
      </fieldset>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={busy !== null} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
          {busy && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
          {busy ?? "검토 요청하기"}
        </button>
        <button type="button" disabled={busy !== null} onClick={onCancel} className={buttonClass("ghost")}>
          취소하고 파일 지우기
        </button>
      </div>
    </form>
  );
}

type Phase = { step: "pick"; error?: string } | { step: "uploading"; name: string; ratio: number } | { step: "form"; analysis: Analysis } | { step: "done"; app: StoreApp; failed: string[] };

function Uploader({ me, meta, target }: { me: StoreMe; meta: StoreMeta; target: StoreApp | null }) {
  const [phase, setPhase] = useState<Phase>({ step: "pick" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const ids = { file: useId(), version: useId(), notes: useId(), arch: useId() };
  const { limits, usage } = me;

  async function start(file: File) {
    const lower = file.name.toLowerCase();
    if (!EXTENSIONS.some((ext) => lower.endsWith(ext))) return setPhase({ step: "pick", error: `올릴 수 있는 형식은 ${EXTENSIONS.join(" ")} 입니다.` });
    if (file.size > limits.file_max_bytes) return setPhase({ step: "pick", error: `파일이 너무 큽니다. ${formatBytes(limits.file_max_bytes)}까지 올릴 수 있습니다.` });
    if (file.size === 0) return setPhase({ step: "pick", error: "빈 파일입니다." });
    setPhase({ step: "uploading", name: file.name, ratio: 0 });
    const r = await storeApi.upload(file, (ratio) => setPhase({ step: "uploading", name: file.name, ratio }));
    if (r.ok) setPhase({ step: "form", analysis: r.data });
    else setPhase({ step: "pick", error: r.message });
    void loadRemote("me", storeApi.me);
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) void start(file);
  }

  async function submit(e: FormEvent<HTMLFormElement>, analysis: Analysis) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const text = (k: string) => String(f.get(k) ?? "");
    setSaving(true);
    setError(null);
    if (!target) return;
    const release = { upload_id: analysis.upload_id, version: text("version"), notes: text("notes"), arch: text("arch") };
    const r = await storeApi.addRelease(target.code, release);
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setRemote(`app:${r.data.code}`, r.data);
    setPhase({ step: "done", app: r.data, failed: [] });
  }

  async function cancel(analysis: Analysis) {
    await storeApi.cancelUpload(analysis.upload_id);
    setPhase({ step: "pick" });
    void loadRemote("me", storeApi.me);
  }

  if (phase.step === "done") {
    return (
      <div role="status" className={panelClass}>
        <p className="flex items-center gap-2 text-lg font-semibold text-fg">
          <CheckCircle2 aria-hidden="true" className="size-5 text-accent" />
          접수했습니다
        </p>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          바이러스 검사를 거쳐 운영자가 검토한 뒤 공개합니다. 결과는 <Link href="/store/mine/" className="underline underline-offset-4">내 앱</Link>에서 볼 수 있습니다.
        </p>
        {phase.failed.length > 0 && (
          <ul role="alert" className="mt-3 space-y-1 text-sm text-danger">
            {phase.failed.map((f) => (
              <li key={f}>{f}</li>
            ))}
            <li className="text-fg-muted">&lsquo;소개 꾸미기&rsquo;에서 다시 올릴 수 있습니다.</li>
          </ul>
        )}
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={appHref(phase.app.code)}>앱 화면 보기</ButtonLink>
          <ButtonLink href={listingEditHref(phase.app.code)} variant="secondary">
            소개 꾸미기
          </ButtonLink>
          <ButtonLink href="/store/mine/" variant="secondary">
            내 앱
          </ButtonLink>
        </div>
      </div>
    );
  }

  if (phase.step === "form" && !target) {
    const analysis = phase.analysis;
    return <NewAppForm analysis={analysis} meta={meta} onDone={(app, failed) => setPhase({ step: "done", app, failed })} onCancel={() => void cancel(analysis)} />;
  }

  if (phase.step === "form") {
    const a = phase.analysis;
    return (
      <form onSubmit={(e) => submit(e, a)} className="space-y-6">
        <AnalysisPanel a={a} />

        <div className={cx(panelClass, "space-y-5")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field id={ids.version} label="버전" hint="예: 1.2.0">
              <input id={ids.version} name="version" required maxLength={40} defaultValue={a.suggested.version} className={cx(inputClass, "h-12 font-mono")} />
            </Field>
            <Field id={ids.arch} label="아키텍처" hint="설치 프로그램은 32비트라도 64비트 앱을 깔 수 있습니다.">
              <select id={ids.arch} name="arch" defaultValue={a.arch} className={cx(inputClass, "h-12")}>
                {Object.entries(ARCH_LABELS).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <Field id={ids.notes} label="바뀐 점 (선택)" hint="1500자까지 (Microsoft Store 의 '이번 버전의 새로운 기능'과 같은 한도)">
            <textarea id={ids.notes} name="notes" maxLength={1500} rows={3} className={cx(inputClass, "py-3")} />
          </Field>
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <div className="flex flex-wrap gap-3">
          <button type="submit" disabled={saving} className={cx(buttonClass("primary"), "disabled:opacity-60")}>
            {saving && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            검토 요청하기
          </button>
          <button type="button" onClick={() => void cancel(a)} className={buttonClass("ghost")}>
            취소하고 파일 지우기
          </button>
        </div>
      </form>
    );
  }

  const uploading = phase.step === "uploading";
  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          "rounded-card border-2 border-dashed px-6 py-14 text-center transition-colors",
          dragging ? "border-accent bg-accent/5" : "border-line-strong bg-surface",
        )}
      >
        {uploading ? (
          <div aria-live="polite">
            <p className="font-semibold text-fg">{phase.ratio < 1 ? "올리는 중" : "파일을 분석하는 중"}</p>
            <p className="mt-1 break-all text-sm text-fg-muted">{phase.name}</p>
            <div className="mx-auto mt-5 h-2 max-w-sm overflow-hidden rounded-full bg-raised">
              <progress value={Math.round(phase.ratio * 100)} max={100} className="sr-only">
                {Math.round(phase.ratio * 100)}%
              </progress>
              <div aria-hidden="true" className={cx("h-full rounded-full bg-accent transition-[width]", PROGRESS[Math.min(10, Math.floor(phase.ratio * 10))])} />
            </div>
            <p className="mt-2 text-xs tabular-nums text-fg-subtle">{Math.round(phase.ratio * 100)}%</p>
          </div>
        ) : (
          <>
            <FileUp aria-hidden="true" className="mx-auto size-8 text-fg-subtle" />
            <p className="mt-3 font-semibold text-fg">{target ? `${target.name}의 새 버전 파일을 여기에 놓으세요` : "설치 파일을 여기에 놓으세요"}</p>
            <p className="mt-1 text-sm text-fg-muted">
              {EXTENSIONS.join(" ")} · {formatBytes(limits.file_max_bytes)}까지
            </p>
            <label htmlFor={ids.file} className={cx(buttonClass("secondary"), "mt-5 cursor-pointer focus-within:outline-2 focus-within:outline-accent")}>
              파일 고르기
              <input
                id={ids.file}
                type="file"
                accept={ACCEPT}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void start(file);
                  e.target.value = "";
                }}
              />
            </label>
            <p className="mt-4 text-xs text-fg-subtle">파일을 놓으면 이름·버전·아키텍처·아이콘을 읽어 양식을 채웁니다.</p>
          </>
        )}
      </div>
      {phase.step === "pick" && phase.error && (
        <p role="alert" className="text-sm text-danger">
          {phase.error}
        </p>
      )}
      <p className="text-xs text-fg-subtle">
        올려 둔 파일 {formatBytes(usage.bytes_used)} / {formatBytes(limits.user_quota_bytes)} · 24시간 동안 {usage.uploads_24h} / {limits.daily_uploads}번
      </p>
    </div>
  );
}

// 진행 막대 너비 (인라인 style 을 쓰지 않는다: CSP style-src 'self')
const PROGRESS = ["w-0", "w-1/10", "w-2/10", "w-3/10", "w-4/10", "w-5/10", "w-6/10", "w-7/10", "w-8/10", "w-9/10", "w-full"];

/** /store/new/ (새 앱) · /store/new/?app=코드 (새 버전) */
export function StoreUpload() {
  const session = useSession();
  const isClient = useIsClient();
  const [search] = useLocationSearch();
  const targetCode = parseAppCode(new URLSearchParams(search).get("app"));
  const signedIn = session.status === "signed-in";
  const me = useRemote<StoreMe>(signedIn ? "me" : null);
  const meta = useRemote<StoreMeta>("meta");
  const target = useRemote<StoreApp>(signedIn && targetCode ? `app:${targetCode}` : null);

  useEffect(() => {
    void loadRemote("meta", storeApi.meta);
  }, []);
  useEffect(() => {
    if (signedIn) void loadRemote("me", storeApi.me);
  }, [signedIn]);
  useEffect(() => {
    if (signedIn && targetCode) void loadRemote(`app:${targetCode}`, () => storeApi.app(targetCode));
  }, [signedIn, targetCode]);

  if (!isClient || session.status === "loading") return <Loading>로그인 상태를 확인하는 중입니다…</Loading>;
  if (session.status === "unavailable") return <ErrorBox error={{ ok: false, status: 0, code: "unavailable", message: "회원 서버에 연결할 수 없습니다. 잠시 뒤 다시 시도해 주세요." }} />;
  if (session.status === "signed-out") {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">로그인이 필요합니다</p>
        <p className="mt-2 text-sm text-fg-muted">앱을 올리려면 로그인하세요. 처음이면 이메일 인증으로 가입합니다.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink href={loginHref(`/store/new/${search}`)}>로그인</ButtonLink>
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
        <p className="font-semibold text-danger">이 계정은 Store에 앱을 올릴 수 없습니다</p>
        {m.publisher.blocked_reason && <p className="mt-2 text-sm text-fg-muted">사유: {m.publisher.blocked_reason}</p>}
        <p className="mt-2 text-sm text-fg-muted">이의가 있으면 운영자에게 문의해 주세요 (이용약관 제10조).</p>
      </div>
    );
  }
  if (!m.uploads_open && !m.admin) {
    return (
      <div className={panelClass}>
        <p className="font-semibold text-fg">지금은 새 앱을 받지 않습니다</p>
        <p className="mt-2 text-sm text-fg-muted">잠시 뒤 다시 확인해 주세요. 이미 공개된 앱은 그대로 내려받을 수 있습니다.</p>
      </div>
    );
  }
  if (!m.publisher || !m.publisher.terms_current) return <PublisherForm me={m} />;

  if (targetCode) {
    if (!target || target.status === "loading") return <Loading />;
    if (target.status === "error") return <ErrorBox error={target.error} title="새 버전을 올릴 앱을 찾지 못했습니다" />;
    if (!target.data.viewer?.owner) return <ErrorBox error={{ ok: false, status: 403, code: "not_owner", message: "내가 올린 앱에만 새 버전을 올릴 수 있습니다." }} />;
  }
  return <Uploader me={m} meta={meta.data} target={targetCode && target?.status === "ready" ? target.data : null} />;
}
