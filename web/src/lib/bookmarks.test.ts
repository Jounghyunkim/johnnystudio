import { describe, expect, it } from "vitest";

import type { ApiResult } from "./auth";
import { type BookmarkApi, createBookmarkStore, type LocalList, parseBookmarks, splitBookmarks, storeBookmarkId, toggleSlug, viewerOf } from "./bookmarks";

describe("즐겨찾기", () => {
  it("Library slug 와 Store 앱을 한 목록에 넣고, My Studio 에서 두 구역으로 나눈다", () => {
    let ids: string[] = [];
    ids = toggleSlug(ids, "cmg-monitor");
    ids = toggleSlug(ids, storeBookmarkId("Ab12Cd34"));
    ids = toggleSlug(ids, "wlt");
    expect(ids).toEqual(["cmg-monitor", "store:Ab12Cd34", "wlt"]);
    expect(splitBookmarks(ids)).toEqual({ library: ["cmg-monitor", "wlt"], store: ["Ab12Cd34"] });
    expect(toggleSlug(ids, storeBookmarkId("Ab12Cd34"))).toEqual(["cmg-monitor", "wlt"]);
  });

  it("모양이 틀린 Store 값은 버린다 (손으로 고친 저장소 등)", () => {
    expect(splitBookmarks(["store:", "store:../x", "store:abc", "store:ABCD1234"]).store).toEqual(["ABCD1234"]);
  });

  it("예전 목록(slug 만)은 그대로 Library 구역이다", () => {
    expect(splitBookmarks(parseBookmarks('["arkurator","johnny-dir"]'))).toEqual({ library: ["arkurator", "johnny-dir"], store: [] });
    expect(parseBookmarks("깨진 값")).toEqual([]);
  });
});

// ── 저장 위치 (ADR-0017): 비회원은 브라우저, 회원은 계정 ──

type Call = { kind: "list" | "add" | "remove"; arg?: unknown; resolve: (r: ApiResult<{ items: string[] }>) => void };

/** 서버를 흉내 낸다: 요청을 붙잡아 두었다가 respond() 로 하나씩 답한다 */
function fakeServer(initial: string[] = []) {
  let items = [...initial];
  const calls: Call[] = [];
  const hold = (kind: Call["kind"], arg?: unknown) =>
    new Promise<ApiResult<{ items: string[] }>>((resolve) => calls.push({ kind, arg, resolve }));
  const api: BookmarkApi = { list: () => hold("list"), add: (a) => hold("add", a), remove: (i) => hold("remove", i) };
  /** 맨 앞 요청에 답한다. fail 이면 그 상태 코드로 실패 */
  const respond = async (fail?: number) => {
    await flush();
    const c = calls.shift();
    if (!c) throw new Error("기다리는 요청이 없다");
    if (fail) c.resolve({ ok: false, status: fail, code: "x", message: "저장하지 못했습니다." });
    else {
      if (c.kind === "add") for (const i of c.arg as string[]) if (!items.includes(i)) items.push(i);
      if (c.kind === "remove") items = items.filter((i) => i !== c.arg);
      c.resolve({ ok: true, data: { items: [...items] } });
    }
    await flush();
  };
  return { api, calls, respond, items: () => items };
}

/** 차례를 기다리는 요청이 서버에 닿을 때까지 */
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function fakeLocal(ids: string[] = []): LocalList & { ids: () => string[] } {
  let raw = JSON.stringify(ids);
  return { raw: () => raw, write: (v) => (raw = JSON.stringify(v)), clear: () => (raw = "[]"), ids: () => parseBookmarks(raw) };
}

const member = { status: "member", id: "u1" } as const;

