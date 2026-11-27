/**
 * 작품 관리: content/assets 파일과 이미지·다운로드 파일을 다룬다. 서버(Node)에서만 쓴다.
 *
 * 원칙
 * - 원본은 지금처럼 content/ 의 파일이다. 이 모듈은 사람이 손으로 하던 일을 대신할 뿐이고, git 이 이력을 남긴다 (ADR-0005, ADR-0009).
 * - 스키마(schema.ts)를 통과하지 못하면 쓰지 않는다. 그래야 개발 서버·빌드가 깨지지 않는다.
 * - 공개(draft 지우기)는 완성도 검사(content.ts 의 missingFields)를 통과할 때만 한다.
 * - 쓰는 곳은 정해진 폴더 아래로만: content/assets, public/media/<slug>, 다운로드 보관 폴더/<slug>, 휴지통.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

import { ASSET_TYPES, type AssetStatus, ASSET_STATUSES, type AssetType } from "../asset-types";
import { listAssetFiles, localMediaExists, mediaPaths, missingFields, toAsset } from "../content";
import type { Asset } from "../schema";
import {
  applyData,
  AssetFileError,
  type AssetSource,
  createAssetText,
  parseAssetSource,
  serializeAssetSource,
  setField,
  sourceData,
  validateFrontmatter,
} from "./asset-file";
import { cleanValue, IMAGE_SOFT_LIMIT, SLUG_RE, SUMMARY_MAX, today } from "./fields";
import { templateBody, templateData } from "./templates";
import type {
  AdminAssetDetail,
  AdminAssetRow,
  AdminErrorBody,
  AdminIssue,
  AdminState,
  CreateAssetInput,
  SaveAssetInput,
  UploadedFile,
  UploadedMedia,
} from "./types";

export const PRODUCTION_FILES_DIR = "/opt/johnnystudio/files";
/*
 * 크기 한도. Next 개발 서버는 넘겨주는(rewrites) 요청 본문을 10MB 까지만 전달한다 (2026-11-09 확인).
 * 그래서 이미지는 8MB 까지 한 번에, 다운로드 파일은 8MB 조각으로 나눠 받아 이어 붙인다.
 */
export const MEDIA_MAX_BYTES = 8 * 1024 * 1024;
export const UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024;
export const FILE_MAX_BYTES = 4 * 1024 * 1024 * 1024;
const UPLOAD_ID = /^[a-f0-9]{16,64}$/;
const STALE_UPLOAD_MS = 24 * 60 * 60 * 1000;

/** 다운로드 파일 조각: 같은 uploadId 로 offset 순서대로 보내고, 마지막 조각에 last 를 켠다 */
export interface UploadChunk {
  uploadId: string;
  offset: number;
  last: boolean;
}

export interface AdminPaths {
  /** content/ */
  contentDir: string;
  /** web/public/ */
  publicDir: string;
  /** 다운로드 파일 보관 폴더 (운영이면 /opt/johnnystudio/files, 아니면 .local/files) */
  filesDir: string;
  /** 지운 작품을 옮겨 두는 곳 (.local/trash) */
  trashDir: string;
  /** 운영 다운로드 위치. 기본은 /opt/johnnystudio/files */
  productionFilesDir?: string;
}

/** 화면에 그대로 보여 줄 수 있는 오류 (HTTP 상태와 코드 포함) */
export class AdminError extends Error {
  override name = "AdminError";
  readonly status: number;
  readonly body: AdminErrorBody;
  constructor(status: number, code: string, message: string, extra: Omit<AdminErrorBody, "code" | "message"> = {}) {
    super(message);
    this.status = status;
    this.body = { code, message, ...extra };
  }
}

