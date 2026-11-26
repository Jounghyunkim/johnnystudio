"use client";

/**
 * 소개 자료 편집 (ADR-0013): 새로 올리기·고치기 화면이 함께 쓴다. 상태(ListingDraft)는 부르는 쪽이 갖는다.
 * 그림 미리보기는 작게 줄인 data: 그림이다 (CSP img-src 에 blob: 이 없다).
 */
import { ArrowDown, ArrowUp, Eye, ImagePlus, Plus, Star, Trash2, TriangleAlert, X } from "lucide-react";
import { type ReactNode, useId, useState } from "react";

import { type ListingKind, type ListingPage, GALLERY_ACCEPT, LISTING_LIMITS as L, charCount, emptyPage, isMsStoreUrl, splitLines } from "@/lib/listing";
import type { ImportedListing } from "@/lib/listing-bundle";
import { type DraftImage, type ListingDraft, addImages, applyImport, moveItem, newKey, removeImage } from "@/lib/listing-draft";
import { ICON_ACCEPT } from "@/lib/store";

import { buttonClass, cx } from "../ui";
import { inputClass, panelClass } from "../store/store-ui";
import { MsStoreExport } from "./listing-msstore";
import { KeywordChips, ListingFacts, ListingMain } from "./listing-view";

// ── 미리보기 그림 ──

/** 그림 파일 → 긴 변 maxSide 의 WebP data: 그림. 그림이 아니면 null */
export async function thumbnail(file: File, maxSide = 480): Promise<string | null> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return canvas.toDataURL("image/webp", 0.82);
  } catch {
    return null;
  }
}

/** 미리보기가 없는 새 그림·아이콘에 미리보기를 만든다. 그림으로 읽히지 않는 파일은 빼고 이름을 돌려준다 */
export async function withPreviews(draft: ListingDraft): Promise<{ draft: ListingDraft; broken: string[] }> {
  const broken: string[] = [];
  const gallery: DraftImage[] = [];
  for (const g of draft.gallery) {
    if (g.preview || !g.file) {
      gallery.push(g);
      continue;
    }
    const preview = await thumbnail(g.file);
    if (preview) gallery.push({ ...g, preview });
    else broken.push(g.file.name);
  }
  let icon = draft.icon;
  if (icon && !icon.preview) {
    const preview = await thumbnail(icon.file, 256);
    if (preview) icon = { ...icon, preview };
    else {
      broken.push(icon.file.name);
      icon = null;
    }
  }
  const keys = new Set(gallery.map((g) => g.key));
  return { draft: { ...draft, gallery, icon, features: draft.features.map((f) => (f.image && !keys.has(f.image) ? { ...f, image: null } : f)) }, broken };
}

/** 불러온 소개 자료를 양식에 넣고 미리보기를 만든다. 알릴 것을 돌려준다 */
export async function importListing(
  draft: ListingDraft,
  imp: ImportedListing,
  categories: Record<string, string>,
  msCategories: Record<string, string>,
): Promise<{ draft: ListingDraft; notes: string[] }> {
  const filled = applyImport(draft, imp, categories, msCategories);
  const done = await withPreviews(filled.draft);
  return { draft: done.draft, notes: [...filled.notes, ...done.broken.map((n) => `${n}: 그림 파일로 읽히지 않아서 뺐습니다`)] };
}

// ── 칸 ──

function Counter({ value, max }: { value: string; max: number }) {
  const n = charCount(value);
  return <span className={cx("tabular-nums", n > max ? "font-semibold text-danger" : "text-fg-subtle")}>{`${n} / ${max}`}</span>;
}

function Labeled({ id, label, hint, extra, children }: { id: string; label: string; hint?: ReactNode; extra?: ReactNode; children: ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-semibold text-fg">
          {label}
        </label>
        {extra && <span className="text-xs">{extra}</span>}
      </div>
      <div className="mt-2">{children}</div>
      {hint && <p className="mt-1 text-xs text-fg-subtle">{hint}</p>}
    </div>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <fieldset className={cx(panelClass, "space-y-5")}>
      <legend className="sr-only">{title}</legend>
      <div aria-hidden="true">
        <p className="text-base font-semibold text-fg">{title}</p>
        {description && <p className="mt-1 text-sm text-fg-muted">{description}</p>}
      </div>
      {children}
    </fieldset>
  );
}

