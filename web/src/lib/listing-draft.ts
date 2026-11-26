/**
 * 소개 자료 편집 상태 (ADR-0013). 새로 올리기와 고치기 화면이 함께 쓴다.
 *
 * 그림은 key 로 구분한다: 서버에 있는 그림은 id 를, 아직 올리지 않은 그림은 file 을 갖는다.
 * 저장할 때 새 그림을 먼저 올려 id 를 받고, 그 id 로 순서·설명·기능 연결을 보낸다 (saveListing).
 */
import type { ApiResult } from "./auth";
import { type GalleryImage, type ListingPage, LISTING_LIMITS, emptyPage, splitLines } from "./listing";
import type { ImportedListing } from "./listing-bundle";

export type DraftImage = {
  key: string;
  caption: string;
  /** 서버에 있는 그림 */
  saved?: GalleryImage;
  /** 아직 올리지 않은 그림 */
  file?: File;
  /** 미리보기 (서버 그림 주소 또는 작게 줄인 data: 그림. CSP img-src 에 blob: 이 없다) */
  preview?: string;
};

export type PendingImage = { path: string; caption: string; role: "icon" | "gallery" | "feature"; feature?: string };

export type DraftItem<T> = T & { key: string };

export type ListingDraft = {
  name: string;
  summary: string;
  description: string;
  category: string;
  url: string;
  version: string;
  notes: string;
  pricing: string;
  /** 쉼표·줄바꿈으로 나눈 글 (저장할 때 배열로) */
  keywords: string;
  audience: string;
  steps: string;
  requirements: string;
  recommended: string;
  /** 만든 이·지원 정보 (Microsoft Store 등록 항목과 같은 칸) */
  developer: string;
  copyright: string;
  license: string;
  website: string;
  support: string;
  privacyUrl: string;
  msStoreUrl: string;
  msCategory: string;
  features: DraftItem<{ title: string; text: string; image: string | null }>[];
  faq: DraftItem<{ q: string; a: string }>[];
  links: DraftItem<{ label: string; url: string }>[];
  gallery: DraftImage[];
  icon: { file: File; preview?: string } | null;
  /** 불러온 md 가 가리켰지만 아직 파일이 없는 그림. 같은 이름의 파일을 고르면 그 자리에 들어간다 */
  pending: PendingImage[];
};

let seq = 0;
export const newKey = (prefix = "k") => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export type DraftBase = { name?: string; summary?: string; description?: string; category?: string; url?: string; version?: string; notes?: string };

export function newDraft(base: DraftBase = {}, page: ListingPage = emptyPage(), imageSrc?: (id: string) => string): ListingDraft {
  const gallery: DraftImage[] = page.gallery.map((g) => ({ key: `img-${g.id}`, caption: g.caption, saved: g, preview: imageSrc?.(g.id) }));
  return {
    name: base.name ?? "",
    summary: base.summary ?? "",
    description: base.description ?? "",
    category: base.category ?? "",
    url: base.url ?? "",
    version: base.version ?? "",
    notes: base.notes ?? "",
    pricing: page.pricing,
    keywords: page.keywords.join(", "),
    audience: page.audience.join("\n"),
    steps: page.steps.join("\n"),
    requirements: page.requirements.join("\n"),
    recommended: page.recommended.join("\n"),
    developer: page.developer,
    copyright: page.copyright,
    license: page.license,
    website: page.website,
    support: page.support,
    privacyUrl: page.privacy_url,
    msStoreUrl: page.ms_store_url,
    msCategory: page.ms_category,
    features: page.features.map((f) => ({ key: newKey("f"), title: f.title, text: f.text, image: f.image ? `img-${f.image}` : null })),
    faq: page.faq.map((x) => ({ key: newKey("q"), ...x })),
    links: page.links.map((x) => ({ key: newKey("l"), ...x })),
    gallery,
    icon: null,
    pending: [],
  };
}

const baseName = (path: string) => (path.split("/").pop() ?? path).toLowerCase();

/**
 * 불러온 소개 자료로 양식을 채운다. 파일에 있는 칸만 덮어쓴다.
 * 파일에 그림이 있으면 그림 모음을 그 그림으로 바꾼다 (저장하기 전까지 서버의 그림은 그대로다).
 */
