/**
 * 작품 관리 저장소: 임시 폴더에 content/·public/·보관 폴더를 만들어 실제 파일로 확인한다.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { AdminError, type AdminStore, createAdminStore, safeFileName } from "./store";

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
const WEBP = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 "), Buffer.alloc(8)]);

const body = (...chunks: Buffer[]) => Readable.from(chunks);

let root: string;
let store: AdminStore;
const file = (...p: string[]) => path.join(root, ...p);
const read = (...p: string[]) => fs.readFileSync(file(...p), "utf8");

async function rejects(promise: Promise<unknown>, status: number, code?: string): Promise<AdminError> {
  try {
    await promise;
  } catch (e) {
    expect(e).toBeInstanceOf(AdminError);
    const err = e as AdminError;
    expect([err.status, code ?? err.body.code]).toEqual([status, err.body.code]);
    return err;
  }
  throw new Error("실패해야 하는데 성공했다");
}

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "js-admin-"));
  fs.mkdirSync(file("content", "assets"), { recursive: true });
  fs.mkdirSync(file("public"), { recursive: true });
  fs.writeFileSync(file("content", "lifelog.yaml"), "- date: 2026-01-01\n  title: 시작\n  asset: referenced\n");
  fs.writeFileSync(file("content", "profile.yaml"), "services:\n  - title: 웹 개발\n    related: [referenced]\n");
  store = createAdminStore({
    contentDir: file("content"),
    publicDir: file("public"),
    filesDir: file("files"),
    trashDir: file("trash"),
    productionFilesDir: "/opt/johnnystudio/files",
  });
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

async function fillAndSave(slug: string) {
  const d = await store.get(slug);
  return store.save(slug, {
    data: { ...d.data, summary: "실제 한 줄 소개", date: "2026-11", url: "https://example.com" },
    body: "## 무엇을 하나\n\n실제 소개.",
    baseMtime: d.mtime,
  });
}

describe("작품 만들기", () => {
  it("초안 파일을 만들고 목록에 보인다", async () => {
    const a = await store.create({ slug: "my-tool", type: "web-app", title: "내 도구" });
    expect(a).toMatchObject({ slug: "my-tool", title: "내 도구", type: "web-app", draft: true, errors: [] });
    expect(a.missing).toEqual(expect.arrayContaining(["date", "url", "TODO( 표시가 남아 있다", "본문에 TODO( 표시가 남아 있다"]));
    expect(read("content", "assets", "my-tool.md")).toMatch(/^---\ntitle: 내 도구\ntype: web-app\n/);
    expect((await store.state()).assets.map((x) => x.slug)).toEqual(["my-tool"]);
  });

  it("잘못된 slug·중복·유형을 거부한다", async () => {
    await store.create({ slug: "dup", type: "article", title: "a" });
    await rejects(store.create({ slug: "dup", type: "article", title: "b" }), 409, "exists");
    await rejects(store.create({ slug: "../escape", type: "article", title: "a" }), 400, "bad_slug");
    await rejects(store.create({ slug: "Upper", type: "article", title: "a" }), 400, "bad_slug");
    await rejects(store.create({ slug: "ok", type: "nope" as never, title: "a" }), 400, "bad_type");
    await rejects(store.create({ slug: "ok", type: "video", title: " " }), 400, "bad_title");
    expect(fs.readdirSync(file("content", "assets"))).toEqual(["dup.md"]);
  });
});

describe("저장", () => {
  it("스키마를 통과하지 못하면 쓰지 않고 필드별 오류를 준다", async () => {
    const a = await store.create({ slug: "v", type: "video", title: "영상" });
    const before = read("content", "assets", "v.md");
    const err = await rejects(store.save("v", { data: { ...a.data, youtubeId: "short" }, body: a.body, baseMtime: a.mtime }), 422, "invalid");
    expect(err.body.issues?.[0]?.path).toBe("youtubeId");
    expect(read("content", "assets", "v.md")).toBe(before);
  });

  it("그사이 다른 곳에서 파일이 바뀌었으면 거부한다", async () => {
    const a = await store.create({ slug: "c", type: "article", title: "글" });
    await rejects(store.save("c", { data: a.data, body: "x", baseMtime: a.mtime - 1000 }), 409, "conflict");
  });

  it("손으로 쓴 주석을 지킨다", async () => {
    fs.writeFileSync(file("content", "assets", "hand.md"), "---\n# 메모\ntitle: 손\ntype: article\nsummary: s\nstatus: dev\ndraft: true\n---\n\n본문\n");
    const a = await store.get("hand");
    await store.save("hand", { data: { ...a.data, title: "손으로 쓴 글" }, body: a.body, baseMtime: a.mtime });
    expect(read("content", "assets", "hand.md")).toBe("---\n# 메모\ntitle: 손으로 쓴 글\ntype: article\nsummary: s\nstatus: dev\ndraft: true\n---\n\n본문\n");
  });

  it("형식이 깨진 파일도 목록에 오류로 보인다 (목록 전체가 멈추지 않는다)", async () => {
    fs.writeFileSync(file("content", "assets", "broken.md"), "---\ntitle: [\n---\n");
    fs.writeFileSync(file("content", "assets", "Bad_Name.md"), "---\ntitle: x\n---\n");
    const rows = await store.list();
    expect(rows.find((r) => r.slug === "broken")?.errors[0]?.message).toMatch(/YAML/);
    expect(rows.find((r) => r.slug === "Bad_Name")?.errors[0]?.message).toMatch(/파일명/);
  });
});

describe("공개·초안·삭제", () => {
  it("채울 것이 남으면 공개를 거부하고, 채우면 draft 를 지운다", async () => {
    await store.create({ slug: "app", type: "web-app", title: "앱" });
    const err = await rejects(store.publish("app"), 409, "incomplete");
    expect(err.body.missing).toContain("url");

    await fillAndSave("app");
    const published = await store.publish("app");
    expect(published).toMatchObject({ draft: false, missing: [], errors: [] });
    expect(read("content", "assets", "app.md")).not.toMatch(/^draft:/m);

    const back = await store.unpublish("app");
    expect(back.draft).toBe(true);
    expect(read("content", "assets", "app.md")).toMatch(/^draft: true$/m);
  });

  it("샘플은 공개할 수 없다", async () => {
    await store.create({ slug: "sample-x", type: "web-app", title: "샘플" });
    await fillAndSave("sample-x");
    const err = await rejects(store.publish("sample-x"), 409, "incomplete");
    expect(err.body.missing?.join()).toMatch(/sample-/);
  });

  it("공개 중이거나 참조되는 작품은 지우지 않는다", async () => {
    await store.create({ slug: "app", type: "web-app", title: "앱" });
    await fillAndSave("app");
    await store.publish("app");
    await rejects(store.remove("app"), 409, "published");

    await store.create({ slug: "referenced", type: "article", title: "참조됨" });
    const err = await rejects(store.remove("referenced"), 409, "referenced");
    expect(err.body.references).toEqual(["Life Log: 2026-01-01 시작", "서비스: 웹 개발"]);
  });

  it("초안을 지우면 본문과 이미지 폴더를 휴지통으로 옮긴다", async () => {
    await store.create({ slug: "gone", type: "gallery", title: "사진" });
    await store.saveMedia("gone", "a.png", body(PNG));
    const { trashedTo } = await store.remove("gone");
    expect(fs.existsSync(file("content", "assets", "gone.md"))).toBe(false);
    expect(fs.existsSync(file("public", "media", "gone"))).toBe(false);
    expect(fs.readFileSync(trashedTo, "utf8")).toMatch(/title: 사진/);
    expect(fs.readdirSync(file("trash")).some((n) => n.endsWith("-gone-media"))).toBe(true);
  });
});

describe("이미지", () => {
  beforeEach(async () => {
    await store.create({ slug: "pic", type: "gallery", title: "사진" });
  });

  it("이미지를 public/media/<slug>/ 에 저장하고 기준을 넘으면 알려 준다", async () => {
    const r = await store.saveMedia("pic", "My Photo 1.PNG", body(PNG));
    expect(r.path).toBe("/media/pic/my-photo-1.png");
    expect(r.warnings.join()).toMatch(/webp/);
    expect(fs.readFileSync(file("public", "media", "pic", "my-photo-1.png"))).toEqual(PNG);
    const w = await store.saveMedia("pic", "cover.webp", body(WEBP));
    expect(w.warnings).toEqual([]);
  });

  it("확장자와 내용이 다르거나 SVG 면 거부한다", async () => {
    await rejects(store.saveMedia("pic", "fake.png", body(Buffer.from("<svg></svg>"))), 400, "bad_content");
    await rejects(store.saveMedia("pic", "x.svg", body(Buffer.from("<svg></svg>"))), 400, "bad_type");
    expect(fs.readdirSync(file("public", "media", "pic"))).toEqual([]);
  });

  it("같은 이름은 덮어쓰기를 허락할 때만 바꾼다", async () => {
    await store.saveMedia("pic", "a.png", body(PNG));
    await rejects(store.saveMedia("pic", "a.png", body(PNG)), 409, "exists");
    await expect(store.saveMedia("pic", "a.png", body(PNG), { overwrite: true })).resolves.toMatchObject({ path: "/media/pic/a.png" });
  });

  it("없는 작품에는 올리지 않는다", async () => {
    await rejects(store.saveMedia("nope", "a.png", body(PNG)), 404, "not_found");
  });

  it("저장한 이미지를 쓰면 검사가 통과하고, 없는 경로는 문제로 보인다", async () => {
    const r = await store.saveMedia("pic", "a.png", body(PNG));
    const d = await store.get("pic");
    const saved = await store.save("pic", {
      data: { ...d.data, photos: [{ src: r.path, alt: "사진" }, { src: "/media/pic/missing.webp", alt: "없음" }] },
      body: d.body,
      baseMtime: d.mtime,
    });
    expect(saved.errors).toEqual([{ path: "photos", message: "이미지 파일이 없다: /media/pic/missing.webp" }]);
  });
});

describe("다운로드 파일", () => {
  it("보관 폴더에 저장하고 크기·SHA-256·서버 복사 명령을 준다", async () => {
    await store.create({ slug: "tool", type: "desktop-app", title: "도구" });
    const content = Buffer.from("installer-bytes");
    const r = await store.saveFile("tool", "Tool Setup 1.0.exe", body(content.subarray(0, 5), content.subarray(5)));
    expect(r).toMatchObject({
      file: "/files/tool/Tool-Setup-1.0.exe",
      size: content.length,
      sha256: crypto.createHash("sha256").update(content).digest("hex"),
      savedTo: file("files", "tool", "Tool-Setup-1.0.exe"),
    });
    expect(r.installCommand).toBe(`install -D -m 644 '${file("files", "tool", "Tool-Setup-1.0.exe")}' '/opt/johnnystudio/files/tool/Tool-Setup-1.0.exe'`);
    await rejects(store.saveFile("tool", "Tool Setup 1.0.exe", body(content)), 409, "exists");
    await rejects(store.saveFile("tool", "empty.zip", body()), 400, "empty");
  });

  it("조각으로 나눠 받아 이어 붙이고, 순서가 어긋나면 처음부터 다시 받게 한다", async () => {
    await store.create({ slug: "big", type: "desktop-app", title: "큰 파일" });
    const whole = crypto.randomBytes(3000);
    const id = "a".repeat(32);
    const first = await store.receiveFile("big", "big.zip", body(whole.subarray(0, 1000)), { uploadId: id, offset: 0, last: false });
    expect(first).toEqual({ received: 1000, file: null });
    expect(fs.readdirSync(file("files", "big"))).toEqual([`.big.zip.${id}.upload`]); // 받는 중에는 숨김 파일

    await rejects(store.receiveFile("big", "big.zip", body(whole.subarray(2000)), { uploadId: id, offset: 2000, last: true }), 409, "bad_offset");
    expect(fs.readdirSync(file("files", "big"))).toEqual([]); // 어긋나면 지운다

    await store.receiveFile("big", "big.zip", body(whole.subarray(0, 1000)), { uploadId: id, offset: 0, last: false });
    await store.receiveFile("big", "big.zip", body(whole.subarray(1000, 2000)), { uploadId: id, offset: 1000, last: false });
    const done = await store.receiveFile("big", "big.zip", body(whole.subarray(2000)), { uploadId: id, offset: 2000, last: true });
    expect(done.file).toMatchObject({ file: "/files/big/big.zip", size: 3000, sha256: crypto.createHash("sha256").update(whole).digest("hex") });
    expect(fs.readFileSync(file("files", "big", "big.zip"))).toEqual(whole);
    expect(fs.readdirSync(file("files", "big"))).toEqual(["big.zip"]);

    await rejects(store.receiveFile("big", "x.zip", body(whole), { uploadId: "../x", offset: 0, last: true }), 400, "bad_request");
  });

  it("보관 폴더가 운영 위치면 복사 명령이 없다", async () => {
    const prod = createAdminStore({ contentDir: file("content"), publicDir: file("public"), filesDir: file("files"), trashDir: file("trash"), productionFilesDir: file("files") });
    await prod.create({ slug: "tool", type: "desktop-app", title: "도구" });
    expect((await prod.saveFile("tool", "a.zip", body(Buffer.from("z")))).installCommand).toBeNull();
  });
});

describe("파일 이름 다듬기", () => {
  it.each([
    ["Cover Image.WEBP", {}, "cover-image.webp"],
    ["../../etc/passwd", {}, "passwd"],
    [".hidden.png", {}, "hidden.png"],
    ["사진.png", {}, /^file-[a-z0-9]+\.png$/],
    ["HwMonitor-1.2.0 Setup.exe", { lowerCase: false }, "HwMonitor-1.2.0-Setup.exe"],
    ["C:\\Users\\me\\a b.zip", { lowerCase: false }, "a-b.zip"],
  ] as const)("%s", (input, opts, expected) => {
    const out = safeFileName(input, opts);
    if (typeof expected === "string") expect(out).toBe(expected);
    else expect(out).toMatch(expected);
  });
});