const smallButton = "inline-flex size-8 items-center justify-center rounded-full text-fg-subtle hover:bg-raised hover:text-fg disabled:opacity-30";

// ── 편집기 ──

export function ListingEditor({
  kind,
  draft,
  onChange,
  categories,
  msCategories,
  iconSrc,
  basics = true,
  releaseNotes = false,
}: {
  kind: ListingKind;
  draft: ListingDraft;
  onChange: (draft: ListingDraft) => void;
  categories: Record<string, string>;
  /** Microsoft Store 분류 (meta.listing.ms_categories) */
  msCategories: Record<string, string>;
  /** Microsoft Store 제출용 항목에 '새로운 기능'(바뀐 점, draft.notes)을 넣는가 (Store 새 앱·새 버전) */
  releaseNotes?: boolean;
  /** 지금 아이콘 (서버 그림 또는 설치 파일에서 찾은 그림) */
  iconSrc?: string | null;
  /** 이름·소개·설명·분류 칸 (Store 새 버전처럼 소개만 고칠 때 false) */
  basics?: boolean;
}) {
  const id = useId();
  const ids = (k: string) => `${id}-${k}`;
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string[]>([]);
  const [preview, setPreview] = useState(false);
  const set = (patch: Partial<ListingDraft>) => onChange({ ...draft, ...patch });

  async function pickImages(list: FileList | null) {
    if (!list?.length) return;
    setBusy(true);
    const { draft: next, rejected } = addImages(draft, [...list]);
    const done = await withPreviews(next);
    setBusy(false);
    setNotice([...rejected, ...done.broken.map((n) => `${n}: 그림 파일로 읽히지 않습니다`)]);
    onChange(done.draft);
  }

  async function pickIcon(file: File | undefined) {
    if (!file) return;
    if (file.size > 1024 * 1024) return setNotice([`${file.name}: 아이콘은 1MB 까지입니다`]);
    const p = await thumbnail(file, 256);
    if (!p && !file.name.toLowerCase().endsWith(".ico")) return setNotice([`${file.name}: 그림 파일로 읽히지 않습니다`]);
    setNotice([]);
    set({ icon: { file, preview: p ?? undefined }, pending: draft.pending.filter((x) => x.role !== "icon") });
  }

  const imageLabel = (g: DraftImage, i: number) => g.caption || g.file?.name || `그림 ${i + 1}`;
  const iconShown = draft.icon?.preview ?? iconSrc ?? null;
  const keywords = splitLines(draft.keywords, true);

  return (
    <div className="space-y-6">
      {basics && (
        <Group title="기본 정보" description="목록 카드와 상세 화면 맨 위에 보입니다.">
          <Labeled id={ids("name")} label={kind === "store" ? "앱 이름" : "서비스 이름"} extra={<Counter value={draft.name} max={L.name} />}>
            <input id={ids("name")} required maxLength={L.name} value={draft.name} onChange={(e) => set({ name: e.target.value })} className={cx(inputClass, "h-12")} />
          </Labeled>
          {kind === "showroom" && (
            <Labeled id={ids("url")} label="서비스 주소" hint="https:// 로 시작하는 주소. 공개한 뒤 주소를 바꾸면 다시 검토합니다.">
              <input
                id={ids("url")}
                type="url"
                required
                maxLength={500}
                placeholder="https://"
                value={draft.url}
                onChange={(e) => set({ url: e.target.value })}
                className={cx(inputClass, "h-12 font-mono")}
              />
            </Labeled>
          )}
          <Labeled id={ids("summary")} label="한 줄 소개" hint="목록 카드에 보입니다. 무엇을 하는지 한 문장으로." extra={<Counter value={draft.summary} max={L.summary} />}>
            <input id={ids("summary")} maxLength={L.summary} value={draft.summary} onChange={(e) => set({ summary: e.target.value })} className={cx(inputClass, "h-12")} />
          </Labeled>
          <div className="grid gap-5 sm:grid-cols-2">
            <Labeled id={ids("category")} label="분류">
              <select id={ids("category")} value={draft.category} onChange={(e) => set({ category: e.target.value })} className={cx(inputClass, "h-12")}>
                {Object.entries(categories).map(([v, label]) => (
                  <option key={v} value={v}>
                    {label}
                  </option>
                ))}
              </select>
            </Labeled>
            <Labeled id={ids("pricing")} label="가격 (선택)" hint="예: 무료, 무료 + 유료 플랜" extra={<Counter value={draft.pricing} max={L.pricing} />}>
              <input id={ids("pricing")} maxLength={L.pricing} value={draft.pricing} onChange={(e) => set({ pricing: e.target.value })} className={cx(inputClass, "h-12")} />
            </Labeled>
          </div>
          <Labeled
            id={ids("keywords")}
            label="연관 검색어 (선택)"
            hint={`쉼표나 줄바꿈으로 나눕니다. ${L.keywords}개까지, 하나에 ${L.keyword}자까지. 목록 검색에 쓰입니다.`}
            extra={<span className={keywords.length > L.keywords ? "font-semibold text-danger" : "text-fg-subtle"}>{`${keywords.length} / ${L.keywords}`}</span>}
          >
            <input id={ids("keywords")} value={draft.keywords} onChange={(e) => set({ keywords: e.target.value })} placeholder="메모, 노트, 회의록" className={cx(inputClass, "h-12")} />
          </Labeled>
        </Group>
      )}

      <Group title="그림" description={`아이콘과 화면 그림입니다. 첫 그림이 대표 그림으로 크게 보입니다. PNG·JPEG·WebP, 한 장에 5MB, ${L.gallery}장까지. 서버가 긴 변 1600px 로 다시 그립니다.`}>
        <div className="flex flex-wrap items-center gap-4">
          {iconShown ? (
            <img src={iconShown} alt="아이콘 미리보기" width={256} height={256} className="size-16 rounded-2xl bg-raised object-contain" />
          ) : (
            <span className="flex size-16 items-center justify-center rounded-2xl border border-dashed border-line-strong text-xs text-fg-subtle">아이콘</span>
          )}
          <label htmlFor={ids("icon")} className={cx(buttonClass("secondary", "sm"), "cursor-pointer focus-within:outline-2 focus-within:outline-accent")}>
            {draft.icon || iconSrc ? "아이콘 바꾸기" : "아이콘 고르기"}
            <input
              id={ids("icon")}
              type="file"
              accept={ICON_ACCEPT}
              className="sr-only"
              onChange={(e) => {
                void pickIcon(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {draft.icon && (
            <button type="button" onClick={() => set({ icon: null })} className={buttonClass("ghost", "sm")}>
              새 아이콘 취소
            </button>
          )}
          <p className="text-xs text-fg-subtle">정사각형 그림 (1080×1080 권장, Microsoft Store 상자 그림과 같은 크기), 1MB 까지. 256px PNG 로 다시 그립니다.</p>
        </div>

        {draft.gallery.length > 0 && (
          <ol className="grid gap-4 sm:grid-cols-2">
            {draft.gallery.map((g, i) => (
              <li key={g.key} className="rounded-xl border border-line bg-canvas p-3">
                <div className="relative overflow-hidden rounded-lg bg-raised">
                  {g.preview ? (
                    <img src={g.preview} alt={imageLabel(g, i)} className="aspect-[16/10] w-full object-cover" />
                  ) : (
                    <span className="flex aspect-[16/10] items-center justify-center text-xs text-fg-subtle">{g.file?.name}</span>
                  )}
                  {i === 0 && (
                    <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-canvas/90 px-2 py-0.5 text-xs font-semibold text-fg">
                      <Star aria-hidden="true" className="size-3 text-accent" />
                      대표
                    </span>
                  )}
                  {!g.saved && <span className="absolute right-2 top-2 rounded-full bg-canvas/90 px-2 py-0.5 text-xs text-fg-muted">새 그림</span>}
                </div>
                <div className="mt-3 flex items-center gap-1">
                  <label htmlFor={ids(`cap-${g.key}`)} className="sr-only">
                    {`그림 ${i + 1} 설명`}
                  </label>
                  <input
                    id={ids(`cap-${g.key}`)}
                    value={g.caption}
                    maxLength={L.caption}
                    placeholder="무엇을 보여 주는 그림인가요?"
                    onChange={(e) => set({ gallery: draft.gallery.map((x) => (x.key === g.key ? { ...x, caption: e.target.value } : x)) })}
                    className={cx(inputClass, "h-9 min-w-0 flex-1 px-3 text-sm")}
                  />
                  <button type="button" disabled={i === 0} onClick={() => set({ gallery: moveItem(draft.gallery, i, -1) })} className={smallButton}>
                    <ArrowUp aria-hidden="true" className="size-4" />
                    <span className="sr-only">{`${imageLabel(g, i)} 앞으로`}</span>
                  </button>
                  <button type="button" disabled={i === draft.gallery.length - 1} onClick={() => set({ gallery: moveItem(draft.gallery, i, 1) })} className={smallButton}>
                    <ArrowDown aria-hidden="true" className="size-4" />
                    <span className="sr-only">{`${imageLabel(g, i)} 뒤로`}</span>
                  </button>
                  <button type="button" onClick={() => onChange(removeImage(draft, g.key))} className={cx(smallButton, "hover:text-danger")}>
                    <Trash2 aria-hidden="true" className="size-4" />
                    <span className="sr-only">{`${imageLabel(g, i)} 빼기`}</span>
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}

        <div className="flex flex-wrap items-center gap-3">
          <label
            htmlFor={ids("gallery")}
            className={cx(buttonClass("secondary", "sm"), "cursor-pointer focus-within:outline-2 focus-within:outline-accent", (busy || draft.gallery.length >= L.gallery) && "pointer-events-none opacity-50")}
          >
            <ImagePlus aria-hidden="true" className="size-4" />
            그림 더하기
            <input
              id={ids("gallery")}
              type="file"
              multiple
              accept={GALLERY_ACCEPT}
              disabled={busy || draft.gallery.length >= L.gallery}
              className="sr-only"
              onChange={(e) => {
                void pickImages(e.target.files);
                e.target.value = "";
              }}
            />
          </label>
          <span className="text-xs tabular-nums text-fg-subtle">{`${draft.gallery.length} / ${L.gallery}장`}</span>
        </div>

        {draft.pending.length > 0 && (
          <div role="status" className="rounded-xl border border-line-strong p-4 text-sm">
            <p className="font-semibold text-fg">소개 자료가 가리킨 그림 {draft.pending.length}장이 아직 없습니다</p>
            <p className="mt-1 text-fg-muted">이름이 같은 파일을 &lsquo;그림 더하기&rsquo;로 고르면 설명·기능 자리에 맞춰 들어갑니다 (아이콘도 같이 골라도 됩니다).</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {draft.pending.map((p) => (
                <li key={`${p.role}-${p.path}`} className="rounded-full bg-raised px-2.5 py-1 font-mono text-xs text-fg-muted">
                  {p.path}
                  {p.role === "icon" && " (아이콘)"}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => set({ pending: [] })} className={cx(buttonClass("ghost", "sm"), "mt-2 -ml-2")}>
              <X aria-hidden="true" className="size-4" />이 목록 지우기
            </button>
          </div>
        )}
        {notice.length > 0 && (
          <ul role="alert" className="space-y-1 text-sm text-amber-300 light:text-amber-800">
            {notice.map((n) => (
              <li key={n} className="flex items-start gap-2">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {n}
              </li>
            ))}
          </ul>
        )}
      </Group>

      <Group title="이런 분께 추천해요" description="누가 쓰면 좋은지 한 줄에 하나씩 적습니다.">
        <LinesField id={ids("audience")} label="추천 대상" value={draft.audience} onChange={(audience) => set({ audience })} max={L.audience} itemMax={L.audienceItem} rows={3} placeholder={"회의록을 자주 쓰는 분\n생각을 빨리 적고 싶은 분"} />
      </Group>

      <Group title="주요 기능" description={`기능마다 이름과 한두 문장 설명. 그림을 붙이면 설명 옆에 크게 보입니다. ${L.features}개까지.`}>
        {draft.features.map((f, i) => (
          <div key={f.key} className="space-y-3 rounded-xl border border-line bg-canvas p-4">
            <div className="flex items-center gap-1">
              <p className="flex-1 text-sm font-semibold text-fg-muted">{`기능 ${i + 1}`}</p>
              <button type="button" disabled={i === 0} onClick={() => set({ features: moveItem(draft.features, i, -1) })} className={smallButton}>
                <ArrowUp aria-hidden="true" className="size-4" />
                <span className="sr-only">{`기능 ${i + 1} 앞으로`}</span>
              </button>
              <button type="button" disabled={i === draft.features.length - 1} onClick={() => set({ features: moveItem(draft.features, i, 1) })} className={smallButton}>
                <ArrowDown aria-hidden="true" className="size-4" />
                <span className="sr-only">{`기능 ${i + 1} 뒤로`}</span>
              </button>
              <button type="button" onClick={() => set({ features: draft.features.filter((x) => x.key !== f.key) })} className={cx(smallButton, "hover:text-danger")}>
                <Trash2 aria-hidden="true" className="size-4" />
                <span className="sr-only">{`기능 ${i + 1} 빼기`}</span>
              </button>
            </div>
            <Labeled id={ids(`ft-${f.key}`)} label="기능 이름" extra={<Counter value={f.title} max={L.featureTitle} />}>
              <input
                id={ids(`ft-${f.key}`)}
                maxLength={L.featureTitle}
                value={f.title}
                onChange={(e) => set({ features: draft.features.map((x) => (x.key === f.key ? { ...x, title: e.target.value } : x)) })}
                className={cx(inputClass, "h-11")}
              />
            </Labeled>
            <Labeled id={ids(`fx-${f.key}`)} label="설명" extra={<Counter value={f.text} max={L.featureText} />}>
              <textarea
                id={ids(`fx-${f.key}`)}
                rows={2}
                maxLength={L.featureText}
                value={f.text}
                onChange={(e) => set({ features: draft.features.map((x) => (x.key === f.key ? { ...x, text: e.target.value } : x)) })}
                className={cx(inputClass, "py-3")}
              />
            </Labeled>
            <Labeled id={ids(`fi-${f.key}`)} label="그림 (선택)" hint="그림 모음에 넣은 그림에서 고릅니다. 고른 그림은 '화면' 목록에서는 빠집니다.">
              <select
                id={ids(`fi-${f.key}`)}
                value={f.image ?? ""}
                onChange={(e) => set({ features: draft.features.map((x) => (x.key === f.key ? { ...x, image: e.target.value || null } : x)) })}
                className={cx(inputClass, "h-11")}
              >
                <option value="">그림 없음</option>
                {draft.gallery.map((g, j) => (
                  <option key={g.key} value={g.key}>
                    {`${j + 1}. ${imageLabel(g, j)}`}
                  </option>
                ))}
              </select>
            </Labeled>
          </div>
        ))}
        <AddButton disabled={draft.features.length >= L.features} onClick={() => set({ features: [...draft.features, { key: newKey("f"), title: "", text: "", image: null }] })}>
          기능 더하기
        </AddButton>
      </Group>

      <Group title="사용 방법" description="처음 쓰는 사람이 따라 할 단계를 한 줄에 하나씩 적습니다.">
        <LinesField id={ids("steps")} label="단계" value={draft.steps} onChange={(steps) => set({ steps })} max={L.steps} itemMax={L.step} rows={4} placeholder={"설치 파일을 내려받아 실행합니다\n처음 화면에서 폴더를 고릅니다"} />
      </Group>

      {basics && (
        <Group title="상세 설명" description="자유롭게 씁니다. ### 소제목, - 목록, **굵게**, `코드`, [링크](https://…) 를 쓸 수 있습니다. HTML 과 바깥 그림은 글자로만 보입니다.">
          <Labeled id={ids("description")} label="설명" extra={<Counter value={draft.description} max={L.description} />}>
            <textarea
              id={ids("description")}
              rows={10}
              maxLength={L.description}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              className={cx(inputClass, "py-3 font-mono text-sm leading-relaxed")}
            />
          </Labeled>
        </Group>
      )}

      <Group title="필요한 환경" description="Microsoft Store 의 '추가 시스템 요구 사항(최소·권장 하드웨어)'과 같은 칸입니다. 모두 선택입니다.">
        <div className="grid gap-5 sm:grid-cols-2">
          <LinesField
            id={ids("requirements")}
            label="최소 환경"
            value={draft.requirements}
            onChange={(requirements) => set({ requirements })}
            max={L.requirements}
            itemMax={L.requirement}
            rows={3}
            placeholder={kind === "store" ? "Windows 10 이상 (64비트)\n.NET 8 런타임" : "Chrome·Edge·Safari 최신판\n가입 필요 (이메일)"}
          />
          <LinesField
            id={ids("recommended")}
            label="권장 환경"
            value={draft.recommended}
            onChange={(recommended) => set({ recommended })}
            max={L.requirements}
            itemMax={L.requirement}
            rows={3}
            placeholder={kind === "store" ? "메모리 8GB 이상\n화면 1920×1080" : "화면 너비 1280px 이상"}
          />
        </div>
      </Group>

      <Group title="만든 이 · 지원 정보" description="상세 화면의 '한눈에'와 Microsoft Store 등록(개발자·저작권·개인정보처리방침·웹 사이트·지원 연락처)에 함께 씁니다. 모두 공개됩니다.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Labeled id={ids("developer")} label="개발자" hint="만든 사람이나 회사 이름" extra={<Counter value={draft.developer} max={L.developer} />}>
            <input id={ids("developer")} maxLength={L.developer} value={draft.developer} onChange={(e) => set({ developer: e.target.value })} className={cx(inputClass, "h-11")} />
          </Labeled>
          <Labeled id={ids("license")} label="라이선스" hint="예: MIT, 개인 무료·상업 유료" extra={<Counter value={draft.license} max={L.license} />}>
            <input id={ids("license")} maxLength={L.license} value={draft.license} onChange={(e) => set({ license: e.target.value })} className={cx(inputClass, "h-11")} />
          </Labeled>
        </div>
        <Labeled id={ids("copyright")} label="저작권·상표 정보" hint="예: © 2026 만든 사람" extra={<Counter value={draft.copyright} max={L.copyright} />}>
          <input id={ids("copyright")} maxLength={L.copyright} value={draft.copyright} onChange={(e) => set({ copyright: e.target.value })} className={cx(inputClass, "h-11")} />
        </Labeled>
        <div className="grid gap-5 sm:grid-cols-2">
          <Labeled id={ids("website")} label="웹 사이트" hint="https 주소">
            <input id={ids("website")} type="url" placeholder="https://" maxLength={500} value={draft.website} onChange={(e) => set({ website: e.target.value })} className={cx(inputClass, "h-11 font-mono text-sm")} />
          </Labeled>
          <Labeled id={ids("support")} label="지원 연락처" hint="지원 페이지(https) 또는 이메일. 누구나 볼 수 있습니다.">
            <input id={ids("support")} maxLength={320} value={draft.support} onChange={(e) => set({ support: e.target.value })} className={cx(inputClass, "h-11 font-mono text-sm")} />
          </Labeled>
        </div>
        <Labeled id={ids("privacy")} label="개인정보처리방침 주소" hint="개인정보를 다루거나 인터넷에 연결하면 꼭 넣으세요 (Microsoft Store 에서는 이때 필수입니다).">
          <input id={ids("privacy")} type="url" placeholder="https://" maxLength={500} value={draft.privacyUrl} onChange={(e) => set({ privacyUrl: e.target.value })} className={cx(inputClass, "h-11 font-mono text-sm")} />
        </Labeled>
      </Group>

      <Group title="Microsoft Store" description="Microsoft Store 에도 올렸거나 올릴 때 씁니다. 모두 선택입니다.">
        <div className="grid gap-5 sm:grid-cols-2">
          <Labeled
            id={ids("msurl")}
            label="Microsoft Store 주소"
            hint={draft.msStoreUrl.trim() && !isMsStoreUrl(draft.msStoreUrl) ? "https://apps.microsoft.com/detail/<제품 ID 12자> 모양이어야 합니다." : "있으면 상세 화면에 'Microsoft Store에서 받기'가 보입니다."}
          >
            <input
              id={ids("msurl")}
              type="url"
              placeholder="https://apps.microsoft.com/detail/…"
              maxLength={200}
              value={draft.msStoreUrl}
              onChange={(e) => set({ msStoreUrl: e.target.value })}
              className={cx(inputClass, "h-11 font-mono text-sm")}
            />
          </Labeled>
          <Labeled id={ids("mscat")} label="Microsoft Store 분류">
            <select id={ids("mscat")} value={draft.msCategory} onChange={(e) => set({ msCategory: e.target.value })} className={cx(inputClass, "h-11")}>
              <option value="">고르지 않음</option>
              {Object.entries(msCategories).map(([v, label]) => (
                <option key={v} value={v}>
                  {label}
                </option>
              ))}
            </select>
          </Labeled>
        </div>
        <MsStoreExport draft={draft} msCategories={msCategories} notes={releaseNotes} />
      </Group>

      <Group title="자주 묻는 질문 · 관련 링크" description="모두 선택입니다.">
        <div className="space-y-3">
          <p className="text-sm font-semibold text-fg">자주 묻는 질문</p>
          {draft.faq.map((x, i) => (
            <div key={x.key} className="space-y-2 rounded-xl border border-line bg-canvas p-3">
              <div className="flex items-center gap-2">
                <label htmlFor={ids(`q-${x.key}`)} className="sr-only">{`질문 ${i + 1}`}</label>
                <input
                  id={ids(`q-${x.key}`)}
                  placeholder="질문"
                  maxLength={L.question}
                  value={x.q}
                  onChange={(e) => set({ faq: draft.faq.map((y) => (y.key === x.key ? { ...y, q: e.target.value } : y)) })}
                  className={cx(inputClass, "h-10 flex-1 text-sm")}
                />
                <button type="button" onClick={() => set({ faq: draft.faq.filter((y) => y.key !== x.key) })} className={cx(smallButton, "hover:text-danger")}>
                  <Trash2 aria-hidden="true" className="size-4" />
                  <span className="sr-only">{`질문 ${i + 1} 빼기`}</span>
                </button>
              </div>
              <label htmlFor={ids(`a-${x.key}`)} className="sr-only">{`답 ${i + 1}`}</label>
              <textarea
                id={ids(`a-${x.key}`)}
                placeholder="답"
                rows={2}
                maxLength={L.answer}
                value={x.a}
                onChange={(e) => set({ faq: draft.faq.map((y) => (y.key === x.key ? { ...y, a: e.target.value } : y)) })}
                className={cx(inputClass, "py-2 text-sm")}
              />
            </div>
          ))}
          <AddButton disabled={draft.faq.length >= L.faq} onClick={() => set({ faq: [...draft.faq, { key: newKey("q"), q: "", a: "" }] })}>
            질문 더하기
          </AddButton>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-fg">관련 링크</p>
          <p className="text-xs text-fg-subtle">홈페이지·소스 코드·사용 설명서 등. https 주소만, {L.links}개까지. 화면에 주소의 도메인이 함께 보입니다.</p>
          {draft.links.map((x, i) => (
            <div key={x.key} className="flex flex-wrap items-center gap-2 sm:flex-nowrap">
              <label htmlFor={ids(`ll-${x.key}`)} className="sr-only">{`링크 ${i + 1} 이름`}</label>
              <input
                id={ids(`ll-${x.key}`)}
                placeholder="이름 (예: GitHub)"
                maxLength={L.linkLabel}
                value={x.label}
                onChange={(e) => set({ links: draft.links.map((y) => (y.key === x.key ? { ...y, label: e.target.value } : y)) })}
                className={cx(inputClass, "h-10 text-sm sm:w-44")}
              />
              <label htmlFor={ids(`lu-${x.key}`)} className="sr-only">{`링크 ${i + 1} 주소`}</label>
              <input
                id={ids(`lu-${x.key}`)}
                type="url"
                placeholder="https://"
                maxLength={500}
                value={x.url}
                onChange={(e) => set({ links: draft.links.map((y) => (y.key === x.key ? { ...y, url: e.target.value } : y)) })}
                className={cx(inputClass, "h-10 min-w-0 flex-1 font-mono text-sm")}
              />
              <button type="button" onClick={() => set({ links: draft.links.filter((y) => y.key !== x.key) })} className={cx(smallButton, "hover:text-danger")}>
                <Trash2 aria-hidden="true" className="size-4" />
                <span className="sr-only">{`링크 ${i + 1} 빼기`}</span>
              </button>
            </div>
          ))}
          <AddButton disabled={draft.links.length >= L.links} onClick={() => set({ links: [...draft.links, { key: newKey("l"), label: "", url: "" }] })}>
            링크 더하기
          </AddButton>
        </div>
      </Group>

      <div className={panelClass}>
        <button type="button" aria-expanded={preview} onClick={() => setPreview(!preview)} className={buttonClass("secondary", "sm")}>
          <Eye aria-hidden="true" className="size-4" />
          {preview ? "미리보기 닫기" : "소개 화면 미리보기"}
        </button>
        {preview && <DraftPreview draft={draft} iconSrc={iconShown} categories={categories} kind={kind} />}
      </div>
    </div>
  );
}

function AddButton({ disabled, onClick, children }: { disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cx(buttonClass("ghost", "sm"), "-ml-2 disabled:opacity-40")}>
      <Plus aria-hidden="true" className="size-4" />
      {children}
    </button>
  );
}

/** 한 줄에 하나씩 쓰는 목록 칸 */
function LinesField({
  id,
  label,
  value,
  onChange,
  max,
  itemMax,
  rows,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  max: number;
  itemMax: number;
  rows: number;
  placeholder?: string;
}) {
  const items = splitLines(value);
  const long = items.filter((x) => charCount(x) > itemMax).length;
  return (
    <Labeled
      id={id}
      label={label}
      hint={`한 줄에 하나. ${max}개까지, 하나에 ${itemMax}자까지.${long ? ` ${long}개가 너무 깁니다.` : ""}`}
      extra={<span className={items.length > max || long ? "font-semibold text-danger" : "text-fg-subtle"}>{`${items.length} / ${max}`}</span>}
    >
      <textarea id={id} rows={rows} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={cx(inputClass, "py-3")} />
    </Labeled>
  );
}

/** 편집 중인 값으로 그린 상세 화면 (저장 전 확인용) */
function DraftPreview({ draft, iconSrc, categories, kind }: { draft: ListingDraft; iconSrc: string | null; categories: Record<string, string>; kind: ListingKind }) {
  const shown = draft.gallery.filter((g) => g.preview);
  const page: ListingPage = {
    ...emptyPage(),
    recommended: splitLines(draft.recommended),
    developer: draft.developer.trim(),
    copyright: draft.copyright.trim(),
    license: draft.license.trim(),
    website: draft.website.trim(),
    support: draft.support.trim(),
    privacy_url: draft.privacyUrl.trim(),
    ms_store_url: isMsStoreUrl(draft.msStoreUrl) ? draft.msStoreUrl.trim() : "",
    keywords: splitLines(draft.keywords, true),
    audience: splitLines(draft.audience),
    features: draft.features.filter((f) => f.title.trim()).map((f) => ({ title: f.title, text: f.text, image: f.image && shown.some((g) => g.key === f.image) ? f.image : null })),
    steps: splitLines(draft.steps),
    requirements: splitLines(draft.requirements),
    pricing: draft.pricing.trim(),
    faq: draft.faq.filter((x) => x.q.trim() && x.a.trim()),
    links: draft.links.filter((x) => x.url.trim()).map((x) => ({ label: x.label || x.url, url: x.url })),
    gallery: shown.map((g) => ({ id: g.key, caption: g.caption, width: 0, height: 0 })),
  };
  const src = new Map(shown.map((g) => [g.key, g.preview ?? ""]));
  return (
    <div className="mt-6 space-y-8 border-t border-line pt-6">
      <header className="flex items-center gap-4">
        {iconSrc && <img src={iconSrc} alt="" width={256} height={256} className="size-16 rounded-2xl bg-raised object-contain" />}
        <div className="min-w-0">
          <p className="text-sm text-fg-subtle">{categories[draft.category] ?? ""}</p>
          <p className="break-words text-2xl font-bold text-fg">{draft.name || "이름"}</p>
          {draft.summary && <p className="mt-1 text-fg-muted">{draft.summary}</p>}
          <div className="mt-3">
            <KeywordChips keywords={page.keywords} />
          </div>
        </div>
      </header>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <ListingMain page={page} description={draft.description} imageSrc={(key) => src.get(key) ?? ""} title={draft.name || "미리보기"} />
        <aside>
          <ListingFacts page={page} kind={kind} />
        </aside>
      </div>
    </div>
  );
}
