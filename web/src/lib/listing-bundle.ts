/**
 * 소개 자료 파일 불러오기 (ADR-0013): listing.md 하나, 또는 listing.md + images/ 를 묶은 zip.
 * 브라우저에서만 읽는다. 서버에는 정리한 값과 그림 파일(하나씩, 서버가 다시 그린다)만 보낸다.
 */
import { LISTING_LIMITS } from "./listing";
import { type ParsedListing, parseListingMarkdown } from "./listing-format";
import { ZipError, listZip } from "./zip";

export type ImportedListing = ParsedListing & {
  sourceName: string;
  /** md 가 가리킨 그림 경로 → 파일 (zip 에서 찾은 것만) */
  files: Map<string, File>;
  /** md 가 가리켰지만 파일이 없는 그림 경로 (md 만 올렸으면 전부) */
  missing: string[];
};

const MD = /\.(md|markdown|txt)$/i;
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

export const BUNDLE_ACCEPT = ".md,.markdown,.zip,text/markdown,application/zip";

export class BundleError extends Error {}

/** 소개 자료가 가리키는 그림 경로 전부 (아이콘·화면·기능) */
export function referencedImages(p: ParsedListing): string[] {
  const paths = [p.icon, ...p.gallery.map((g) => g.path), ...p.features.map((f) => f.image)].filter((x): x is string => Boolean(x));
  return [...new Set(paths)];
}

const baseName = (path: string) => path.split("/").pop() ?? path;

function join(dir: string, path: string): string {
  const parts = [...(dir ? dir.split("/") : []), ...path.split("/")].filter((x) => x && x !== ".");
  return parts.join("/");
}

export async function readListingFile(file: File): Promise<ImportedListing> {
  const lower = file.name.toLowerCase();
  if (MD.test(lower)) {
    if (file.size > 512 * 1024) throw new BundleError("소개 자료 md 파일이 너무 큽니다 (512KB 까지).");
    const parsed = parseListingMarkdown(await file.text());
    return { ...parsed, sourceName: file.name, files: new Map(), missing: referencedImages(parsed) };
  }
  if (!lower.endsWith(".zip")) throw new BundleError("listing.md 파일이나, listing.md 와 images 폴더를 묶은 zip 을 골라 주세요.");

  let entries;
  try {
    entries = listZip(await file.arrayBuffer()).filter((e) => !e.name.startsWith("__MACOSX/") && !baseName(e.name).startsWith("._"));
  } catch (err) {
    throw new BundleError(err instanceof ZipError ? err.message : "zip 파일을 읽지 못했습니다.");
  }
  const mds = entries.filter((e) => /\.(md|markdown)$/i.test(e.name)).sort((a, b) => a.name.split("/").length - b.name.split("/").length);
  const md = mds.find((e) => baseName(e.name).toLowerCase() === "listing.md") ?? (mds.length === 1 ? mds[0] : undefined);
  if (!md) throw new BundleError(mds.length ? "zip 안에 md 파일이 여러 개입니다. 소개 자료 파일 이름을 listing.md 로 해 주세요." : "zip 안에 listing.md 가 없습니다.");
  if (md.size > 512 * 1024) throw new BundleError("listing.md 가 너무 큽니다 (512KB 까지).");

  let parsed: ParsedListing;
  try {
    parsed = parseListingMarkdown(new TextDecoder("utf-8").decode(await md.read()));
  } catch (err) {
    throw new BundleError(err instanceof ZipError ? err.message : "listing.md 를 읽지 못했습니다.");
  }
  const dir = md.name.includes("/") ? md.name.slice(0, md.name.lastIndexOf("/")) : "";
  const byName = new Map(entries.map((e) => [e.name.toLowerCase(), e]));
  const files = new Map<string, File>();
  const missing: string[] = [];
  const notFound: string[] = [];
  const warnings = [...parsed.warnings];

  for (const path of referencedImages(parsed)) {
    const entry = byName.get(join(dir, path).toLowerCase());
    if (!entry) {
      missing.push(path);
      notFound.push(path);
      continue;
    }
    if (entry.size > LISTING_LIMITS.imageBytes) {
      warnings.push(`${path}: 그림이 5MB 를 넘어서 뺐습니다. 줄여서 다시 묶어 주세요.`);
      missing.push(path);
      continue;
    }
    try {
      const ext = path.split(".").pop()?.toLowerCase() ?? "";
      const bytes = await entry.read();
      files.set(path, new File([bytes.slice().buffer], baseName(path), { type: MIME[ext] ?? "application/octet-stream" }));
    } catch (err) {
      warnings.push(err instanceof ZipError ? err.message : `${path}: 그림을 꺼내지 못했습니다.`);
      missing.push(path);
    }
  }

  const used = new Set([...files.keys()].map((p) => join(dir, p).toLowerCase()));
  // ms/ 폴더(Microsoft Store 에만 올리는 그림)는 사이트에 넣지 않는다
  const msDir = join(dir, "ms").toLowerCase() + "/";
  const unused = entries.filter((e) => /\.(png|jpe?g|webp)$/i.test(e.name) && !used.has(e.name.toLowerCase()) && !e.name.toLowerCase().startsWith(msDir));
  if (unused.length) warnings.push(`listing.md 에서 쓰지 않은 그림 ${unused.length}장은 넣지 않았습니다: ${unused.slice(0, 5).map((e) => baseName(e.name)).join(", ")}${unused.length > 5 ? " …" : ""}`);
  if (notFound.length) warnings.push(`zip 에서 찾지 못한 그림: ${notFound.join(", ")}`);
  return { ...parsed, warnings, sourceName: file.name, files, missing };
}
