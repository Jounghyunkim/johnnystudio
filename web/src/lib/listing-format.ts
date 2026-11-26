/**
 * 소개 자료 파일 양식 "johnnystudio-listing/1" (ADR-0013): listing.md 를 읽어 양식 값으로 바꾼다.
 *
 *   ---                         ← 머리말 (YAML): 짧은 값
 *   format: johnnystudio-listing/1
 *   kind: store | showroom
 *   name / summary / category / url(showroom) / version(store) / pricing / keywords / icon / cover / cover_caption
 *   developer / copyright / license / website / support / privacy_url / ms_store_url / ms_category   (Microsoft Store 와 함께 쓰는 칸)
 *   ---
 *   (첫 ## 앞의 글은 상세 설명 앞부분)
 *   ## 이런 분께 추천해요 · ## 주요 기능(### 기능 이름) · ## 사용 방법 · ## 상세 설명 · ## 필요한 환경 · ## 권장 환경
 *   ## 자주 묻는 질문(### 질문) · ## 관련 링크 · ## 화면(![설명](images/…)) · ## 바뀐 점(store)
 *
 * 사람과 AI 가 조금 다르게 써도 읽도록 절 이름은 여러 가지를 받는다 (SECTION_ALIASES). 브라우저에서만 돈다 (서버는 결과 값을 다시 검사한다).
 * 이 파일을 바꾸면 양식 견본(listing-prompt.ts)과 안내 페이지(/store/guide/)도 함께 고친다.
 */
import { parse as parseYaml } from "yaml";

import { type ListingKind, LISTING_LIMITS, splitLines } from "./listing";

export const LISTING_FORMAT = "johnnystudio-listing/1";

export type ImageRef = { path: string; caption: string };

export type ParsedListing = {
  kind: ListingKind | null;
  fields: {
    name?: string;
    summary?: string;
    category?: string;
    url?: string;
    version?: string;
    notes?: string;
    description?: string;
  };
  pricing: string;
  keywords: string[];
  audience: string[];
  features: { title: string; text: string; image: string | null }[];
  steps: string[];
  requirements: string[];
  recommended: string[];
  faq: { q: string; a: string }[];
  links: { label: string; url: string }[];
  /** 만든 이·지원 정보 (Microsoft Store 등록 항목과 같은 칸) */
  meta: { developer: string; copyright: string; license: string; website: string; support: string; privacy_url: string; ms_store_url: string; ms_category: string };
  icon: string | null;
  /** 대표 그림이 있으면 맨 앞. 기능 그림은 따로 (features[].image) */
  gallery: ImageRef[];
  warnings: string[];
};

type SectionKey = "audience" | "features" | "steps" | "description" | "requirements" | "recommended" | "faq" | "links" | "gallery" | "notes" | "pricing" | "keywords";

/** 절 이름 (띄어쓰기·대소문자·이모지·문장부호를 빼고 비교한다) */
export const SECTION_ALIASES: Record<SectionKey, string[]> = {
  audience: ["이런분께추천해요", "이런분께추천합니다", "이런분께", "추천대상", "누가쓰면좋을까요", "audience", "whoisitfor"],
  features: ["주요기능", "기능", "핵심기능", "features", "keyfeatures"],
  steps: ["사용방법", "사용법", "시작하기", "howtouse", "gettingstarted", "steps", "usage"],
  description: ["상세설명", "자세한설명", "설명", "소개", "description", "about", "overview"],
  requirements: ["필요한환경", "요구사항", "시스템요구사항", "사용환경", "최소사양", "최소환경", "requirements", "systemrequirements", "minimumhardware", "minimum"],
  recommended: ["권장환경", "권장사양", "권장하드웨어", "recommended", "recommendedhardware"],
  faq: ["자주묻는질문", "질문과답", "faq"],
  links: ["관련링크", "링크", "links"],
  gallery: ["화면", "화면그림", "스크린샷", "갤러리", "screenshots", "gallery", "images"],
  notes: ["바뀐점", "변경사항", "이번버전", "releasenotes", "changelog", "whatsnew"],
  pricing: ["가격", "요금", "pricing", "price"],
  keywords: ["연관검색어", "검색어", "키워드", "태그", "keywords", "tags"],
};

