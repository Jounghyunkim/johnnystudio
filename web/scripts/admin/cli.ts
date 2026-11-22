/**
 * 작품 관리 CLI. 관리 화면(/admin/)과 같은 로직(src/lib/admin)을 쓴다. AI 도구·터미널에서 쓴다 (ADR-0009).
 *
 *   npm --prefix web run admin -- list                         작품 목록과 검사 결과
 *   npm --prefix web run admin -- check [slug…]                자세한 검사 (문제가 있으면 종료 코드 1)
 *   npm --prefix web run admin -- new <slug> --type <유형> --title <이름> [--summary <한 줄>] [--date YYYY-MM]
 *   npm --prefix web run admin -- publish <slug>               완성도 검사를 통과하면 공개 (draft 지움)
 *   npm --prefix web run admin -- unpublish <slug>             초안으로 (draft: true)
 *   npm --prefix web run admin -- serve                        관리 서버 (dev.sh 가 띄운다)
 *
 * 유형: web-app desktop-app web-package video gallery article hardware
 * 환경 변수: CONTENT_DIR, JOHNNYSTUDIO_FILES_DIR(다운로드 보관 폴더), serve 는 JOHNNYSTUDIO_ADMIN_TOKEN_FILE·JOHNNYSTUDIO_ADMIN_PORT
 */
import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { ASSET_TYPES, type AssetType } from "../../src/lib/asset-types";
import { createAdminServer } from "../../src/lib/admin/server";
import { AdminError, type AdminPaths, createAdminStore } from "../../src/lib/admin/store";
import type { AdminAssetRow } from "../../src/lib/admin/types";
import { STATUS_LABELS, TYPE_LABELS } from "../../src/lib/labels";

const WEB = path.resolve(import.meta.dirname, "../..");
const ROOT = path.dirname(WEB);

export function defaultPaths(env: NodeJS.ProcessEnv = process.env): AdminPaths {
  return {
    contentDir: env.CONTENT_DIR || path.join(ROOT, "content"),
    publicDir: path.join(WEB, "public"),
    filesDir: env.JOHNNYSTUDIO_FILES_DIR || path.join(ROOT, ".local", "files"),
    trashDir: path.join(ROOT, ".local", "trash"),
  };
}

/** 터미널 칸 수 (한글은 두 칸) */
function width(s: string): number {
  let w = 0;
  for (const ch of s) w += /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1;
  return w;
}
const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - width(s)));

function verdict(a: AdminAssetRow): string {
  if (a.errors.length) return `✗ 문제 ${a.errors.length}개 (check.sh 실패)`;
  if (a.missing.length) return `△ 채울 것 ${a.missing.length}개`;
  return a.draft ? "✓ 공개할 수 있음" : "✓";
}

function printRows(rows: AdminAssetRow[]): void {
  const table = rows.map((a) => [
    a.draft ? "초안" : "공개",
    a.type ? TYPE_LABELS[a.type] : "?",
    a.status ? STATUS_LABELS[a.status] : "?",
    a.slug,
    verdict(a),
  ]);
  const head = ["", "유형", "상태", "slug", "검사"];
  const widths = head.map((h, i) => Math.max(width(h), ...table.map((r) => width(r[i]!))));
  console.log(head.map((h, i) => pad(h, widths[i]!)).join("  ").trimEnd());
  for (const r of table) console.log(r.map((c, i) => pad(c, widths[i]!)).join("  ").trimEnd());
  const published = rows.filter((a) => !a.draft).length;
  console.log(`\n전체 ${rows.length} · 공개 ${published} · 초안 ${rows.length - published}`);
}

function printDetail(a: AdminAssetRow): void {
  console.log(`\n■ ${a.title} (${a.slug}) — ${a.draft ? "초안" : "공개"}`);
  for (const e of a.errors) console.log(`  ✗ ${e.path ? `${e.path}: ` : ""}${e.message}`);
  for (const m of a.missing) console.log(`  △ 공개 전 채울 것: ${m}`);
  for (const w of a.warnings) console.log(`  · ${w}`);
  for (const r of a.references) console.log(`  ↳ 참조: ${r}`);
  if (!a.errors.length && !a.missing.length && !a.warnings.length) console.log("  ✓ 문제 없음");
}

