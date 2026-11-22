/**
 * 작품 관리 서버: 토큰, 형식 검사, 라우팅을 실제 HTTP 로 확인한다.
 */
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import os from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createAdminServer } from "./server";
import { createAdminStore } from "./store";

const TOKEN = "test-token-0123456789abcdef";
let root: string;
let server: Server;
let base: string;
const logs: string[] = [];

beforeAll(async () => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "js-admin-http-"));
  fs.mkdirSync(path.join(root, "content", "assets"), { recursive: true });
  const store = createAdminStore({
    contentDir: path.join(root, "content"),
    publicDir: path.join(root, "public"),
    filesDir: path.join(root, "files"),
    trashDir: path.join(root, "trash"),
  });
  server = createAdminServer({ store, token: TOKEN, log: (m) => logs.push(m) });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/__admin`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  fs.rmSync(root, { recursive: true, force: true });
});

const auth = { Authorization: `Bearer ${TOKEN}` };
const json = { ...auth, "Content-Type": "application/json" };

describe("관리 서버", () => {
  it("토큰이 없거나 틀리면 401", async () => {
    expect((await fetch(`${base}/state`)).status).toBe(401);
    const wrong = await fetch(`${base}/state`, { headers: { Authorization: "Bearer nope" } });
    expect(wrong.status).toBe(401);
    expect(await wrong.json()).toMatchObject({ code: "unauthorized" });
  });

  it("토큰이 틀린 요청은 터미널에 알리되, 1분에 한 줄까지만", async () => {
    const before = logs.length;
    for (let i = 0; i < 3; i++) await fetch(`${base}/state`, { headers: { Authorization: "Bearer nope", "X-Forwarded-For": "203.0.113.7" } });
    expect(logs.length - before).toBeLessThanOrEqual(1);
    expect(logs.join("\n")).toMatch(/토큰이 맞지 않는 요청/);
  });

  it("/files/ 는 토큰 없이 내려받는다 (GET·HEAD·이어받기)", async () => {
    const files = `${base.replace(/\/__admin$/, "")}/files`;
    fs.mkdirSync(path.join(root, "files", "app"), { recursive: true });
    fs.writeFileSync(path.join(root, "files", "app", "My-App_1.0_x64-setup.exe"), "0123456789");
    fs.writeFileSync(path.join(root, "files", "app", "photo.webp"), "RIFF");

    const full = await fetch(`${files}/app/My-App_1.0_x64-setup.exe`);
    expect(full.status).toBe(200);
    expect(full.headers.get("content-type")).toBe("application/octet-stream");
    expect(full.headers.get("content-length")).toBe("10");
    expect(full.headers.get("accept-ranges")).toBe("bytes");
    expect(await full.text()).toBe("0123456789");

    const head = await fetch(`${files}/app/My-App_1.0_x64-setup.exe`, { method: "HEAD" });
    expect(head.status).toBe(200);
    expect(head.headers.get("content-length")).toBe("10");

    const part = await fetch(`${files}/app/My-App_1.0_x64-setup.exe`, { headers: { Range: "bytes=3-5" } });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 3-5/10");
    expect(await part.text()).toBe("345");
    const tail = await fetch(`${files}/app/My-App_1.0_x64-setup.exe`, { headers: { Range: "bytes=-2" } });
    expect(await tail.text()).toBe("89");
    expect((await fetch(`${files}/app/My-App_1.0_x64-setup.exe`, { headers: { Range: "bytes=50-" } })).status).toBe(416);

    expect((await fetch(`${files}/app/photo.webp`)).headers.get("content-type")).toBe("image/webp");
  });

  it("/files/ 는 읽기만 하고, 보관 폴더 밖·숨김 파일·폴더는 404", async () => {
    const files = `${base.replace(/\/__admin$/, "")}/files`;
    fs.mkdirSync(path.join(root, "files", "app"), { recursive: true });
    fs.writeFileSync(path.join(root, "files", "app", ".big.exe.abc.upload"), "partial");
    fs.writeFileSync(path.join(root, "secret.txt"), "secret");
    fs.symlinkSync(path.join(root, "secret.txt"), path.join(root, "files", "app", "link.txt"));

    expect((await fetch(`${files}/app/x.exe`, { method: "POST", body: "x" })).status).toBe(405);
    expect((await fetch(`${files}/app/.big.exe.abc.upload`)).status).toBe(404);
    expect((await fetch(`${files}/app/link.txt`)).status).toBe(404);
    expect((await fetch(`${files}/app/`)).status).toBe(404);
    expect((await fetch(`${files}/app`)).status).toBe(404);
    expect((await fetch(`${files}/%2e%2e/secret.txt`)).status).toBe(404);
    expect((await fetch(`${files}/app/..%2f..%2fsecret.txt`)).status).toBe(404);
    expect((await fetch(`${files}/no/such.exe`)).status).toBe(404);
  });

  it("너무 짧은 토큰으로는 시작하지 않는다", () => {
    expect(() => createAdminServer({ store: createAdminStore({ contentDir: root, publicDir: root, filesDir: root, trashDir: root }), token: "short" })).toThrow();
  });

  it("목록 → 만들기 → 읽기 → 저장", async () => {
    const state = await fetch(`${base}/state`, { headers: auth });
    expect(state.status).toBe(200);
    expect(state.headers.get("cache-control")).toBe("no-store");
    expect(await state.json()).toMatchObject({ assets: [], tags: [] });

    const created = await fetch(`${base}/assets`, { method: "POST", headers: json, body: JSON.stringify({ slug: "clip", type: "video", title: "영상" }) });
    expect(created.status).toBe(201);
    const detail = (await created.json()) as { mtime: number; data: Record<string, unknown>; body: string };

    const saved = await fetch(`${base}/assets/clip`, {
      method: "PUT",
      headers: json,
      body: JSON.stringify({ data: { ...detail.data, youtubeId: "dQw4w9WgXcQ" }, body: detail.body, baseMtime: detail.mtime }),
    });
    expect(saved.status).toBe(200);
    expect(await saved.json()).toMatchObject({ data: { youtubeId: "dQw4w9WgXcQ" } });

    const got = await fetch(`${base}/assets/clip`, { headers: auth });
    expect(await got.json()).toMatchObject({ slug: "clip", type: "video" });
  });

  it("JSON 이 아니면 415, 형식 오류는 422, 없는 작품은 404, 없는 주소는 404", async () => {
    expect((await fetch(`${base}/assets`, { method: "POST", headers: { ...auth, "Content-Type": "text/plain" }, body: "{}" })).status).toBe(415);
    const invalid = await fetch(`${base}/assets`, { method: "POST", headers: json, body: JSON.stringify({ slug: "x", type: "video", title: "x", date: "어제" }) });
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toMatchObject({ code: "invalid", issues: [{ path: "date" }] });
    expect((await fetch(`${base}/assets/nope`, { headers: auth })).status).toBe(404);
    expect((await fetch(`${base}/assets/clip/nope`, { method: "POST", headers: auth })).status).toBe(404);
    expect((await fetch(`${base.replace("/__admin", "")}/other`, { headers: auth })).status).toBe(404);
  });

  it("다운로드 파일을 조각으로 받는다 (Next 개발 프록시의 10MB 한도를 피한다)", async () => {
    const id = "b".repeat(32);
    const post = (offset: number, last: boolean, part: Buffer) =>
      fetch(`${base}/assets/clip/files?name=clip.zip&upload=${id}&offset=${offset}&last=${last ? 1 : 0}`, {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/octet-stream" },
        body: new Uint8Array(part),
      });
    const a = await post(0, false, Buffer.from("hello "));
    expect([a.status, await a.json()]).toEqual([200, { received: 6, file: null }]);
    const b = await post(6, true, Buffer.from("world"));
    expect(b.status).toBe(201);
    expect(await b.json()).toMatchObject({ received: 11, file: { file: "/files/clip/clip.zip", size: 11 } });
  });

  it("이미지를 본문으로 받아 저장한다", async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
    const r = await fetch(`${base}/assets/clip/media?name=Thumb.png`, { method: "POST", headers: { ...auth, "Content-Type": "image/png" }, body: png });
    expect(r.status).toBe(201);
    expect(await r.json()).toMatchObject({ path: "/media/clip/thumb.png", size: png.length });
    expect((await fetch(`${base}/assets/clip/media`, { method: "POST", headers: auth, body: png })).status).toBe(400);
  });
});