const normalizeHeading = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

function sectionKey(heading: string): SectionKey | null {
  const h = normalizeHeading(heading);
  for (const [key, aliases] of Object.entries(SECTION_ALIASES) as [SectionKey, string[]][]) if (aliases.includes(h)) return key;
  return null;
}

const IMAGE_LINE = /^!\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"([^"]*)")?\s*\)\s*$/;
const LIST_ITEM = /^\s*(?:[-*+•]|\d+[.)])\s+(.*)$/;
const LINK = /^\[([^\]]*)\]\(\s*<?([^)\s>]+)>?\s*\)\s*$/;

/** 그림 경로: zip 안의 상대 경로만 (images/a.png). 바깥 주소·절대 경로·..는 받지 않는다 */
export function cleanImagePath(raw: string): string | null {
  const p = raw.trim().replace(/\\/g, "/").replace(/^\.\//, "");
  if (!p || p.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(p) || p.split("/").some((part) => part === "..")) return null;
  return /\.(png|jpe?g|webp)$/i.test(p) ? p : null;
}

function str(v: unknown): string | undefined {
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return undefined;
}

function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(str).filter((s): s is string => Boolean(s));
  const s = str(v);
  return s ? splitLines(s, true) : [];
}

function splitFrontMatter(text: string): { head: Record<string, unknown>; body: string; error: string | null } {
  const src = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(src);
  if (!m) return { head: {}, body: src, error: null };
  try {
    const head: unknown = parseYaml(m[1] ?? "");
    return { head: head && typeof head === "object" && !Array.isArray(head) ? (head as Record<string, unknown>) : {}, body: src.slice(m[0].length), error: null };
  } catch {
    return { head: {}, body: src.slice(m[0].length), error: "머리말(--- 사이의 YAML)을 읽지 못했습니다. 이름·분류 등을 직접 확인해 주세요." };
  }
}

/** 문단 글: 빈 줄 둘 이상을 하나로, 앞뒤 공백 제거 */
const tidy = (lines: string[]) => lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

function listItems(lines: string[]): string[] {
  const items: string[] = [];
  for (const line of lines) {
    const m = LIST_ITEM.exec(line);
    if (m) items.push((m[1] ?? "").trim());
    else if (line.trim() && items.length) items[items.length - 1] += ` ${line.trim()}`; // 줄바꿈된 항목
    else if (line.trim()) items.push(line.trim());
  }
  return items.filter(Boolean);
}

/** ### 소제목으로 나눈 묶음 (기능·질문) */
function subsections(lines: string[]): { title: string; lines: string[] }[] {
  const out: { title: string; lines: string[] }[] = [];
  for (const line of lines) {
    const m = /^###\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) out.push({ title: (m[1] ?? "").replace(/^(?:Q[.:]|질문[.:]?)\s*/i, "").trim(), lines: [] });
    else out.at(-1)?.lines.push(line);
  }
  return out;
}

const stripBold = (s: string) => s.replace(/^\*\*(.+)\*\*$/, "$1").trim();