export function applyImport(
  draft: ListingDraft,
  imp: ImportedListing,
  categories: Record<string, string> | null,
  msCategories: Record<string, string> | null = null,
): { draft: ListingDraft; notes: string[] } {
  const notes: string[] = [];
  const d: ListingDraft = { ...draft };
  const f = imp.fields;
  if (f.name) d.name = f.name;
  if (f.summary) d.summary = f.summary;
  if (f.description) d.description = f.description;
  if (f.url) d.url = f.url;
  if (f.version) d.version = f.version;
  if (f.notes) d.notes = f.notes;
  if (f.category) {
    if (!categories || f.category in categories) d.category = f.category;
    else {
      const byLabel = Object.entries(categories).find(([, label]) => label === f.category);
      if (byLabel) d.category = byLabel[0];
      else notes.push(`분류 '${f.category}' 는 목록에 없어서 바꾸지 않았습니다.`);
    }
  }
  if (imp.pricing) d.pricing = imp.pricing;
  if (imp.keywords.length) d.keywords = imp.keywords.join(", ");
  if (imp.audience.length) d.audience = imp.audience.join("\n");
  if (imp.steps.length) d.steps = imp.steps.join("\n");
  if (imp.requirements.length) d.requirements = imp.requirements.join("\n");
  if (imp.recommended.length) d.recommended = imp.recommended.join("\n");
  const m = imp.meta;
  if (m.developer) d.developer = m.developer;
  if (m.copyright) d.copyright = m.copyright;
  if (m.license) d.license = m.license;
  if (m.website) d.website = m.website;
  if (m.support) d.support = m.support;
  if (m.privacy_url) d.privacyUrl = m.privacy_url;
  if (m.ms_store_url) d.msStoreUrl = m.ms_store_url;
  if (m.ms_category) {
    if (!msCategories || m.ms_category in msCategories) d.msCategory = m.ms_category;
    else {
      const hit = Object.entries(msCategories).find(([, label]) => label.toLowerCase().startsWith(m.ms_category.toLowerCase()));
      if (hit) d.msCategory = hit[0];
      else notes.push(`Microsoft Store 분류 '${m.ms_category}' 는 목록에 없어서 바꾸지 않았습니다.`);
    }
  }
  if (imp.faq.length) d.faq = imp.faq.map((x) => ({ key: newKey("q"), ...x }));
  if (imp.links.length) d.links = imp.links.map((x) => ({ key: newKey("l"), ...x }));

  const refs = new Map<string, string>(); // 그림 경로 → 그림 key
  const hasImages = imp.gallery.length > 0 || imp.features.some((x) => x.image);
  const pending: PendingImage[] = [];
  if (hasImages) {
    const removed = draft.gallery.filter((g) => g.saved).length;
    if (removed) notes.push(`저장된 그림 ${removed}장은 불러온 그림으로 바뀝니다 (저장해야 반영됩니다).`);
    d.gallery = [];
    const add = (path: string, caption: string, role: PendingImage["role"], feature?: string) => {
      const file = imp.files.get(path);
      if (!file) {
        pending.push({ path, caption, role, feature });
        return;
      }
      if (refs.has(path)) return;
      if (d.gallery.length >= LISTING_LIMITS.gallery) {
        notes.push(`그림은 ${LISTING_LIMITS.gallery}장까지라서 ${path} 는 넣지 않았습니다.`);
        return;
      }
      const key = newKey("img");
      refs.set(path, key);
      d.gallery.push({ key, caption, file });
    };
    imp.gallery.forEach((g) => add(g.path, g.caption, "gallery"));
    d.features = imp.features.map((x) => {
      const key = newKey("f");
      if (x.image) add(x.image, x.title, "feature", key);
      return { key, title: x.title, text: x.text, image: x.image ? (refs.get(x.image) ?? null) : null };
    });
  } else if (imp.features.length) {
    d.features = imp.features.map((x) => ({ key: newKey("f"), title: x.title, text: x.text, image: null }));
  }
  if (imp.icon) {
    const file = imp.files.get(imp.icon);
    if (file) d.icon = { file };
    else pending.push({ path: imp.icon, caption: "", role: "icon" });
  }
  d.pending = pending;
  return { draft: d, notes };
}

/**
 * 고른 그림 파일을 넣는다. 불러온 md 가 가리킨 그림과 이름이 같으면 그 자리(설명·기능·아이콘)에 넣는다.
 * 한도를 넘는 파일은 돌려준다 (rejected).
 */
export function addImages(draft: ListingDraft, files: File[]): { draft: ListingDraft; added: DraftImage[]; rejected: string[] } {
  const d: ListingDraft = { ...draft, gallery: [...draft.gallery], features: [...draft.features], pending: [...draft.pending] };
  const added: DraftImage[] = [];
  const rejected: string[] = [];
  for (const file of files) {
    if (file.size > LISTING_LIMITS.imageBytes) {
      rejected.push(`${file.name}: 5MB 를 넘습니다`);
      continue;
    }
    const hit = d.pending.findIndex((p) => baseName(p.path) === file.name.toLowerCase());
    const ref = hit >= 0 ? d.pending[hit] : null;
    if (ref?.role === "icon") {
      d.icon = { file };
      d.pending.splice(hit, 1);
      continue;
    }
    if (d.gallery.length >= LISTING_LIMITS.gallery) {
      rejected.push(`${file.name}: 그림은 ${LISTING_LIMITS.gallery}장까지입니다`);
      continue;
    }
    const image: DraftImage = { key: newKey("img"), caption: ref?.caption ?? "", file };
    d.gallery.push(image);
    added.push(image);
    if (ref) {
      d.pending.splice(hit, 1);
      if (ref.role === "feature" && ref.feature) d.features = d.features.map((x) => (x.key === ref.feature ? { ...x, image: image.key } : x));
    }
  }
  return { draft: d, added, rejected };
}

