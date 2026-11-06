/**
 * 콘텐츠 스키마. content/ 파일의 형식은 여기서 정한다. (ADR-0005, docs/02_planning/CONTENT_GUIDE.md)
 *
 * 스키마는 "형식"만 본다. 출시해도 될 만큼 채워졌는지는 content.ts 의 missingFields() 가 본다.
 * 그래서 초안(draft: true)은 비어 있는 칸이 있어도 통과한다.
 */
import { z } from "zod";

import { ASSET_STATUSES } from "./asset-types";

// 클라이언트 컴포넌트는 asset-types.ts 에서 직접 가져온다 (이 파일을 가져오면 zod 가 브라우저 번들에 들어간다)
export { ASSET_STATUSES, ASSET_TYPES, type AssetStatus, type AssetType } from "./asset-types";

export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** YYYY · YYYY-MM · YYYY-MM-DD. YAML 이 2025 를 숫자로 읽어도 받아 준다. */
export const PartialDate = z.preprocess(
  (v) => (typeof v === "number" ? String(v) : v),
  z
    .string()
    .regex(
      /^\d{4}(?:-(?:0[1-9]|1[0-2])(?:-(?:0[1-9]|[12]\d|3[01]))?)?$/,
      "날짜는 YYYY, YYYY-MM, YYYY-MM-DD 중 하나로 쓴다 (예: 2025-12-19)",
    ),
);

/** 사이트 안 경로(/media/…, /files/…) 또는 https 주소 */
const MediaPath = z
  .string()
  .refine((v) => v.startsWith("/") || v.startsWith("https://"), "'/' 로 시작하는 경로나 https:// 주소를 쓴다");

const HttpUrl = z.url({ protocol: /^https?$/, error: "http(s):// 로 시작하는 주소를 쓴다" });

const YoutubeId = z.string().regex(/^[A-Za-z0-9_-]{11}$/, "YouTube 영상 ID 는 11자다 (watch?v= 뒤의 값)");

const Photo = z.strictObject({
  src: MediaPath,
  alt: z.string().min(1, "사진마다 alt(대체 텍스트)를 쓴다"),
  caption: z.string().optional(),
});
export type Photo = z.infer<typeof Photo>;

const Link = z.strictObject({
  label: z.string().min(1),
  href: z.string().min(1),
});
export type Link = z.infer<typeof Link>;

export const OS_LIST = ["windows", "macos", "linux"] as const;

const Download = z.strictObject({
  label: z.string().min(1),
  /** /files/<slug>/<파일명> (nginx 가 /opt/johnnystudio/files 에서 내준다) 또는 https 주소 */
  file: MediaPath,
  /** YAML 은 1.2 를 숫자로 읽으므로 문자열로 바꿔 받는다 */
  version: z.preprocess((v) => (typeof v === "number" ? String(v) : v), z.string().min(1)),
  os: z.array(z.enum(OS_LIST)).min(1),
  /** 바이트 단위. scripts/file-meta.sh 로 구한다 */
  size: z.number().int().nonnegative().optional(),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/, "SHA-256 은 소문자 16진수 64자다")
    .optional(),
  released: PartialDate.optional(),
  signed: z.boolean().default(false),
  notes: z.string().optional(),
});
export type Download = z.infer<typeof Download>;

const base = {
  title: z.string().min(1),
  summary: z.string().min(1).max(140, "한 줄 소개는 140자 이내"),
  status: z.enum(ASSET_STATUSES),
  /** 처음 공개했거나 시작한 날 */
  date: PartialDate.optional(),
  updated: PartialDate.optional(),
  tags: z.array(z.string().min(1)).default([]),
  cover: MediaPath.optional(),
  coverAlt: z.string().optional(),
  featured: z.boolean().default(false),
  /** true 면 개발 미리보기(npm run dev)에서만 보이고 출시 빌드에서는 빠진다 */
  draft: z.boolean().default(false),
  links: z.array(Link).default([]),
};

