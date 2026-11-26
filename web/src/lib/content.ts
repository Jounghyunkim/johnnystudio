/**
 * content/ 읽기. 빌드할 때 서버(Node)에서만 쓴다. 클라이언트 컴포넌트에서 import 하지 않는다.
 *
 *   content/profile.yaml        홈·About·Work with me 문구
 *   content/assets/<slug>.md    에셋 하나 = 파일 하나 (YAML 머리말 + Markdown 본문)
 *   content/lifelog.yaml        Life Log 마일스톤
 *
 * 형식이 틀리면 빌드가 멈춘다. 출시 빌드에서는 draft 항목이 빠진다.
 */
import fs from "node:fs";
import path from "node:path";
import { marked } from "marked";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";

import {
  type Asset,
  AssetFrontmatter,
  LifeLog,
  type LogEntry,
  type Page,
  PageFrontmatter,
  Profile,
  SLUG_PATTERN,
} from "./schema";
import type { AssetSummary, OfficialShowroomService, OfficialStoreApp, TimelineItem } from "./types";

export const CONTENT_DIR = process.env.CONTENT_DIR ?? path.join(process.cwd(), "..", "content");
export const PUBLIC_DIR = path.join(process.cwd(), "public");

/** 개발 미리보기에서는 초안을 보여 주고, 출시 빌드에서는 뺀다. SHOW_DRAFTS=1 이면 출시 빌드에도 넣는다. */
export function includeDrafts(): boolean {
  return process.env.NODE_ENV !== "production" || process.env.SHOW_DRAFTS === "1";
}

export class ContentError extends Error {
  override name = "ContentError";
}

function rel(file: string): string {
  return path.relative(path.join(CONTENT_DIR, ".."), file);
}

function formatIssues(file: string, error: z.ZodError): string {
  return error.issues
    .map((i) => `${rel(file)}: ${i.path.length ? i.path.join(".") : "(전체)"}: ${i.message}`)
    .join("\n");
}

function readYaml(file: string): unknown {
  try {
    return parseYaml(fs.readFileSync(file, "utf8"));
  } catch (e) {
    throw new ContentError(`${rel(file)}: YAML 을 읽을 수 없다: ${(e as Error).message}`);
  }
}

/** "---\n<YAML>\n---\n<본문>" 을 나눈다. 머리말이 없으면 null (관리 도구도 쓴다) */
export function splitFrontmatterText(raw: string): { yaml: string; body: string } | null {
  const m = /^---\n([\s\S]*?)\n---\n?([\s\S]*)$/.exec(raw);
  return m ? { yaml: m[1] ?? "", body: (m[2] ?? "").trim() } : null;
}

function splitFrontmatter(file: string): { data: unknown; body: string } {
  const parts = splitFrontmatterText(fs.readFileSync(file, "utf8"));
  if (!parts) throw new ContentError(`${rel(file)}: 맨 위에 --- 로 둘러싼 YAML 머리말이 없다`);
  try {
    return { data: parseYaml(parts.yaml), body: parts.body };
  } catch (e) {
    throw new ContentError(`${rel(file)}: 머리말 YAML 을 읽을 수 없다: ${(e as Error).message}`);
  }
}

/** Markdown 본문 → HTML (저장소의 신뢰된 파일에서만 온다) */
export function renderMarkdown(body: string): string {
  if (!body) return "";
  const html = marked.parse(body, { async: false, gfm: true }) as string;
  // 외부 링크는 새 탭으로 연다 (AGENTS.md: target="_blank" rel="noopener noreferrer"). 본문에 그냥 적은 https 주소도 링크가 된다
  return html.replace(/<a href="(https?:\/\/[^"]*)"/g, '<a href="$1" target="_blank" rel="noopener noreferrer"');
}

/** 검증된 머리말 + slug + 본문 → 화면에서 쓰는 에셋 */
export function toAsset(data: AssetFrontmatter, slug: string, body: string): Asset {
  return { ...data, slug, html: renderMarkdown(body) };
}

/** content/assets 에서 읽는 파일 이름 (_ 로 시작하는 메모 파일은 뺀다) */
export function listAssetFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".md") && !f.startsWith("_"))
    .sort();
}

/*
 * 캐시: 출시 빌드는 한 번만 읽는다. 개발 서버는 오래 떠 있으므로 파일의 수정 시각·크기가 바뀌면 다시 읽는다
 * (예전에는 처음 읽은 결과를 계속 써서, 콘텐츠를 고쳐도 개발 서버를 다시 켜야 화면에 나왔다).
 * 읽다가 오류가 나면 캐시하지 않는다: 파일을 고치고 새로 고치면 바로 다시 읽는다.
 */
const caches = new Map<string, { stamp: string; value: unknown }>();

function fileStamp(file: string): string {
  try {
    const s = fs.statSync(file);
    return `${s.mtimeMs}:${s.size}`;
  } catch {
    return "-";
  }
}