async function main(argv: string[]): Promise<number> {
  const { positionals, values } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      type: { type: "string" },
      title: { type: "string" },
      summary: { type: "string" },
      date: { type: "string" },
      port: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const [command, ...args] = positionals;
  const store = createAdminStore(defaultPaths());

  switch (command) {
    case "list":
      printRows(await store.list());
      return 0;

    case "check": {
      const rows = args.length ? await Promise.all(args.map((s) => store.get(s))) : await store.list();
      rows.forEach(printDetail);
      // check.sh 를 깨는 문제, 또는 공개 중인데 덜 채운 작품이 있으면 실패
      const bad = rows.filter((a) => a.errors.length || (!a.draft && a.missing.length));
      return bad.length ? 1 : 0;
    }

    case "new": {
      const [slug] = args;
      if (!slug || !values.type || !values.title) {
        console.error("사용법: admin new <slug> --type <유형> --title <이름> [--summary <한 줄>] [--date YYYY-MM]");
        console.error(`유형: ${ASSET_TYPES.join(" ")}`);
        return 2;
      }
      const a = await store.create({ slug, type: values.type as AssetType, title: values.title, summary: values.summary, date: values.date });
      console.log(`✓ 초안을 만들었습니다: content/assets/${a.slug}.md`);
      printDetail(a);
      return 0;
    }

    case "publish":
    case "unpublish": {
      const [slug] = args;
      if (!slug) {
        console.error(`사용법: admin ${command} <slug>`);
        return 2;
      }
      const a = command === "publish" ? await store.publish(slug) : await store.unpublish(slug);
      console.log(command === "publish" ? `✓ 공개했습니다: ${slug} (배포는 ./deploy/deploy.sh)` : `✓ 초안으로 돌렸습니다: ${slug}`);
      printDetail(a);
      return 0;
    }

    case "serve": {
      const tokenFile = process.env.JOHNNYSTUDIO_ADMIN_TOKEN_FILE;
      const token = tokenFile ? fs.readFileSync(tokenFile, "utf8").trim() : (process.env.JOHNNYSTUDIO_ADMIN_TOKEN ?? "");
      if (!token) {
        console.error("✗ 관리 토큰이 없습니다 (JOHNNYSTUDIO_ADMIN_TOKEN_FILE). ./scripts/dev.sh 로 띄우세요.");
        return 2;
      }
      const port = Number(values.port ?? process.env.JOHNNYSTUDIO_ADMIN_PORT ?? 3002);
      const server = createAdminServer({ store, token });
      await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, "127.0.0.1", resolve);
      });
      const files = store.filesAreProduction ? `${store.paths.filesDir} (운영 위치)` : store.paths.filesDir;
      console.log(`▶ 작품 관리 서버 → http://127.0.0.1:${port}/__admin/  (다운로드 파일 보관: ${files})`);
      await new Promise<void>((resolve) => {
        const stop = () => server.close(() => resolve());
        process.once("SIGINT", stop);
        process.once("SIGTERM", stop);
      });
      return 0;
    }

    default:
      console.log(fs.readFileSync(import.meta.filename, "utf8").split("*/")[0]!.replace(/^\/\*\*\n?/, "").replace(/^ \* ?/gm, ""));
      return command && !values.help ? 2 : 0;
  }
}

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (e: unknown) => {
    if (e instanceof AdminError) {
      console.error(`✗ ${e.message}`);
      for (const i of e.body.issues ?? []) console.error(`  - ${i.path ? `${i.path}: ` : ""}${i.message}`);
      for (const m of e.body.missing ?? []) console.error(`  - ${m}`);
      for (const r of e.body.references ?? []) console.error(`  - ${r}`);
      process.exit(1);
    }
    console.error(e);
    process.exit(1);
  },
);