describe("즐겨찾기 저장 위치", () => {
  it("비회원: 이 브라우저에만 저장하고 서버에 묻지 않는다", () => {
    const server = fakeServer();
    const local = fakeLocal();
    const s = createBookmarkStore(server.api, local, () => {});
    expect(s.getState()).toMatchObject({ place: "browser", status: "loading" });
    s.setViewer({ status: "guest" });
    s.toggle("wlt");
    expect(local.ids()).toEqual(["wlt"]);
    expect(s.getState()).toMatchObject({ place: "browser", status: "ready", ids: ["wlt"] });
    expect(server.calls).toEqual([]);
  });

  it("로그인하면 브라우저 목록을 계정에 더하고 브라우저에서는 지운다", async () => {
    const server = fakeServer(["arkurator"]);
    const local = fakeLocal(["wlt", "arkurator"]);
    const s = createBookmarkStore(server.api, local, () => {});
    s.setViewer(member);
    // 불러오는 동안에도 브라우저에 있던 별은 켜져 있다
    expect(s.getState()).toMatchObject({ place: "account", status: "loading", ids: ["wlt", "arkurator"] });
    await flush();
    expect(server.calls.map((c) => [c.kind, c.arg])).toEqual([["add", ["wlt", "arkurator"]]]);
    await server.respond();
    expect(s.getState()).toMatchObject({ place: "account", status: "ready", ids: ["arkurator", "wlt"] });
    expect(local.ids()).toEqual([]);
  });

  it("다른 브라우저(빈 목록)에서 로그인하면 계정 목록을 불러온다", async () => {
    const server = fakeServer(["arkurator", "store:Ab12Cd34"]);
    const s = createBookmarkStore(server.api, fakeLocal(), () => {});
    s.setViewer(member);
    await flush();
    expect(server.calls.map((c) => c.kind)).toEqual(["list"]);
    await server.respond();
    expect(s.getState().ids).toEqual(["arkurator", "store:Ab12Cd34"]);
  });

  it("빨리 여러 번 눌러도 차례로 보내고, 마지막 답으로 맞춘다", async () => {
    const server = fakeServer();
    const s = createBookmarkStore(server.api, fakeLocal(), () => {});
    s.setViewer(member);
    s.toggle("a");
    s.toggle("b");
    s.toggle("a");
    expect(s.getState().ids).toEqual(["b"]); // 누르는 즉시 보인다
    await flush();
    expect(server.calls.length).toBe(1); // 하나씩 보낸다
    await server.respond(); // list
    await server.respond(); // add a
    expect(s.getState().ids).toEqual(["b"]); // 중간 답으로 화면이 흔들리지 않는다
    await server.respond(); // add b
    await server.respond(); // remove a
    expect(s.getState()).toMatchObject({ status: "ready", ids: ["b"] });
    expect(server.items()).toEqual(["b"]);
  });

  it("저장에 실패하면 서버가 마지막으로 알려 준 목록으로 되돌리고 다시 불러온다", async () => {
    const server = fakeServer(["wlt"]);
    const s = createBookmarkStore(server.api, fakeLocal(), () => {});
    s.setViewer(member);
    await server.respond();
    s.toggle("arkurator");
    await server.respond(500);
    expect(s.getState()).toMatchObject({ status: "error", ids: ["wlt"], message: "저장하지 못했습니다." });
    await flush();
    expect(server.calls.map((c) => c.kind)).toEqual(["list"]);
    await server.respond();
    expect(s.getState()).toMatchObject({ status: "ready", ids: ["wlt"] });
  });

  it("옮기기에 실패하면 브라우저 목록을 지우지 않는다 (다음에 다시 더한다)", async () => {
    const server = fakeServer();
    const local = fakeLocal(["wlt"]);
    const s = createBookmarkStore(server.api, local, () => {});
    s.setViewer(member);
    await server.respond(503);
    expect(local.ids()).toEqual(["wlt"]);
    expect(s.getState().status).toBe("error");
  });

  it("세션이 끝났으면(401) 로그인 상태를 다시 묻는다", async () => {
    const server = fakeServer();
    let asked = 0;
    const s = createBookmarkStore(server.api, fakeLocal(), () => asked++);
    s.setViewer(member);
    await server.respond(401);
    expect(asked).toBe(1);
  });

  it("로그아웃하면 이 브라우저에는 계정 목록이 남지 않는다", async () => {
    const server = fakeServer(["wlt"]);
    const local = fakeLocal();
    const s = createBookmarkStore(server.api, local, () => {});
    s.setViewer(member);
    await server.respond();
    s.setViewer({ status: "guest" });
    expect(s.getState()).toMatchObject({ place: "browser", ids: [] });
    expect(local.ids()).toEqual([]);
  });

  it("로그인 상태를 확인하지 못하면(서버 중지) 브라우저 목록을 쓴다", () => {
    expect(viewerOf({ status: "unavailable" })).toEqual({ status: "guest" });
    expect(viewerOf({ status: "loading" })).toEqual({ status: "loading" });
  });
});