function cached<T>(key: string, files: () => string[], load: () => T): T {
  const stamp = process.env.NODE_ENV === "production" ? "" : files().map((f) => `${f}@${fileStamp(f)}`).join("|");
  const hit = caches.get(key);
  if (hit && hit.stamp === stamp) return hit.value as T;
  const value = load();
  caches.set(key, { stamp, value });
  return value;
}

/** 초안을 포함한 모든 에셋. 날짜 최신순 (날짜 없는 초안은 맨 뒤) */
export function loadAllAssets(): Asset[] {
  const dir = path.join(CONTENT_DIR, "assets");
  return cached("assets", () => listAssetFiles(dir).map((f) => path.join(dir, f)), () => readAssets(dir));
}

function readAssets(dir: string): Asset[] {
  const files = listAssetFiles(dir);
  const problems: string[] = [];
  const assets: Asset[] = [];
  for (const name of files) {
    const file = path.join(dir, name);
    const slug = name.replace(/\.md$/, "");
    if (!SLUG_PATTERN.test(slug)) {
      problems.push(`${rel(file)}: 파일명은 영문 소문자·숫자·하이픈만 쓴다 (예: hardware-monitor.md)`);
      continue;
    }
    const { data, body } = splitFrontmatter(file);
    const parsed = AssetFrontmatter.safeParse(data);
    if (!parsed.success) {
      problems.push(formatIssues(file, parsed.error));
      continue;
    }
    assets.push(toAsset(parsed.data, slug, body));
  }
  if (problems.length) throw new ContentError(`콘텐츠 형식 오류\n${problems.join("\n")}`);

  assets.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || a.title.localeCompare(b.title, "ko"));
  return assets;
}

/** 지금 빌드에 보여 줄 에셋 */
export function getAssets(): Asset[] {
  const drafts = includeDrafts();
  return loadAllAssets().filter((a) => drafts || !a.draft);
}

export function getAsset(slug: string): Asset | undefined {
  return getAssets().find((a) => a.slug === slug);
}

/** Store 목록에 함께 보일 공개된 Windows 앱 (초안 제외, 최신 Windows 파일 기준) */
export function getOfficialStoreApps(): OfficialStoreApp[] {
  const apps: OfficialStoreApp[] = [];
  for (const a of getAssets()) {
    // Store DB 로 옮긴 앱(storeApp)은 DB 의 것이 '공식'으로 보인다 (ADR-0014)
    if (a.type !== "desktop-app" || a.draft || a.storeApp) continue;
    const win = a.downloads.find((d) => d.os.includes("windows"));
    if (!win) continue;
    apps.push({
      slug: a.slug,
      title: a.title,
      summary: a.summary,
      tags: a.tags,
      image: a.icon ?? a.cover,
      version: win.version,
      size: win.size,
      date: win.released ?? a.date,
      microsoftStore: a.microsoftStore,
    });
  }
  return apps;
}

/** Showroom 목록에 함께 보일 공개된 웹 서비스 (초안 제외, 주소가 있는 것) */
export function getOfficialShowroomServices(): OfficialShowroomService[] {
  const services: OfficialShowroomService[] = [];
  for (const a of getAssets()) {
    if (a.type !== "web-app" || a.draft || !a.url || a.showroomService) continue;
    services.push({ slug: a.slug, title: a.title, summary: a.summary, tags: a.tags, image: a.icon ?? a.cover, url: a.url, date: a.updated ?? a.date });
  }
  return services;
}

export function detailHref(slug: string): string {
  return `/library/${slug}/`;
}

/** 카드에서 바로 여는 외부 링크 */
function quickAction(a: Asset): AssetSummary["quickAction"] {
  switch (a.type) {
    case "web-app":
      return a.url ? { label: "실행", href: a.url } : undefined;
    case "web-package":
      return a.playUrl ? { label: "체험", href: a.playUrl } : undefined;
    case "article":
      return a.url ? { label: "읽기", href: a.url } : undefined;
    case "desktop-app":
      return a.microsoftStore ? { label: "MS Store", href: a.microsoftStore, icon: "microsoft-store" } : undefined;
    default:
      return undefined;
  }
}

export function toSummary(a: Asset): AssetSummary {
  return {
    slug: a.slug,
    title: a.title,
    type: a.type,
    summary: a.summary,
    status: a.status,
    date: a.date,
    tags: a.tags,
    cover: a.cover,
    coverAlt: a.coverAlt,
    icon: a.icon,
    featured: a.featured,
    draft: a.draft,
    quickAction: quickAction(a),
  };
}

export function loadLifeLog(): LogEntry[] {
  const file = path.join(CONTENT_DIR, "lifelog.yaml");
  return cached("lifelog", () => [file], () => {
    const parsed = LifeLog.safeParse(readYaml(file) ?? []);
    if (!parsed.success) throw new ContentError(`콘텐츠 형식 오류\n${formatIssues(file, parsed.error)}`);
    return parsed.data;
  });
}

