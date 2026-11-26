"use client";

/**
 * 작품 편집기. 머리말을 그대로의 모양(data)으로 고치고, 저장할 때 관리 서버가 스키마로 검사한다.
 * 검사 패널은 "저장된 파일" 기준이다 (공개 버튼도 저장된 내용으로 판단한다).
 */
import { ArrowLeft, ArrowUpRight, CircleAlert, CircleCheck, Eye, EyeOff, LoaderCircle, Save, Trash2, TriangleAlert } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";

import { adminApi, loadAssetDetail } from "@/lib/admin/client";
import { cleanValue, describeMissing, stripForeignFields, SUMMARY_MAX, TYPE_FIELDS, youtubeIdFrom } from "@/lib/admin/fields";
import type { AdminAssetDetail, AdminIssue } from "@/lib/admin/types";
import { ASSET_STATUSES, ASSET_TYPES, type AssetType } from "@/lib/asset-types";
import { STATUS_LABELS, TYPE_LABELS } from "@/lib/labels";

import { DraftBadge, StatusBadge, TypeBadge } from "../badges";
import { buttonClass, cx } from "../ui";
import { CheckboxField, FilePicker, panelClass, Section, SelectField, smallButton, TextArea, TextField } from "./controls";
import { DownloadsField, IMAGE_ACCEPT, LinksField, PhotosField, SingleDownloadField, uploadImage } from "./list-fields";

type Data = Record<string, unknown>;
type Busy = null | "save" | "publish" | "unpublish" | "delete" | "cover" | "icon";

const str = (v: unknown) => (typeof v === "string" ? v : typeof v === "number" ? String(v) : "");
const list = (v: unknown): Data[] => (Array.isArray(v) ? (v as Data[]) : []);
const same = (a: unknown, b: unknown) => JSON.stringify(cleanValue(a)) === JSON.stringify(cleanValue(b));

const DATE_HINT = "YYYY, YYYY-MM, YYYY-MM-DD 중 하나 (예: 2025-12)";