export const AssetFrontmatter = z.discriminatedUnion("type", [
  z.strictObject({ ...base, type: z.literal("web-app"), url: HttpUrl.optional() }),
  z.strictObject({
    ...base,
    type: z.literal("desktop-app"),
    downloads: z.array(Download).default([]),
    requirements: z.string().optional(),
  }),
  z.strictObject({
    ...base,
    type: z.literal("web-package"),
    /** 포털과 다른 출처(샌드박스 도메인)의 주소. 같은 출처는 금지 (ideation R4) */
    playUrl: HttpUrl.optional(),
    download: Download.optional(),
  }),
  z.strictObject({ ...base, type: z.literal("video"), youtubeId: YoutubeId.optional() }),
  z.strictObject({ ...base, type: z.literal("gallery"), photos: z.array(Photo).default([]) }),
  z.strictObject({
    ...base,
    type: z.literal("article"),
    url: HttpUrl.optional(),
    source: z.string().optional(),
  }),
  z.strictObject({
    ...base,
    type: z.literal("hardware"),
    photos: z.array(Photo).default([]),
    youtubeId: YoutubeId.optional(),
  }),
]);
export type AssetFrontmatter = z.infer<typeof AssetFrontmatter>;

export type Asset = AssetFrontmatter & {
  slug: string;
  /** 본문 Markdown 을 HTML 로 바꾼 것 (저장소의 신뢰된 파일에서만 온다) */
  html: string;
};

export const LOG_KINDS = ["start", "release", "milestone", "note"] as const;
export type LogKind = (typeof LOG_KINDS)[number];

export const LogEntry = z.strictObject({
  date: PartialDate,
  title: z.string().min(1),
  kind: z.enum(LOG_KINDS).default("milestone"),
  description: z.string().optional(),
  /** 관련 에셋 slug */
  asset: z.string().regex(SLUG_PATTERN).optional(),
  href: z.string().optional(),
  draft: z.boolean().default(false),
});
export type LogEntry = z.infer<typeof LogEntry>;
export const LifeLog = z.array(LogEntry);

export const Profile = z.strictObject({
  name: z.string().min(1),
  tagline: z.string().min(1),
  intro: z.string().min(1),
  principles: z
    .array(
      z.strictObject({
        title: z.string().min(1),
        titleKo: z.string().min(1),
        summary: z.string().min(1),
      }),
    )
    .min(1),
  services: z.array(
    z.strictObject({
      title: z.string().min(1),
      summary: z.string().min(1),
      related: z.array(z.string().regex(SLUG_PATTERN)).default([]),
    }),
  ),
  process: z.array(
    z.strictObject({
      title: z.string().min(1),
      github: z.string().min(1),
      summary: z.string().min(1),
    }),
  ),
  contact: z.strictObject({
    email: z.email().optional(),
    note: z.string().optional(),
  }),
  links: z.array(Link).default([]),
  /** 홈(랜딩) 페이지 문구. 사이트 안 주소는 / 로 시작한다 */
  landing: z.strictObject({
    eyebrow: z.string().min(1),
    steps: z
      .array(
        z.strictObject({
          title: z.string().min(1),
          text: z.string().min(1),
          href: z.string().regex(/^\/(?!\/)/, "사이트 안 주소(/로 시작)"),
          action: z.string().min(1),
        }),
      )
      .min(1),
    faq: z.array(
      z.strictObject({
        q: z.string().min(1),
        a: z.string().min(1),
        link: z.strictObject({ label: z.string().min(1), href: z.string().regex(/^\/(?!\/)/, "사이트 안 주소(/로 시작)") }).optional(),
      }),
    ),
    closing: z.strictObject({ title: z.string().min(1), text: z.string().min(1) }),
  }),
});
export type Profile = z.infer<typeof Profile>;

/** content/pages/<slug>.md: 개인정보처리방침 같은 문서 페이지 */
export const PageFrontmatter = z.strictObject({
  title: z.string().min(1),
  description: z.string().min(1),
  updated: z.iso.date(),
});
export type PageFrontmatter = z.infer<typeof PageFrontmatter>;
export type Page = PageFrontmatter & { slug: string; html: string };
