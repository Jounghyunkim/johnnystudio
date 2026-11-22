/**
 * 1회용: JohnnyStore 보관본의 앱을 desktop-app 작품(초안)으로 옮긴다 (ADR-0011, docs/02_planning/features/johnnystore-integration.md §6 S1).
 *
 *   tar -xzf ~/workspace/backup/johnnystore/johnnystore-20261122.tar.gz -C .local/import
 *   cd web && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --import ./scripts/admin/ts-hooks.mjs \
 *     scripts/admin/import-johnnystore.ts ../.local/import/johnnystore [--dry-run]
 *
 * - 스토어 DB 는 읽기 전용으로 연다. 글(이름·한 줄 소개·설명·릴리스 노트)은 바꾸지 않고 형식만 Markdown 으로 바꾼다
 *   (■ 제목 → ##, • → -, 한 줄 = 한 문단). "■ 시스템 요구 사항" 의 첫 줄은 requirements 에도 복사한다
 *   릴리스 노트는 본문 끝 "## 변경 내역 / ### <버전>" 에 둔다 (여러 줄이라 다운로드 패널의 notes 한 문단에 맞지 않는다)
 * - 상태·날짜는 스토어와 같게 한다 (사용자 답 Q4): 운영 중, 2026-11-16 (스토어에 공개한 날)
 * - WLT·CMG Monitor 는 초안 ssh-terminal·hardware-monitor 와 같은 앱이다 (Q3). 초안을 휴지통으로 옮기고 그 태그를 이어받는다
 * - 쓰기는 모두 관리 도구(src/lib/admin/store.ts)를 거친다: 스키마 검사, 키 순서, 다운로드 파일 조각 받기·SHA-256
 * - 설치 파일의 SHA-256·크기가 스토어 DB 값과 다르면 멈춘다
 * - 만든 작품은 초안이다. 확인한 뒤 `npm run admin -- publish <slug>` 로 공개한다
 */
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { createAdminStore, UPLOAD_CHUNK_BYTES } from "../../src/lib/admin/store";

const WEB = path.resolve(import.meta.dirname, "../..");
const ROOT = path.dirname(WEB);

/** 스토어 config.py 의 CATEGORIES */
const CATEGORY_LABELS: Record<string, string> = {
  utility: "유틸리티",
  productivity: "생산성",
  developer: "개발 도구",
  media: "미디어",
  game: "게임",
  security: "보안",
  system: "시스템",
  other: "기타",
};
/** 같은 앱인 초안 (Q3). 초안의 태그를 이어받는다 */
const REPLACES: Record<string, string> = { wlt: "ssh-terminal", "cmg-monitor": "hardware-monitor" };
const PUBLISHED_ON = "2026-11-16";
const REQUIREMENTS_HEADING = "■ 시스템 요구 사항";

interface Row {
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  icon_file: string | null;
  version: string;
  filename: string;
  storage_key: string;
  size_bytes: number;
  sha256: string;
  architecture: string;
  is_signed: number;
  release_notes: string;
}

type Block = { kind: "heading" | "para" | "ul" | "ol"; text: string };

/** 스토어 글 → Markdown. 글자는 그대로 두고 줄의 종류만 바꾼다 */
export function storeTextToMarkdown(text: string, { squareIsHeading }: { squareIsHeading: boolean }): string {
  const blocks: Block[] = [];
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("■")) {
      const rest = line.replace(/^■\s*/, "");
      blocks.push(squareIsHeading ? { kind: "heading", text: `## ${rest}` } : { kind: "ul", text: `- ${rest}` });
    } else if (line.startsWith("•")) {
      blocks.push({ kind: "ul", text: `- ${line.replace(/^•\s*/, "")}` });
    } else if (/^\d+\.\s/.test(line)) {
      blocks.push({ kind: "ol", text: line });
    } else {
      blocks.push({ kind: "para", text: line });
    }
  }
  let out = "";
  blocks.forEach((b, i) => {
    const prev = blocks[i - 1];
    if (prev) out += (b.kind === "ul" || b.kind === "ol") && prev.kind === b.kind ? "\n" : "\n\n";
    out += b.text;
  });
  return out;
}

/**
 * "■ 시스템 요구 사항" 의 첫 줄(OS·런타임). 다운로드 버튼 옆 "필요 환경"에 보인다.
 * 둘째 줄부터는 안내·라이선스 고지가 섞여 있어서(Screen-REC) 옮기지 않고, 본문에 그 절을 그대로 둔다
 */
export function requirementsLine(description: string): string | undefined {
  const lines = description.replace(/\r\n/g, "\n").split("\n").map((l) => l.trim());
  const start = lines.indexOf(REQUIREMENTS_HEADING);
  if (start < 0) return undefined;
  const first = lines.slice(start + 1).find(Boolean);
  return first && !first.startsWith("■") ? first : undefined;
}

export function buildBody(row: Pick<Row, "description" | "release_notes" | "version">): { body: string; requirements?: string } {
  const requirements = requirementsLine(row.description);
  let body = storeTextToMarkdown(row.description, { squareIsHeading: true });
  const notes = row.release_notes.trim();
  if (notes) body += `\n\n## 변경 내역\n\n### ${row.version}\n\n${storeTextToMarkdown(notes, { squareIsHeading: false })}`;
  return { body: `${body}\n`, requirements };
}

async function* bytes(buf: Uint8Array): AsyncIterable<Uint8Array> {
  yield buf;
}