/** 그림을 뺀다 (기능 연결도 끊는다) */
export function removeImage(draft: ListingDraft, key: string): ListingDraft {
  return {
    ...draft,
    gallery: draft.gallery.filter((g) => g.key !== key),
    features: draft.features.map((f) => (f.image === key ? { ...f, image: null } : f)),
  };
}

export function moveItem<T>(items: readonly T[], index: number, step: number): T[] {
  const to = index + step;
  if (to < 0 || to >= items.length) return [...items];
  const out = [...items];
  const [a, b] = [out[index] as T, out[to] as T];
  out[index] = b;
  out[to] = a;
  return out;
}

export type PageInput = {
  keywords: string[];
  audience: string[];
  features: { title: string; text: string; image: string | null }[];
  steps: string[];
  requirements: string[];
  recommended: string[];
  pricing: string;
  faq: { q: string; a: string }[];
  links: { label: string; url: string }[];
  gallery: { id: string; caption: string }[];
  developer: string;
  copyright: string;
  license: string;
  website: string;
  support: string;
  privacy_url: string;
  ms_store_url: string;
  ms_category: string;
};

/** 서버로 보낼 소개 자료. ids: 그림 key → 서버 그림 id (올리지 못한 그림은 빠진다) */
export function pageInput(draft: ListingDraft, ids: Map<string, string>): PageInput {
  return {
    keywords: splitLines(draft.keywords, true),
    audience: splitLines(draft.audience),
    features: draft.features
      .filter((f) => f.title.trim() || f.text.trim())
      .map((f) => ({ title: f.title, text: f.text, image: f.image ? (ids.get(f.image) ?? null) : null })),
    steps: splitLines(draft.steps),
    requirements: splitLines(draft.requirements),
    recommended: splitLines(draft.recommended),
    pricing: draft.pricing,
    developer: draft.developer,
    copyright: draft.copyright,
    license: draft.license,
    website: draft.website,
    support: draft.support,
    privacy_url: draft.privacyUrl,
    ms_store_url: draft.msStoreUrl,
    ms_category: draft.msCategory,
    faq: draft.faq.filter((x) => x.q.trim() || x.a.trim()).map(({ q, a }) => ({ q, a })),
    links: draft.links.filter((x) => x.label.trim() || x.url.trim()).map(({ label, url }) => ({ label, url })),
    gallery: draft.gallery.flatMap((g) => {
      const id = ids.get(g.key);
      return id ? [{ id, caption: g.caption }] : [];
    }),
  };
}

export type ListingApi = {
  uploadIcon: (code: string, file: File) => Promise<ApiResult<unknown>>;
  uploadImage: (code: string, file: File) => Promise<ApiResult<{ image: GalleryImage }>>;
  savePage: (code: string, page: PageInput) => Promise<ApiResult<{ page: ListingPage }>>;
};

/**
 * 아이콘·새 그림을 올리고 소개 자료를 저장한다. 그림 하나가 실패해도 나머지는 저장한다 (failed 로 알린다).
 * progress 는 화면에 보일 진행 문구.
 */
export async function saveListing(
  api: ListingApi,
  code: string,
  draft: ListingDraft,
  progress: (label: string) => void,
): Promise<{ ok: true; page: ListingPage; failed: string[] } | { ok: false; message: string; failed: string[] }> {
  const failed: string[] = [];
  if (draft.icon) {
    progress("아이콘을 올리는 중");
    const r = await api.uploadIcon(code, draft.icon.file);
    if (!r.ok) failed.push(`아이콘: ${r.message}`);
  }
  const ids = new Map<string, string>();
  const fresh = draft.gallery.filter((g) => !g.saved && g.file);
  let n = 0;
  for (const g of draft.gallery) {
    if (g.saved) {
      ids.set(g.key, g.saved.id);
      continue;
    }
    if (!g.file) continue;
    n += 1;
    progress(`그림을 올리는 중 (${n}/${fresh.length})`);
    const r = await api.uploadImage(code, g.file);
    if (r.ok) ids.set(g.key, r.data.image.id);
    else failed.push(`${g.file.name}: ${r.message}`);
  }
  progress("소개 자료를 저장하는 중");
  const r = await api.savePage(code, pageInput(draft, ids));
  if (!r.ok) return { ok: false, message: r.message, failed };
  return { ok: true, page: r.data.page, failed };
}

/** 저장한 뒤의 편집 상태 (새 그림이 서버 그림이 된다) */
export function afterSave(draft: ListingDraft, page: ListingPage, imageSrc: (id: string) => string): ListingDraft {
  const fresh = newDraft(draft, page, imageSrc);
  return { ...fresh, name: draft.name, summary: draft.summary, description: draft.description, category: draft.category, url: draft.url, pending: draft.pending };
}