/**
 * Life Log 타임라인: 마일스톤 + 에셋. 마일스톤이 이미 가리키는 에셋은 중복해서 넣지 않는다. 최신순.
 */
export function getTimeline(): TimelineItem[] {
  const drafts = includeDrafts();
  const assets = getAssets();
  const visible = new Set(assets.map((a) => a.slug));
  const entries = loadLifeLog().filter((e) => drafts || !e.draft);
  const covered = new Set(entries.map((e) => e.asset).filter(Boolean));

  const items: TimelineItem[] = entries.map((e) => {
    const asset = e.asset && visible.has(e.asset) ? assets.find((a) => a.slug === e.asset) : undefined;
    return {
      date: e.date,
      title: e.title,
      kind: e.kind,
      description: e.description,
      href: e.href ?? (asset ? detailHref(asset.slug) : undefined),
      assetType: asset?.type,
      draft: e.draft,
    };
  });
  for (const a of assets) {
    if (covered.has(a.slug) || !a.date) continue;
    items.push({
      date: a.date,
      title: a.title,
      kind: "asset",
      description: a.summary,
      href: detailHref(a.slug),
      assetType: a.type,
      draft: a.draft,
    });
  }
  return items.sort((x, y) => y.date.localeCompare(x.date));
}

export function getProfile(): Profile {
  const file = path.join(CONTENT_DIR, "profile.yaml");
  return cached("profile", () => [file], () => {
    const parsed = Profile.safeParse(readYaml(file));
    if (!parsed.success) throw new ContentError(`콘텐츠 형식 오류\n${formatIssues(file, parsed.error)}`);
    return parsed.data;
  });
}

/** content/pages/<slug>.md (개인정보처리방침 같은 문서 페이지) */
export function getPage(slug: string): Page {
  const file = path.join(CONTENT_DIR, "pages", `${slug}.md`);
  return cached(`page:${slug}`, () => [file], () => {
    if (!fs.existsSync(file)) throw new ContentError(`${rel(file)}: 파일이 없다`);
    const { data, body } = splitFrontmatter(file);
    const parsed = PageFrontmatter.safeParse(data);
    if (!parsed.success) throw new ContentError(`콘텐츠 형식 오류\n${formatIssues(file, parsed.error)}`);
    return { ...parsed.data, slug, html: renderMarkdown(body) } satisfies Page;
  });
}

const PLACEHOLDER_SHA = /^(0{64}|f{64})$/;

/**
 * 출시해도 될 만큼 채워졌는가. 초안이 아닌 에셋은 이 목록이 비어 있어야 한다.
 */
export function missingFields(a: Asset): string[] {
  const missing: string[] = [];
  if (!a.date) missing.push("date");
  if (a.slug.startsWith("sample-")) missing.push("sample- 로 시작하는 에셋은 예시라서 출시할 수 없다 (draft: true 유지)");
  switch (a.type) {
    case "web-app":
    case "article":
      if (!a.url) missing.push("url");
      break;
    case "desktop-app":
      if (a.downloads.length === 0) missing.push("downloads (1개 이상)");
      a.downloads.forEach((d, i) => {
        if (d.size === undefined) missing.push(`downloads.${i}.size`);
        if (!d.sha256 || PLACEHOLDER_SHA.test(d.sha256)) missing.push(`downloads.${i}.sha256`);
      });
      break;
    case "web-package":
      if (!a.playUrl && !a.download) missing.push("playUrl 또는 download");
      break;
    case "video":
      if (!a.youtubeId) missing.push("youtubeId");
      break;
    case "gallery":
      if (a.photos.length === 0) missing.push("photos (1장 이상)");
      break;
    case "hardware":
      if (a.photos.length === 0 && !a.youtubeId) missing.push("photos 또는 youtubeId");
      break;
  }
  const { html, ...rest } = a;
  if (JSON.stringify(rest).includes("TODO(")) missing.push("TODO( 표시가 남아 있다");
  if (html.includes("TODO(")) missing.push("본문에 TODO( 표시가 남아 있다");
  return missing;
}

/** 사이트 안 경로가 public/ 에 실제로 있는가. /files/ 는 서버에만 있으므로 검사하지 않는다 */
export function localMediaExists(src: string, publicDir: string = PUBLIC_DIR): boolean {
  if (!src.startsWith("/") || src.startsWith("/files/")) return true;
  return fs.existsSync(path.join(publicDir, src));
}

/** 에셋이 쓰는 사이트 안 이미지 경로 */
export function mediaPaths(a: Asset): string[] {
  const list: string[] = [];
  if (a.cover) list.push(a.cover);
  if (a.icon) list.push(a.icon);
  if (a.type === "gallery" || a.type === "hardware") list.push(...a.photos.map((p) => p.src));
  return list;
}