const IMAGE_TYPES: Record<string, (head: Buffer) => boolean> = {
  ".webp": (h) => h.subarray(0, 4).toString("latin1") === "RIFF" && h.subarray(8, 12).toString("latin1") === "WEBP",
  ".png": (h) => h.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  ".jpg": (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
  ".jpeg": (h) => h[0] === 0xff && h[1] === 0xd8 && h[2] === 0xff,
  ".avif": (h) => h.subarray(4, 8).toString("latin1") === "ftyp" && /^avi[fs]$/.test(h.subarray(8, 12).toString("latin1")),
};
export const IMAGE_EXTENSIONS = Object.keys(IMAGE_TYPES);

/**
 * 올린 파일 이름을 주소에 쓸 수 있게 다듬는다: 영문·숫자·.·-·_ 만 남기고, 숨김 파일(.으로 시작)을 막는다.
 * 남는 글자가 없으면(한글 이름 등) file-<시각> 을 쓴다.
 */
export function safeFileName(name: string, { lowerCase = true } = {}): string {
  const base = path.posix.basename(name.replace(/\\/g, "/")).normalize("NFKC");
  const ext = path.extname(base).toLowerCase().replace(/[^a-z0-9.]/g, "");
  let stem = base.slice(0, base.length - path.extname(base).length);
  if (lowerCase) stem = stem.toLowerCase();
  stem = stem
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9._-]/g, "")
    .replace(/-{2,}/g, "-")
    .replace(/^[.\-_]+|[.\-_]+$/g, "")
    .slice(0, 80);
  if (!stem) stem = `file-${Date.now().toString(36)}`;
  return `${stem}${ext}`;
}