function TagsField({ value, known, onChange }: { value: string[]; known: string[]; onChange: (tags: string[]) => void }) {
  const [text, setText] = useState(value.join(", "));
  const update = (next: string) => {
    setText(next);
    onChange([...new Set(next.split(/[,，]/).map((t) => t.trim().replace(/^#/, "")).filter(Boolean))]);
  };
  const suggestions = known.filter((t) => !value.includes(t)).slice(0, 16);
  return (
    <div>
      <TextField label="태그" value={text} onChange={update} placeholder="AI, RAG, 데스크톱" hint="쉼표로 나눕니다. Library 에서 #태그 로 찾을 수 있습니다." />
      {suggestions.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-fg-subtle">쓰고 있는 태그:</span>
          {suggestions.map((t) => (
            <button key={t} type="button" onClick={() => update(text.trim() ? `${text.replace(/[,\s]+$/, "")}, ${t}` : t)} className={cx(smallButton, "h-7 px-2.5")}>
              #{t}
              <span className="sr-only"> 태그 넣기</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckList({ icon, tone, title, items }: { icon: "error" | "missing" | "warning"; tone: string; title: string; items: string[] }) {
  if (!items.length) return null;
  const Icon = icon === "error" ? CircleAlert : icon === "missing" ? TriangleAlert : CircleCheck;
  return (
    <div>
      <p className={cx("flex items-center gap-1.5 text-sm font-semibold", tone)}>
        <Icon aria-hidden="true" className="size-4" />
        {title} <span className="tabular-nums">{items.length}</span>
      </p>
      <ul className="mt-2 grid gap-1.5 text-sm text-fg-muted">
        {items.map((t) => (
          <li key={t} className="break-words pl-5.5 leading-snug">
            {t}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AssetEditor({
  initial,
  knownTags,
  onBack,
  onChanged,
  onDeleted,
}: {
  initial: AdminAssetDetail;
  knownTags: string[];
  onBack: () => void;
  /** 목록을 다시 불러와야 할 때 (저장·공개 뒤) */
  onChanged: () => void;
  onDeleted: (message: string) => void;
}) {
  const slug = initial.slug;
  const [detail, setDetail] = useState(initial);
  const [data, setData] = useState<Data>(initial.data);
  const [body, setBody] = useState(initial.body);
  const [issues, setIssues] = useState<AdminIssue[]>([]);
  const [busy, setBusy] = useState<Busy>(null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string; details?: string[]; reload?: boolean } | null>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);

  const dirty = useMemo(() => !same(data, detail.data) || body.trim() !== detail.body.trim(), [data, body, detail]);
  const type = (ASSET_TYPES as readonly unknown[]).includes(data.type) ? (data.type as AssetType) : null;
  const errorAt = (path: string) => issues.find((i) => i.path === path)?.message;

  // 저장하지 않고 탭을 닫거나 새로 고치려 하면 브라우저가 묻는다
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = (key: string, value: unknown) =>
    setData((d) => {
      const next = { ...d };
      if (value === undefined) delete next[key];
      else next[key] = value;
      return next;
    });

  function accept(next: AdminAssetDetail, text: string) {
    setDetail(next);
    setData(next.data);
    setBody(next.body);
    setIssues([]);
    setNotice({ tone: "ok", text });
    onChanged();
  }

  async function save(e?: FormEvent) {
    e?.preventDefault();
    if (busy) return;
    setBusy("save");
    setNotice(null);
    const r = await adminApi.save(slug, { data, body, baseMtime: detail.mtime });
    setBusy(null);
    if (r.ok) return accept(r.data, "저장했습니다. 미리보기에 바로 반영됩니다.");
    setIssues(r.error.issues ?? []);
    setNotice({
      tone: "error",
      text: r.error.message,
      details: r.error.issues?.map((i) => (i.path ? `${i.path}: ${i.message}` : i.message)),
      reload: r.error.code === "conflict",
    });
  }

  async function changeDraft(kind: "publish" | "unpublish") {
    setBusy(kind);
    setNotice(null);
    const r = kind === "publish" ? await adminApi.publish(slug) : await adminApi.unpublish(slug);
    setBusy(null);
    if (r.ok) {
      return accept(r.data, kind === "publish" ? "공개했습니다. 출시 빌드에 들어갑니다 (배포: ./deploy/deploy.sh)." : "초안으로 돌렸습니다. 출시 빌드에서 빠집니다.");
    }
    setNotice({
      tone: "error",
      text: r.error.message,
      details: [...(r.error.missing ?? []).map(describeMissing), ...(r.error.issues ?? []).map((i) => i.message)],
    });
  }

  async function remove() {
    setBusy("delete");
    const r = await adminApi.remove(slug);
    setBusy(null);
    if (r.ok) {
      deleteDialog.current?.close();
      onDeleted(`${detail.title} 을(를) 휴지통으로 옮겼습니다: ${r.data.trashedTo}`);
      return;
    }
    deleteDialog.current?.close();
    setNotice({ tone: "error", text: r.error.message, details: r.error.references });
  }

  async function uploadCover(file: File) {
    setBusy("cover");
    setNotice(null);
    const r = await uploadImage(slug, file);
    setBusy(null);
    if (!r.ok) return setNotice({ tone: "error", text: r.message });
    set("cover", r.path);
    setNotice({ tone: "ok", text: `대표 이미지를 올렸습니다: ${r.path}. 대체 텍스트를 쓰고 저장해 주세요.`, details: r.warnings });
  }

  async function uploadIcon(file: File) {
    setBusy("icon");
    setNotice(null);
    const r = await uploadImage(slug, file);
    setBusy(null);
    if (!r.ok) return setNotice({ tone: "error", text: r.message });
    set("icon", r.path);
    setNotice({ tone: "ok", text: `아이콘을 올렸습니다: ${r.path}. 저장해 주세요.`, details: r.warnings.filter((w) => !w.includes("webp")) });
  }

  const back = () => {
    if (dirty && !window.confirm("저장하지 않은 변경이 있습니다. 버리고 목록으로 갈까요?")) return;
    onBack();
  };

  const blocked = detail.errors.length > 0 || detail.missing.length > 0;
  const canPublish = detail.draft && !blocked && !dirty;

  return (
    <form onSubmit={save} noValidate>
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <button type="button" onClick={back} className={buttonClass("ghost", "sm")}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          목록으로
        </button>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          <h2 className="truncate text-xl font-bold text-fg">{str(data.title) || slug}</h2>
          <code className="font-mono text-xs text-fg-subtle">{slug}</code>
          {type && <TypeBadge type={type} />}
          {detail.status && <StatusBadge status={detail.status} />}
          {detail.draft ? <DraftBadge /> : <span className="rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-ink">공개</span>}
        </div>
        {dirty && (
          <p role="status" className="text-sm text-fg-muted">
            저장하지 않은 변경이 있습니다
          </p>
        )}
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* 검사와 실행: 휴대폰에서는 위에, 넓은 화면에서는 오른쪽에 붙어 있다 */}
        <aside aria-label="검사와 실행" className={cx(panelClass, "grid gap-5 lg:sticky lg:top-20 lg:order-last")}>
          <div className="grid gap-2">
            <button type="submit" disabled={!dirty || busy !== null} className={cx(buttonClass("primary"), "w-full disabled:opacity-50")}>
              {busy === "save" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Save aria-hidden="true" className="size-4" />}
              저장
            </button>
            {detail.draft ? (
              <button type="button" disabled={!canPublish || busy !== null} onClick={() => changeDraft("publish")} className={cx(buttonClass("secondary"), "w-full disabled:opacity-50")}>
                {busy === "publish" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <Eye aria-hidden="true" className="size-4" />}
                공개하기
              </button>
            ) : (
              <button type="button" disabled={busy !== null || dirty} onClick={() => changeDraft("unpublish")} className={cx(buttonClass("secondary"), "w-full disabled:opacity-50")}>
                {busy === "unpublish" ? <LoaderCircle aria-hidden="true" className="size-4 animate-spin" /> : <EyeOff aria-hidden="true" className="size-4" />}
                초안으로 돌리기
              </button>
            )}
            <a href={`/library/${slug}/`} target="_blank" rel="noopener noreferrer" className={cx(buttonClass("ghost"), "w-full")}>
              미리보기
              <ArrowUpRight aria-hidden="true" className="size-4" />
              <span className="sr-only">(새 탭에서 열림)</span>
            </a>
            <p className="text-xs leading-relaxed text-fg-subtle">
              {dirty
                ? "검사는 저장된 파일 기준입니다. 저장하면 다시 검사합니다."
                : detail.draft
                  ? blocked
                    ? "아래 항목을 채우면 공개할 수 있습니다."
                    : "공개하면 출시 빌드(배포)에 들어갑니다."
                  : "공개 중입니다. 배포하면 사이트에 반영됩니다."}
            </p>
          </div>

          {notice && (
            <div role={notice.tone === "error" ? "alert" : "status"} className={cx("rounded-xl border p-3 text-sm", notice.tone === "error" ? "border-danger/50 text-danger" : "border-line text-fg-muted")}>
              <p>{notice.text}</p>
              {notice.details && notice.details.length > 0 && (
                <ul className="mt-2 grid list-disc gap-1 pl-5 text-xs">
                  {notice.details.map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
              {notice.reload && (
                <button type="button" onClick={() => void loadAssetDetail(slug)} className={cx(smallButton, "mt-3")}>
                  파일에서 다시 불러오기 (지금 고친 내용은 버려집니다)
                </button>
              )}
            </div>
          )}

          <div className="grid gap-4 border-t border-line pt-5">
            <h2 className="text-sm font-semibold text-fg">검사 결과</h2>
            <CheckList icon="error" tone="text-danger" title="문제 (check.sh 가 막는다)" items={detail.errors.map((e) => (e.path ? `${e.path}: ${e.message}` : e.message))} />
            <CheckList icon="missing" tone="text-fg" title="공개 전에 채울 것" items={detail.missing.map(describeMissing)} />
            <CheckList icon="warning" tone="text-fg-muted" title="참고" items={detail.warnings} />
            {!blocked && (
              <p className="flex items-center gap-1.5 text-sm font-semibold text-accent">
                <CircleCheck aria-hidden="true" className="size-4" />
                {detail.draft ? "공개할 수 있습니다" : "출시 기준을 채웠습니다"}
              </p>
            )}
            {detail.references.length > 0 && (
              <div className="text-xs text-fg-subtle">
                <p className="font-semibold">이 작품을 가리키는 곳</p>
                <ul className="mt-1 grid gap-0.5">
                  {detail.references.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {detail.draft && (
            <div className="border-t border-line pt-4">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => deleteDialog.current?.showModal()}
                className="inline-flex h-9 items-center gap-2 rounded-full px-3 text-sm font-semibold text-danger transition-colors hover:bg-raised disabled:opacity-50"
              >
                <Trash2 aria-hidden="true" className="size-4" />
                초안 삭제
              </button>
            </div>
          )}
        </aside>

        <div className="grid gap-6">
          <Section id="sec-basic" title="기본 정보" description="카드·검색·상세 화면 맨 위에 쓰입니다.">
            <div className="grid gap-5 sm:grid-cols-2">
              <TextField label="이름" required className="sm:col-span-2" value={str(data.title)} onChange={(v) => set("title", v)} error={errorAt("title")} />
              <TextField
                label="한 줄 소개"
                required
                className="sm:col-span-2"
                counter={SUMMARY_MAX}
                value={str(data.summary)}
                onChange={(v) => set("summary", v)}
                hint="카드와 검색에 쓰입니다. TODO( 가 남아 있으면 공개할 수 없습니다."
                error={errorAt("summary")}
              />
              <SelectField
                label="유형"
                required
                value={type ?? ""}
                options={ASSET_TYPES.map((t) => ({ value: t, label: TYPE_LABELS[t] }))}
                onChange={(t) => setData((d) => ({ ...stripForeignFields(d, t), type: t }))}
                hint={type && TYPE_FIELDS[type].length ? "유형을 바꾸면 이전 유형에만 있는 칸은 지워집니다." : undefined}
                error={errorAt("type")}
              />
              <SelectField
                label="상태"
                required
                value={(ASSET_STATUSES as readonly unknown[]).includes(data.status) ? (data.status as (typeof ASSET_STATUSES)[number]) : ""}
                options={ASSET_STATUSES.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
                onChange={(s) => set("status", s)}
                error={errorAt("status")}
              />
              <TextField label="날짜 (시작·공개)" value={str(data.date)} onChange={(v) => set("date", v)} placeholder="2025-12" hint={DATE_HINT} error={errorAt("date")} />
              <TextField label="마지막 업데이트" value={str(data.updated)} onChange={(v) => set("updated", v)} placeholder="2026-11-09" error={errorAt("updated")} />
              <div className="sm:col-span-2">
                <TagsField value={Array.isArray(data.tags) ? (data.tags as string[]) : []} known={knownTags} onChange={(t) => set("tags", t)} />
              </div>
              <div className="sm:col-span-2">
                <CheckboxField label="대표 작품" hint="홈의 '대표 작품'에 먼저 나옵니다" checked={data.featured === true} onChange={(c) => set("featured", c ? true : undefined)} />
              </div>
            </div>
          </Section>

          <Section id="sec-cover" title="대표 이미지" description="카드와 상세 화면에 보입니다. webp, 가로 1200px 이하, 300KB 이하가 기준입니다.">
            <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
              <div className="aspect-[4/3] overflow-hidden rounded-xl border border-line bg-canvas">
                {str(data.cover) ? (
                  <img src={str(data.cover)} alt="" className="size-full object-cover" />
                ) : (
                  <p className="flex size-full items-center justify-center text-xs text-fg-subtle">이미지 없음</p>
                )}
              </div>
              <div className="grid content-start gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <FilePicker label={busy === "cover" ? "올리는 중…" : str(data.cover) ? "다른 이미지 올리기" : "이미지 올리기"} accept={IMAGE_ACCEPT} disabled={busy !== null} onFile={uploadCover} />
                  {str(data.cover) && (
                    <button type="button" className={smallButton} onClick={() => setData((d) => ({ ...d, cover: undefined, coverAlt: undefined }))}>
                      이미지 빼기
                    </button>
                  )}
                </div>
                <TextField label="이미지 경로" mono value={str(data.cover)} onChange={(v) => set("cover", v)} placeholder={`/media/${slug}/cover.webp`} error={errorAt("cover")} />
                <TextField
                  label="대체 텍스트"
                  required={Boolean(str(data.cover))}
                  value={str(data.coverAlt)}
                  onChange={(v) => set("coverAlt", v)}
                  hint="무엇이 보이는지 한 문장으로 (예: 작은 창에 CPU·GPU 그래프가 보이는 화면)"
                  error={errorAt("coverAlt")}
                />
              </div>
            </div>
          </Section>

          <Section id="sec-icon" title="아이콘" description="대표 이미지가 없을 때 카드와 상세 화면 가운데에 보입니다. 정사각형, 256px, png 또는 webp.">
            <div className="grid gap-5 sm:grid-cols-[12rem_1fr]">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-line bg-canvas">
                {str(data.icon) ? (
                  <img src={str(data.icon)} alt="" className="size-20 object-contain" />
                ) : (
                  <p className="text-xs text-fg-subtle">아이콘 없음</p>
                )}
              </div>
              <div className="grid content-start gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <FilePicker label={busy === "icon" ? "올리는 중…" : str(data.icon) ? "다른 아이콘 올리기" : "아이콘 올리기"} accept={IMAGE_ACCEPT} disabled={busy !== null} onFile={uploadIcon} />
                  {str(data.icon) && (
                    <button type="button" className={smallButton} onClick={() => set("icon", undefined)}>
                      아이콘 빼기
                    </button>
                  )}
                </div>
                <TextField label="아이콘 경로" mono value={str(data.icon)} onChange={(v) => set("icon", v)} placeholder={`/media/${slug}/icon.png`} error={errorAt("icon")} />
              </div>
            </div>
          </Section>

          {type && <TypeSection type={type} slug={slug} data={data} set={set} errorAt={errorAt} />}

          <Section id="sec-links" title="추가 링크" description="상세 화면 위쪽에 버튼으로 나옵니다. 새 탭에서 열립니다.">
            <LinksField value={list(data.links)} onChange={(v) => set("links", v)} errorAt={errorAt} />
          </Section>

          <Section id="sec-body" title="소개 본문" description="Markdown 으로 씁니다. 상세 화면의 '소개'가 됩니다.">
            <TextArea label="본문 (Markdown)" mono rows={16} value={body} onChange={setBody} hint="## 제목, - 목록, **굵게**, [링크](https://…). TODO( 가 남아 있으면 공개할 수 없습니다." />
          </Section>
        </div>
      </div>

      <dialog
        ref={deleteDialog}
        aria-labelledby="delete-asset-title"
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-card border border-line-strong bg-surface p-6 text-fg shadow-2xl shadow-black/60 light:shadow-black/15"
      >
        <h2 id="delete-asset-title" className="text-lg font-semibold">
          초안을 삭제할까요?
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-fg-muted">
          <code className="font-mono text-xs text-fg">content/assets/{slug}.md</code> 와 이미지 폴더를 <code className="font-mono text-xs text-fg">.local/trash/</code> 로 옮깁니다.
          커밋한 적이 있으면 git 으로도 되살릴 수 있습니다.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button type="button" onClick={() => deleteDialog.current?.close()} className={buttonClass("ghost")}>
            취소
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={remove}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-danger px-5 text-sm font-semibold text-danger-ink transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {busy === "delete" && <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />}
            삭제
          </button>
        </div>
      </dialog>
    </form>
  );
}

function TypeSection({
  type,
  slug,
  data,
  set,
  errorAt,
}: {
  type: AssetType;
  slug: string;
  data: Data;
  set: (key: string, value: unknown) => void;
  errorAt: (path: string) => string | undefined;
}) {
  const youtube = (
    <TextField
      label="YouTube 영상"
      mono
      value={str(data.youtubeId)}
      onChange={(v) => set("youtubeId", v)}
      onBlur={() => str(data.youtubeId) && set("youtubeId", youtubeIdFrom(str(data.youtubeId)))}
      placeholder="https://www.youtube.com/watch?v=… 또는 11자 ID"
      hint="주소를 붙여 넣으면 ID 만 남깁니다. 방문자가 누를 때만 불러옵니다 (youtube-nocookie)."
      error={errorAt("youtubeId")}
    />
  );
  const photos = <PhotosField slug={slug} value={list(data.photos)} onChange={(v) => set("photos", v)} errorAt={errorAt} />;
  const title = `${TYPE_LABELS[type]} 정보`;

  switch (type) {
    case "web-app":
      return (
        <Section id="sec-type" title={title} description="카드의 '실행' 버튼과 상세 화면이 이 주소로 엽니다.">
          <TextField label="서비스 주소" required type="url" mono value={str(data.url)} onChange={(v) => set("url", v)} placeholder="https://…" error={errorAt("url")} />
          <TextField
            label="Showroom 서비스 코드 (showroomService, 선택)"
            mono
            value={str(data.showroomService)}
            onChange={(v) => set("showroomService", v)}
            hint="Showroom DB 로 옮긴 서비스면 scripts/import-official.sh 가 채웁니다. 있으면 Showroom 목록은 DB 의 것을 보입니다 (ADR-0014)."
            error={errorAt("showroomService")}
          />
        </Section>
      );
    case "article":
      return (
        <Section id="sec-type" title={title} description="카드의 '읽기' 버튼이 원문으로 엽니다.">
          <TextField label="원문 주소" required type="url" mono value={str(data.url)} onChange={(v) => set("url", v)} placeholder="https://…" error={errorAt("url")} />
          <TextField label="출처 (블로그 이름)" value={str(data.source)} onChange={(v) => set("source", v)} error={errorAt("source")} />
        </Section>
      );
    case "video":
      return (
        <Section id="sec-type" title={title}>
          {youtube}
        </Section>
      );
    case "gallery":
      return (
        <Section id="sec-type" title="사진" description="상세 화면에서 크게 넘겨 볼 수 있습니다.">
          {photos}
        </Section>
      );
    case "hardware":
      return (
        <Section id="sec-type" title={title} description="사진이나 영상 중 하나는 있어야 공개할 수 있습니다.">
          {photos}
          {youtube}
        </Section>
      );
    case "desktop-app":
      return (
        <Section id="sec-type" title={title} description="파일을 올리면 크기·SHA-256 을 계산해 채웁니다. 버전마다 파일 이름을 바꿔 주세요.">
          <TextField label="실행 환경" value={str(data.requirements)} onChange={(v) => set("requirements", v)} placeholder="Windows 10 이상" error={errorAt("requirements")} />
          <TextField
            label="Microsoft Store 주소 (선택)"
            mono
            value={str(data.microsoftStore)}
            onChange={(v) => set("microsoftStore", v)}
            placeholder="https://apps.microsoft.com/detail/9ABCDEFGHIJK"
            error={errorAt("microsoftStore")}
          />
          <TextField
            label="Store 앱 코드 (storeApp, 선택)"
            mono
            value={str(data.storeApp)}
            onChange={(v) => set("storeApp", v)}
            hint="Store DB 로 옮긴 앱이면 scripts/import-official.sh 가 채웁니다. 있으면 Library 는 아래 다운로드 대신 'Store에서 내려받기'를 보이고, 새 버전은 Store 에서 올립니다 (ADR-0014)."
            error={errorAt("storeApp")}
          />
          <DownloadsField slug={slug} value={list(data.downloads)} onChange={(v) => set("downloads", v)} errorAt={errorAt} />
        </Section>
      );
    case "web-package":
      return (
        <Section id="sec-type" title={title} description="체험 주소(별도 출처의 샌드박스)나 zip 중 하나는 있어야 공개할 수 있습니다.">
          <TextField
            label="체험 주소 (playUrl)"
            type="url"
            mono
            value={str(data.playUrl)}
            onChange={(v) => set("playUrl", v)}
            hint="포털과 다른 출처(play.<도메인>)여야 합니다. 같은 출처는 금지 (ideation R4)"
            error={errorAt("playUrl")}
          />
          <SingleDownloadField
            slug={slug}
            value={data.download && typeof data.download === "object" ? (data.download as Data) : undefined}
            onChange={(v) => set("download", v)}
            errorAt={errorAt}
          />
        </Section>
      );
  }
}