async function main(argv: string[]): Promise<number> {
  const dryRun = argv.includes("--dry-run");
  const dir = argv.find((a) => !a.startsWith("--"));
  if (!dir) {
    console.error("사용법: import-johnnystore.ts <풀어 둔 johnnystore 폴더> [--dry-run]");
    return 2;
  }
  const data = path.resolve(dir, "backend/data");
  const db = new DatabaseSync(path.join(data, "johnnystore.db"), { readOnly: true });
  const rows = db
    .prepare(
      `select a.slug, a.name, a.summary, a.description, a.category, a.icon_file,
              r.version, r.filename, r.storage_key, r.size_bytes, r.sha256, r.architecture, r.is_signed, r.release_notes
         from apps a join releases r on r.app_id = a.id
        order by a.id`,
    )
    .all() as unknown as Row[];
  db.close();

  const store = createAdminStore({
    contentDir: process.env.CONTENT_DIR || path.join(ROOT, "content"),
    publicDir: path.join(WEB, "public"),
    filesDir: process.env.JOHNNYSTUDIO_FILES_DIR || path.join(ROOT, ".local", "files"),
    trashDir: path.join(ROOT, ".local", "trash"),
  });
  console.log(`앱 ${rows.length}개, 다운로드 보관 폴더: ${store.paths.filesDir}${dryRun ? " (시험 실행: 쓰지 않음)" : ""}`);

  for (const row of rows) {
    const { body, requirements } = buildBody(row);
    const tags = [CATEGORY_LABELS[row.category] ?? row.category, "데스크톱"];
    const old = REPLACES[row.slug];
    if (old) {
      const draft = await store.get(old);
      for (const t of draft.tags) if (!tags.includes(t)) tags.push(t);
    }
    const installer = path.join(data, "storage/releases", row.storage_key);
    const icon = row.icon_file ? path.join(data, "storage/icons", row.icon_file) : null;
    console.log(`\n▶ ${row.slug} (${row.name} ${row.version}) 태그 [${tags.join(", ")}]${old ? `, 초안 ${old} 를 대신함` : ""}`);
    if (dryRun) {
      console.log(`  요구 사항: ${requirements ?? "(없음)"}\n  설치 파일: ${row.filename} ${row.size_bytes}B\n----- 본문\n${body}-----`);
      continue;
    }
    if (fs.existsSync(path.join(store.paths.contentDir, "assets", `${row.slug}.md`))) throw new Error(`이미 있다: content/assets/${row.slug}.md`);
    if (old) console.log(`  초안 정리: ${(await store.remove(old)).trashedTo}`);

    await store.create({ slug: row.slug, type: "desktop-app", title: row.name, summary: row.summary, date: PUBLISHED_ON });

    // 설치 파일: 관리 화면과 같은 조각 받기 (이름 다듬기·SHA-256)
    const fd = fs.openSync(installer, "r");
    let offset = 0;
    let uploaded: Awaited<ReturnType<typeof store.receiveFile>>["file"] = null;
    const uploadId = row.sha256.slice(0, 32); // 16진수여야 한다 (store.ts UPLOAD_ID)
    try {
      while (offset < row.size_bytes) {
        const buf = Buffer.alloc(Math.min(UPLOAD_CHUNK_BYTES, row.size_bytes - offset));
        fs.readSync(fd, buf, 0, buf.length, offset);
        const last = offset + buf.length >= row.size_bytes;
        const r = await store.receiveFile(row.slug, row.filename, bytes(buf), { uploadId, offset, last });
        offset = r.received;
        uploaded = r.file;
      }
    } finally {
      fs.closeSync(fd);
    }
    if (!uploaded || uploaded.sha256 !== row.sha256 || uploaded.size !== row.size_bytes) {
      throw new Error(`${row.slug}: 설치 파일 SHA-256·크기가 스토어 DB 와 다르다`);
    }
    console.log(`  설치 파일: ${uploaded.file} (SHA-256 일치)`);

    let iconPath: string | undefined;
    if (icon) {
      iconPath = (await store.saveMedia(row.slug, "icon.png", bytes(fs.readFileSync(icon)))).path;
      console.log(`  아이콘: ${iconPath}`);
    }

    const label = row.architecture && row.architecture !== "unknown" ? `Windows 설치 파일 (${row.architecture})` : "Windows 설치 파일";
    const saved = await store.save(row.slug, {
      baseMtime: (await store.get(row.slug)).mtime,
      data: {
        title: row.name,
        type: "desktop-app",
        summary: row.summary,
        status: "live",
        date: PUBLISHED_ON,
        tags,
        ...(iconPath ? { icon: iconPath } : {}),
        draft: true,
        ...(requirements ? { requirements } : {}),
        downloads: [
          {
            label,
            file: uploaded.file,
            version: row.version,
            os: ["windows"],
            size: uploaded.size,
            sha256: uploaded.sha256,
            released: PUBLISHED_ON,
            signed: row.is_signed === 1,
          },
        ],
      },
      body,
    });
    const verdict = saved.errors.length ? `✗ 문제 ${saved.errors.length}` : saved.missing.length ? `△ 채울 것 ${saved.missing.join(", ")}` : "✓ 공개할 수 있음";
    console.log(`  content/assets/${row.slug}.md → ${verdict}${saved.warnings.length ? ` (경고: ${saved.warnings.join(" / ")})` : ""}`);
  }
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    console.error(e);
    process.exit(1);
  },
);