function shellQuote(s: string): string {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

/** root 바깥을 가리키면 거부한다 (경로 탈출 방지) */
function inside(root: string, ...parts: string[]): string {
  const base = path.resolve(root);
  const target = path.resolve(base, ...parts);
  if (target !== base && !target.startsWith(base + path.sep)) throw new AdminError(400, "bad_path", "허용되지 않은 경로입니다.");
  return target;
}

function checkSlug(slug: string): string {
  if (!SLUG_RE.test(slug) || slug.length > 60) {
    throw new AdminError(400, "bad_slug", "주소(slug)는 영문 소문자·숫자·하이픈만 씁니다 (60자 이내, 예: hardware-monitor).");
  }
  return slug;
}

async function writeAtomic(file: string, text: string): Promise<void> {
  const tmp = `${file}.${process.pid}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fsp.writeFile(tmp, text, { encoding: "utf8", mode: 0o644 });
  await fsp.rename(tmp, file);
}

async function moveTo(from: string, to: string): Promise<void> {
  await fsp.mkdir(path.dirname(to), { recursive: true });
  try {
    await fsp.rename(from, to);
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "EXDEV") throw e;
    await fsp.cp(from, to, { recursive: true });
    await fsp.rm(from, { recursive: true, force: true });
  }
}

function tooLarge(limit: number): AdminError {
  const mb = limit / 1024 / 1024;
  return new AdminError(413, "too_large", `파일이 너무 큽니다 (최대 ${mb >= 1024 ? `${mb / 1024}GB` : `${mb}MB`}).`);
}

/** 요청 본문을 파일에 쓴다 (flag "wx" 새로, "a" 이어서). limit 을 넘으면 멈춘다. 지우기는 부르는 쪽이 한다 */
async function writeBody(body: AsyncIterable<Uint8Array>, file: string, flag: "wx" | "a", limit: number): Promise<number> {
  const handle = await fsp.open(file, flag, 0o644);
  let size = 0;
  try {
    for await (const chunk of body) {
      size += chunk.length;
      if (size > limit) throw tooLarge(limit);
      await handle.write(chunk);
    }
  } finally {
    await handle.close();
  }
  return size;
}

async function sha256Of(file: string): Promise<string> {
  const hash = crypto.createHash("sha256");
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk as Buffer);
  return hash.digest("hex");
}

/** 하루 넘게 끝나지 않은 업로드 조각을 지운다 (브라우저를 닫는 등으로 끊긴 것) */
async function removeStaleUploads(dir: string): Promise<void> {
  for (const name of await fsp.readdir(dir)) {
    if (!/^\..+\.[a-f0-9]{16,64}\.upload$/.test(name)) continue;
    const file = path.join(dir, name);
    const { mtimeMs } = await fsp.stat(file);
    if (Date.now() - mtimeMs > STALE_UPLOAD_MS) await fsp.rm(file, { force: true });
  }
}

function asString(v: unknown): string | undefined {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return undefined;
}

function kb(bytes: number): string {
  return `${Math.round(bytes / 1024)}KB`;
}

export type AdminStore = ReturnType<typeof createAdminStore>;

export function createAdminStore(paths: AdminPaths) {
  const assetsDir = path.join(paths.contentDir, "assets");
  const mediaRoot = path.join(paths.publicDir, "media");
  const productionFilesDir = paths.productionFilesDir ?? PRODUCTION_FILES_DIR;
  const filesAreProduction = path.resolve(paths.filesDir) === path.resolve(productionFilesDir);

  const assetFile = (slug: string) => inside(assetsDir, `${checkSlug(slug)}.md`);

  async function statOrNotFound(file: string, slug: string): Promise<fs.Stats> {
    try {
      return await fsp.stat(file);
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") throw new AdminError(404, "not_found", `작품이 없습니다: ${slug}`);
      throw e;
    }
  }

  /** Life Log·서비스가 가리키는 작품 slug → 가리키는 곳 이름 */
  function loadReferences(): Map<string, string[]> {
    const refs = new Map<string, string[]>();
    const add = (slug: unknown, label: string) => {
      if (typeof slug !== "string") return;
      refs.set(slug, [...(refs.get(slug) ?? []), label]);
    };
    const read = (name: string): unknown => {
      try {
        return parseYaml(fs.readFileSync(path.join(paths.contentDir, name), "utf8"));
      } catch {
        return null; // 형식 오류는 사이트 검사(content.test.ts)가 알려 준다
      }
    };
    const log = read("lifelog.yaml");
    if (Array.isArray(log)) {
      for (const e of log as Array<Record<string, unknown>>) add(e?.asset, `Life Log: ${asString(e?.date) ?? ""} ${asString(e?.title) ?? ""}`.trim());
    }
    const profile = read("profile.yaml") as { services?: Array<Record<string, unknown>> } | null;
    for (const s of profile?.services ?? []) {
      if (Array.isArray(s?.related)) for (const r of s.related) add(r, `서비스: ${asString(s.title) ?? ""}`);
    }
    return refs;
  }

  function checkAsset(asset: Asset): { errors: AdminIssue[]; missing: string[]; warnings: string[] } {
    const errors: AdminIssue[] = [];
    const warnings: string[] = [];
    // 아래 둘은 초안이어도 content.test.ts 가 막는다 (check.sh 실패)
    for (const p of mediaPaths(asset)) {
      const field = p === asset.cover ? "cover" : p === asset.icon ? "icon" : "photos";
      if (!localMediaExists(p, paths.publicDir)) errors.push({ path: field, message: `이미지 파일이 없다: ${p}` });
    }
    if (asset.cover && !asset.coverAlt) errors.push({ path: "coverAlt", message: "대표 이미지가 있으면 대체 텍스트(coverAlt)도 쓴다" });

    if (!asset.cover && !asset.icon) warnings.push("대표 이미지가 없다 (카드에 유형 아이콘이 대신 나온다)");
    if (asset.tags.length === 0) warnings.push("태그가 없다 (Library 검색과 '비슷한 작품'에 쓰인다)");
    if (!asset.html) warnings.push("소개 본문이 없다");
    for (const p of mediaPaths(asset)) {
      if (!p.startsWith("/media/")) continue;
      const file = path.join(paths.publicDir, p);
      if (!fs.existsSync(file)) continue;
      const size = fs.statSync(file).size;
      if (size > IMAGE_SOFT_LIMIT) warnings.push(`${p}: ${kb(size)} (기준 300KB 이하)`);
      // 아이콘은 작고 투명 배경이 흔해서 png 도 괜찮다
      if (!p.endsWith(".webp") && p !== asset.icon) warnings.push(`${p}: webp 가 아니다 (CONTENT_GUIDE §3)`);
    }
    const downloads =
      asset.type === "desktop-app" || asset.type === "android-app" ? asset.downloads : asset.type === "web-package" && asset.download ? [asset.download] : [];
    for (const d of downloads) {
      if (!d.file.startsWith("/files/")) continue;
      if (!fs.existsSync(path.join(paths.filesDir, d.file.slice("/files/".length)))) {
        warnings.push(`${d.file}: ${filesAreProduction ? "운영 다운로드 폴더에 없다" : "이 컴퓨터의 보관 폴더에 없다 (서버에 올렸는지 확인)"}`);
      }
    }
    return { errors, missing: missingFields(asset), warnings };
  }

  async function readDetail(slug: string, refs = loadReferences()): Promise<AdminAssetDetail> {
    const file = assetFile(slug);
    const stat = await statOrNotFound(file, slug);
    const raw = await fsp.readFile(file, "utf8");
    const row: AdminAssetDetail = {
      slug,
      title: slug,
      type: null,
      status: null,
      draft: false,
      featured: false,
      sample: slug.startsWith("sample-"),
      tags: [],
      errors: [],
      missing: [],
      warnings: [],
      references: refs.get(slug) ?? [],
      mtime: stat.mtimeMs,
      data: {},
      body: "",
    };
    let source: AssetSource;
    try {
      source = parseAssetSource(raw);
    } catch (e) {
      if (!(e instanceof AssetFileError)) throw e;
      return { ...row, errors: e.issues, body: raw };
    }
    const data = sourceData(source);
    Object.assign(row, {
      data,
      body: source.body,
      title: asString(data.title) || slug,
      type: (ASSET_TYPES as readonly unknown[]).includes(data.type) ? (data.type as AssetType) : null,
      status: (ASSET_STATUSES as readonly unknown[]).includes(data.status) ? (data.status as AssetStatus) : null,
      draft: data.draft === true,
      featured: data.featured === true,
      date: asString(data.date),
      updated: asString(data.updated),
      cover: asString(data.cover),
      coverAlt: asString(data.coverAlt),
      summary: asString(data.summary),
      tags: Array.isArray(data.tags) ? data.tags.filter((t): t is string => typeof t === "string") : [],
    });
    const valid = validateFrontmatter(data);
    if (!valid.ok) return { ...row, errors: valid.issues };
    return { ...row, ...checkAsset(toAsset(valid.value, slug, source.body)) };
  }

  async function readSource(slug: string): Promise<{ file: string; source: AssetSource }> {
    const file = assetFile(slug);
    await statOrNotFound(file, slug);
    try {
      return { file, source: parseAssetSource(await fsp.readFile(file, "utf8")) };
    } catch (e) {
      if (e instanceof AssetFileError) throw new AdminError(422, "invalid", "파일 형식이 틀려서 고칠 수 없습니다. 편집기로 먼저 고쳐 주세요.", { issues: e.issues });
      throw e;
    }
  }

  function log(message: string): void {
    console.log(`[작품 관리] ${message}`);
  }

  async function list(): Promise<AdminAssetRow[]> {
    const refs = loadReferences();
    const rows: AdminAssetRow[] = [];
    for (const name of listAssetFiles(assetsDir)) {
      const slug = name.replace(/\.md$/, "");
      if (!SLUG_RE.test(slug)) {
        rows.push({
          slug,
          title: name,
          type: null,
          status: null,
          draft: false,
          featured: false,
          sample: false,
          tags: [],
          errors: [{ path: "", message: "파일명은 영문 소문자·숫자·하이픈만 쓴다 (예: hardware-monitor.md)" }],
          missing: [],
          warnings: [],
          references: [],
          mtime: fs.statSync(path.join(assetsDir, name)).mtimeMs,
        });
        continue;
      }
      const { data: _data, body: _body, ...row } = await readDetail(slug, refs);
      void _data;
      void _body;
      rows.push(row);
    }
    return rows.sort((a, b) => b.mtime - a.mtime);
  }

  /**
   * 다운로드 파일 받기 (조각 단위). 크기·SHA-256 은 마지막 조각을 받은 뒤 완성된 파일에서 계산한다.
   * 이어 받는 중인 파일은 같은 폴더의 숨김 파일(.<이름>.<uploadId>.upload)이고, 끝나면 이름을 바꾼다.
   */
  async function receiveFile(slug: string, name: string, body: AsyncIterable<Uint8Array>, chunk: UploadChunk): Promise<{ received: number; file: UploadedFile | null }> {
    await statOrNotFound(assetFile(slug), slug);
    if (!UPLOAD_ID.test(chunk.uploadId)) throw new AdminError(400, "bad_request", "업로드 ID 형식이 틀렸습니다.");
    if (!Number.isSafeInteger(chunk.offset) || chunk.offset < 0) throw new AdminError(400, "bad_request", "offset 이 틀렸습니다.");
    const fileName = safeFileName(name, { lowerCase: false });
    const dir = inside(paths.filesDir, slug);
    await fsp.mkdir(dir, { recursive: true });
    const target = inside(dir, fileName);
    // 이미 공개된 파일을 덮으면 체크섬이 어긋난다. 버전마다 파일 이름을 바꾼다
    if (fs.existsSync(target)) throw new AdminError(409, "exists", `같은 이름의 파일이 있습니다: ${fileName} (버전마다 이름을 바꿔 주세요)`);
    const tmp = inside(dir, `.${fileName}.${chunk.uploadId}.upload`);

    if (chunk.offset === 0) {
      await removeStaleUploads(dir);
    } else {
      const have = await fsp.stat(tmp).then((st) => st.size, () => -1);
      if (have !== chunk.offset) {
        await fsp.rm(tmp, { force: true });
        throw new AdminError(409, "bad_offset", "업로드가 끊겼습니다. 처음부터 다시 올려 주세요.");
      }
    }
    let received: number;
    try {
      received = chunk.offset + (await writeBody(body, tmp, chunk.offset === 0 ? "wx" : "a", Math.min(UPLOAD_CHUNK_BYTES, FILE_MAX_BYTES - chunk.offset)));
      if (chunk.last && received === 0) throw new AdminError(400, "empty", "빈 파일입니다.");
    } catch (e) {
      await fsp.rm(tmp, { force: true }); // 이어 받을 수 없게 됐으므로 지운다 (처음부터 다시)
      throw e instanceof AdminError && e.body.code === "too_large" && chunk.offset > 0 ? tooLarge(FILE_MAX_BYTES) : e;
    }
    if (!chunk.last) return { received, file: null };

    try {
      if (fs.existsSync(target)) throw new AdminError(409, "exists", `같은 이름의 파일이 있습니다: ${fileName}`);
      const sha256 = await sha256Of(tmp);
      await fsp.rename(tmp, target);
      const prodTarget = path.posix.join(productionFilesDir, slug, fileName);
      log(`다운로드 파일: ${target} (${kb(received)})`);
      return {
        received,
        file: {
          file: `/files/${slug}/${fileName}`,
          size: received,
          sha256,
          released: today(),
          savedTo: target,
          installCommand: filesAreProduction ? null : `install -D -m 644 ${shellQuote(target)} ${shellQuote(prodTarget)}`,
        },
      };
    } catch (e) {
      await fsp.rm(tmp, { force: true });
      throw e;
    }
  }

  return {
    paths,
    filesAreProduction,
    list,
    receiveFile,

    async state(): Promise<AdminState> {
      const assets = await list();
      const tags = [...new Set(assets.flatMap((a) => a.tags))].sort((a, b) => a.localeCompare(b, "ko"));
      return { assets, tags, files: { dir: paths.filesDir, production: filesAreProduction } };
    },

    get: (slug: string) => readDetail(slug),

    async create(input: CreateAssetInput): Promise<AdminAssetDetail> {
      const slug = checkSlug(String(input.slug ?? "").trim());
      if (!(ASSET_TYPES as readonly unknown[]).includes(input.type)) throw new AdminError(400, "bad_type", "유형을 골라 주세요.");
      const title = String(input.title ?? "").trim();
      if (!title) throw new AdminError(400, "bad_title", "이름을 써 주세요.");
      if ((input.summary ?? "").trim().length > SUMMARY_MAX) throw new AdminError(400, "bad_summary", `한 줄 소개는 ${SUMMARY_MAX}자 이내로 씁니다.`);
      const data = templateData({ type: input.type, title, summary: input.summary, date: input.date?.trim() || undefined });
      const valid = validateFrontmatter(data);
      if (!valid.ok) throw new AdminError(422, "invalid", "입력값이 형식에 맞지 않습니다.", { issues: valid.issues });

      const file = assetFile(slug);
      try {
        await fsp.writeFile(file, createAssetText(data, templateBody(input.type)), { encoding: "utf8", flag: "wx", mode: 0o644 });
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "EEXIST") throw new AdminError(409, "exists", `같은 주소의 작품이 이미 있습니다: ${slug}`);
        throw e;
      }
      log(`새 초안: content/assets/${slug}.md`);
      return readDetail(slug);
    },

    async save(slug: string, input: SaveAssetInput): Promise<AdminAssetDetail> {
      const file = assetFile(slug);
      const stat = await statOrNotFound(file, slug);
      if (stat.mtimeMs !== input.baseMtime) {
        throw new AdminError(409, "conflict", "그사이 다른 곳(편집기·AI 도구)에서 파일이 바뀌었습니다. 다시 불러온 뒤 고쳐 주세요.");
      }
      if (!input.data || typeof input.data !== "object" || Array.isArray(input.data)) throw new AdminError(400, "bad_request", "data 는 객체여야 합니다.");
      const data = cleanValue(input.data) as Record<string, unknown>;
      const valid = validateFrontmatter(data);
      if (!valid.ok) throw new AdminError(422, "invalid", "형식에 맞지 않는 값이 있어 저장하지 않았습니다.", { issues: valid.issues });

      let source: AssetSource;
      try {
        source = parseAssetSource(await fsp.readFile(file, "utf8"));
      } catch (e) {
        if (!(e instanceof AssetFileError)) throw e;
        source = parseAssetSource(createAssetText(data, "")); // 깨진 파일은 새로 쓴다
      }
      applyData(source, data);
      source.body = String(input.body ?? "");
      const text = serializeAssetSource(source);
      // 쓴 결과를 다시 읽어 검사한다 (YAML 로 바꾸는 과정에서 값이 달라지지 않았는지)
      const check = validateFrontmatter(sourceData(parseAssetSource(text)));
      if (!check.ok) throw new AdminError(500, "roundtrip", "저장할 내용을 만들다가 형식이 달라졌습니다.", { issues: check.issues });
      await writeAtomic(file, text);
      log(`저장: content/assets/${slug}.md`);
      return readDetail(slug);
    },

    async publish(slug: string): Promise<AdminAssetDetail> {
      const detail = await readDetail(slug);
      if (detail.errors.length) throw new AdminError(409, "invalid", "검사를 통과하지 못하는 문제가 있어 공개할 수 없습니다.", { issues: detail.errors });
      if (detail.missing.length) throw new AdminError(409, "incomplete", "공개하려면 채워야 할 것이 남아 있습니다.", { missing: detail.missing });
      if (!detail.draft) return detail;
      const { file, source } = await readSource(slug);
      source.doc.delete("draft");
      await writeAtomic(file, serializeAssetSource(source));
      log(`공개: ${slug} (출시 빌드에 들어간다. 배포는 ./deploy/deploy.sh)`);
      return readDetail(slug);
    },

    async unpublish(slug: string): Promise<AdminAssetDetail> {
      const { file, source } = await readSource(slug);
      setField(source.doc, "draft", true);
      await writeAtomic(file, serializeAssetSource(source));
      log(`초안으로: ${slug}`);
      return readDetail(slug);
    },

    async remove(slug: string): Promise<{ trashedTo: string }> {
      const detail = await readDetail(slug);
      if (detail.data.draft !== true) {
        throw new AdminError(409, "published", "공개 중인 작품은 지울 수 없습니다. 먼저 초안으로 돌려 주세요.");
      }
      if (detail.references.length) {
        throw new AdminError(409, "referenced", "다른 곳에서 이 작품을 가리키고 있어 지울 수 없습니다.", { references: detail.references });
      }
      const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "");
      const to = inside(paths.trashDir, `${stamp}-${slug}.md`);
      await moveTo(assetFile(slug), to);
      const media = inside(mediaRoot, slug);
      if (fs.existsSync(media)) await moveTo(media, inside(paths.trashDir, `${stamp}-${slug}-media`));
      log(`휴지통으로: ${slug} → ${to}`);
      return { trashedTo: to };
    },

    async saveMedia(slug: string, name: string, body: AsyncIterable<Uint8Array>, { overwrite = false } = {}): Promise<UploadedMedia> {
      await statOrNotFound(assetFile(slug), slug);
      const fileName = safeFileName(name);
      const ext = path.extname(fileName);
      const matches = IMAGE_TYPES[ext];
      if (!matches) throw new AdminError(400, "bad_type", `이미지는 ${IMAGE_EXTENSIONS.join(", ")} 만 올립니다.`);
      const dir = inside(mediaRoot, slug);
      await fsp.mkdir(dir, { recursive: true });
      const target = inside(dir, fileName);
      const tmp = `${target}.${crypto.randomBytes(4).toString("hex")}.upload`;
      let size = 0;
      try {
        size = await writeBody(body, tmp, "wx", MEDIA_MAX_BYTES);
        if (size === 0) throw new AdminError(400, "empty", "빈 파일입니다.");
        const head = Buffer.alloc(16);
        const fh = await fsp.open(tmp, "r");
        await fh.read(head, 0, 16, 0);
        await fh.close();
        if (!matches(head)) throw new AdminError(400, "bad_content", `파일 내용이 ${ext} 이미지가 아닙니다.`);
        if (!overwrite && fs.existsSync(target)) throw new AdminError(409, "exists", `같은 이름의 이미지가 있습니다: ${fileName}`);
        await fsp.rename(tmp, target);
      } catch (e) {
        await fsp.rm(tmp, { force: true });
        throw e;
      }
      const warnings: string[] = [];
      if (size > IMAGE_SOFT_LIMIT) warnings.push(`${kb(size)}: 기준(300KB)보다 큽니다. 가로 1200px 이하로 줄이면 빨라집니다.`);
      if (ext !== ".webp") warnings.push("webp 로 바꾸면 더 작아집니다 (CONTENT_GUIDE §3).");
      log(`이미지: /media/${slug}/${fileName} (${kb(size)})`);
      return { path: `/media/${slug}/${fileName}`, size, warnings };
    },

    /** 한 번에 받기 (8MB 이하, CLI·테스트용) */
    async saveFile(slug: string, name: string, body: AsyncIterable<Uint8Array>): Promise<UploadedFile> {
      const r = await receiveFile(slug, name, body, { uploadId: crypto.randomBytes(16).toString("hex"), offset: 0, last: true });
      return r.file!;
    },
  };
}