export function parseListingMarkdown(text: string): ParsedListing {
  const { head, body, error } = splitFrontMatter(text);
  const warnings: string[] = error ? [error] : [];
  const result: ParsedListing = {
    kind: null,
    fields: {},
    pricing: "",
    keywords: [],
    audience: [],
    features: [],
    steps: [],
    requirements: [],
    recommended: [],
    faq: [],
    links: [],
    meta: { developer: "", copyright: "", license: "", website: "", support: "", privacy_url: "", ms_store_url: "", ms_category: "" },
    icon: null,
    gallery: [],
    warnings,
  };

  const format = str(head.format);
  if (format && format !== LISTING_FORMAT) warnings.push(`양식 판이 ${format} 입니다. ${LISTING_FORMAT} 기준으로 읽었습니다.`);
  const kind = str(head.kind);
  if (kind === "store" || kind === "showroom") result.kind = kind;
  for (const key of ["name", "summary", "category", "url", "version"] as const) {
    const v = str(head[key]);
    if (v) result.fields[key] = v;
  }
  if (!result.fields.name) {
    const title = str(head.title);
    if (title) result.fields.name = title;
  }
  result.pricing = str(head.pricing) ?? "";
  for (const key of Object.keys(result.meta) as (keyof ParsedListing["meta"])[]) {
    const camel = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    result.meta[key] = str(head[key]) ?? str(head[camel]) ?? "";
  }
  if (!result.meta.privacy_url) result.meta.privacy_url = str(head.privacy) ?? "";
  result.keywords = strList(head.keywords ?? head.tags);
  const icon = str(head.icon);
  if (icon) {
    result.icon = cleanImagePath(icon);
    if (!result.icon) warnings.push(`아이콘 경로를 쓸 수 없습니다: ${icon} (zip 안의 PNG·JPEG·WebP 상대 경로만)`);
  }
  const cover = str(head.cover);
  if (cover) {
    const path = cleanImagePath(cover);
    if (path) result.gallery.push({ path, caption: str(head.cover_caption) ?? str(head.coverCaption) ?? "대표 그림" });
    else warnings.push(`대표 그림 경로를 쓸 수 없습니다: ${cover}`);
  }

  // ## 절 나누기 (코드 블록 안의 # 는 제목이 아니다)
  const sections: { heading: string | null; lines: string[] }[] = [{ heading: null, lines: [] }];
  let fence = false;
  for (const line of body.split("\n")) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const m = !fence && /^##\s+(.+?)\s*#*\s*$/.exec(line);
    if (m) sections.push({ heading: m[1] ?? "", lines: [] });
    else sections.at(-1)?.lines.push(line);
  }

  const description: string[] = [];
  const intro = tidy((sections[0]?.lines ?? []).filter((l) => !/^#\s/.test(l))); // # 제목 줄(앱 이름)은 버린다
  if (intro) description.push(intro);

  for (const section of sections.slice(1)) {
    const heading = section.heading ?? "";
    const key = sectionKey(heading);
    const lines = section.lines;
    switch (key) {
      case "audience":
        result.audience.push(...listItems(lines));
        break;
      case "steps":
        result.steps.push(...listItems(lines));
        break;
      case "requirements":
        result.requirements.push(...listItems(lines));
        break;
      case "recommended":
        result.recommended.push(...listItems(lines));
        break;
      case "keywords":
        result.keywords.push(...listItems(lines).flatMap((s) => splitLines(s, true)));
        break;
      case "pricing":
        if (!result.pricing) result.pricing = tidy(lines).replace(/\s+/g, " ");
        break;
      case "description":
        description.push(tidy(lines));
        break;
      case "notes":
        result.fields.notes = tidy(lines);
        break;
      case "features":
        for (const sub of subsections(lines)) {
          let image: string | null = null;
          const text: string[] = [];
          for (const line of sub.lines) {
            const img = IMAGE_LINE.exec(line.trim());
            if (img) {
              const path = cleanImagePath(img[2] ?? "");
              if (path && !image) image = path;
              else if (!path) warnings.push(`기능 그림 경로를 쓸 수 없습니다: ${img[2]}`);
            } else text.push(line);
          }
          result.features.push({ title: stripBold(sub.title), text: tidy(text), image });
        }
        break;
      case "faq":
        for (const sub of subsections(lines)) result.faq.push({ q: stripBold(sub.title), a: tidy(sub.lines) });
        break;
      case "links":
        for (const item of listItems(lines)) {
          const md = LINK.exec(item);
          const plain = /^(.+?)\s*[:：]\s*(https?:\/\/\S+)$/.exec(item);
          if (md) result.links.push({ label: (md[1] ?? "").trim(), url: (md[2] ?? "").trim() });
          else if (plain) result.links.push({ label: (plain[1] ?? "").trim(), url: (plain[2] ?? "").trim() });
          else if (/^https?:\/\/\S+$/.test(item)) result.links.push({ label: "", url: item });
          else warnings.push(`관련 링크를 읽지 못했습니다: ${item.slice(0, 60)}`);
        }
        break;
      case "gallery":
        for (const line of lines) {
          const img = IMAGE_LINE.exec(line.trim());
          if (!img) continue;
          const path = cleanImagePath(img[2] ?? "");
          if (path) result.gallery.push({ path, caption: (img[3] || img[1] || "").trim() });
          else warnings.push(`화면 그림 경로를 쓸 수 없습니다: ${img[2]}`);
        }
        break;
      default: {
        // 모르는 절은 상세 설명에 그대로 넣는다 (글을 버리지 않는다)
        const block = tidy(lines);
        if (block) description.push(`### ${heading}\n\n${block}`);
        warnings.push(`'${heading}' 절은 양식에 없어서 상세 설명에 넣었습니다.`);
      }
    }
  }
  const desc = description.filter(Boolean).join("\n\n");
  if (desc) result.fields.description = desc;

  // 같은 그림을 두 번 쓰지 않는다 (기능 그림은 화면 목록에서 뺀다)
  const used = new Set(result.features.map((f) => f.image).filter(Boolean));
  const seen = new Set<string>();
  result.gallery = result.gallery.filter((g) => {
    if (used.has(g.path) || seen.has(g.path)) return false;
    seen.add(g.path);
    return true;
  });
  result.keywords = splitLines(result.keywords.join("\n"));

  limitWarnings(result);
  return result;
}

/** 한도를 넘는 값은 고치지 않고 알린다 (사람이 줄이게) */
function limitWarnings(r: ParsedListing): void {
  const L = LISTING_LIMITS;
  const w = r.warnings;
  const over = (label: string, value: string | undefined, max: number) => {
    if (value && Array.from(value).length > max) w.push(`${label}이(가) ${max}자를 넘습니다 (${Array.from(value).length}자).`);
  };
  over("이름", r.fields.name, L.name);
  over("한 줄 소개", r.fields.summary, L.summary);
  over("상세 설명", r.fields.description, L.description);
  over("바뀐 점", r.fields.notes, L.notes);
  over("가격", r.pricing, L.pricing);
  const many = (label: string, n: number, max: number) => {
    if (n > max) w.push(`${label}은(는) ${max}개까지입니다 (${n}개). 넘는 것은 빼고 채웠습니다.`);
  };
  many("연관 검색어", r.keywords.length, L.keywords);
  many("추천 대상", r.audience.length, L.audience);
  many("주요 기능", r.features.length, L.features);
  many("사용 방법", r.steps.length, L.steps);
  many("필요한 환경", r.requirements.length, L.requirements);
  many("권장 환경", r.recommended.length, L.requirements);
  many("자주 묻는 질문", r.faq.length, L.faq);
  many("관련 링크", r.links.length, L.links);
  const images = r.gallery.length + r.features.filter((f) => f.image).length;
  many("그림", images, L.gallery);
  r.keywords = r.keywords.slice(0, L.keywords);
  r.audience = r.audience.slice(0, L.audience);
  r.features = r.features.slice(0, L.features);
  r.steps = r.steps.slice(0, L.steps);
  r.requirements = r.requirements.slice(0, L.requirements);
  r.recommended = r.recommended.slice(0, L.requirements);
  r.faq = r.faq.slice(0, L.faq);
  r.links = r.links.slice(0, L.links);
  for (const f of r.features) {
    over(`기능 '${f.title}'의 설명`, f.text, L.featureText);
    over(`기능 이름 '${f.title}'`, f.title, L.featureTitle);
  }
  for (const k of r.keywords) over(`연관 검색어 '${k}'`, k, L.keyword);
  over("개발자", r.meta.developer, L.developer);
  over("저작권·상표 정보", r.meta.copyright, L.copyright);
  over("라이선스", r.meta.license, L.license);
  for (const g of r.gallery) over(`그림 설명 '${g.path}'`, g.caption, L.caption);
}
