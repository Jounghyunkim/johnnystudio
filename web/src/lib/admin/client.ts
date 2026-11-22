/**
 * 관리 화면(/admin/)의 API 클라이언트와 상태 저장소. 클라이언트 컴포넌트에서만 쓴다 (fetch·window).
 *
 * - 관리 서버는 개발 서버의 /__admin/ 뒤에 있다 (next.config.ts rewrites → 127.0.0.1:3002).
 * - 관리 토큰은 dev.sh 가 찍는 주소의 #k=… 로 들어온다. 탭의 sessionStorage 에 두고 주소에서 지운다.
 * - zod·fs 를 가져오지 않는다 (schema.ts·content.ts 는 쓰지 않는다).
 */
import { useSyncExternalStore } from "react";

import type {
  AdminAssetDetail,
  AdminErrorBody,
  AdminState,
  CreateAssetInput,
  SaveAssetInput,
  UploadChunkResult,
  UploadedFile,
  UploadedMedia,
} from "./types";

export type AdminFailure = { httpStatus: number; error: AdminErrorBody };
export type AdminResult<T> = { ok: true; data: T } | ({ ok: false } & AdminFailure);

const OFFLINE: AdminErrorBody = {
  code: "offline",
  message: "작품 관리 서버에 연결할 수 없습니다. ./scripts/dev.sh 로 개발 서버를 띄웠는지 확인해 주세요 (NO_ADMIN=1 이면 꺼져 있습니다).",
};

// ── 토큰 ──

const TOKEN_KEY = "johnnystudio:admin-token";
const TOKEN_EVENT = "johnnystudio:admin-token";
let memoryToken = ""; // sessionStorage 를 못 쓰는 환경

function readToken(): string {
  try {
    return window.sessionStorage.getItem(TOKEN_KEY) ?? memoryToken;
  } catch {
    return memoryToken;
  }
}

export function setAdminToken(token: string): void {
  memoryToken = token.trim();
  try {
    if (memoryToken) window.sessionStorage.setItem(TOKEN_KEY, memoryToken);
    else window.sessionStorage.removeItem(TOKEN_KEY);
  } catch {
    // 이 탭의 메모리에만 둔다
  }
  window.dispatchEvent(new Event(TOKEN_EVENT));
}

/** 주소의 #k=<토큰> 을 꺼내 보관하고 주소에서 지운다 (북마크·화면 공유에 토큰이 남지 않게) */
export function captureTokenFromHash(): void {
  const k = new URLSearchParams(window.location.hash.replace(/^#/, "")).get("k");
  if (!k) return;
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}`);
  setAdminToken(k);
}

function subscribeToken(onChange: () => void): () => void {
  window.addEventListener(TOKEN_EVENT, onChange);
  return () => window.removeEventListener(TOKEN_EVENT, onChange);
}

export function useAdminToken(): string {
  return useSyncExternalStore(subscribeToken, readToken, () => "");
}

// ── 요청 ──

function failure(httpStatus: number, body: unknown): AdminFailure {
  if (body && typeof body === "object" && "code" in body && "message" in body) return { httpStatus, error: body as AdminErrorBody };
  // 관리 서버가 꺼져 있으면 Next 개발 서버가 JSON 이 아닌 오류를 돌려준다
  return { httpStatus, error: OFFLINE };
}

async function request<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, json?: unknown): Promise<AdminResult<T>> {
  let res: Response;
  try {
    res = await fetch(`/__admin/${path}`, {
      method,
      cache: "no-store",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${readToken()}`,
        ...(json === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: json === undefined ? undefined : JSON.stringify(json),
    });
  } catch {
    return { ok: false, httpStatus: 0, error: OFFLINE };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok && body !== null) return { ok: true, data: body as T };
  return { ok: false, ...failure(res.status, body) };
}

/** 파일 올리기. fetch 는 올리는 진행률을 알려 주지 않아서 XMLHttpRequest 를 쓴다 */
function upload<T>(path: string, file: Blob, onProgress?: (ratio: number) => void): Promise<AdminResult<T>> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `/__admin/${path}`);
    xhr.setRequestHeader("Authorization", `Bearer ${readToken()}`);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.responseType = "text";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(e.loaded / e.total);
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        // JSON 이 아니다
      }
      if (xhr.status >= 200 && xhr.status < 300 && body !== null) resolve({ ok: true, data: body as T });
      else resolve({ ok: false, ...failure(xhr.status, body) });
    };
    xhr.onerror = () => resolve({ ok: false, httpStatus: 0, error: OFFLINE });
    xhr.send(file);
  });
}

const enc = encodeURIComponent;

/**
 * Next 개발 서버는 넘겨주는 요청 본문을 10MB 까지만 전달한다. 그래서 다운로드 파일은 8MB 조각으로 나눠 보내고,
 * 관리 서버가 이어 붙인 뒤 크기·SHA-256 을 계산한다 (store.ts 의 UPLOAD_CHUNK_BYTES 와 같다).
 */
const CHUNK = 8 * 1024 * 1024;

async function uploadInChunks(slug: string, file: File, onProgress?: (ratio: number) => void): Promise<AdminResult<UploadedFile>> {
  const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, "0")).join("");
  let offset = 0;
  for (;;) {
    const part = file.slice(offset, offset + CHUNK);
    const last = offset + part.size >= file.size;
    const r = await upload<UploadChunkResult>(
      `assets/${enc(slug)}/files?name=${enc(file.name)}&upload=${id}&offset=${offset}&last=${last ? 1 : 0}`,
      part,
      (ratio) => onProgress?.(file.size ? (offset + ratio * part.size) / file.size : 1),
    );
    if (!r.ok) return r;
    if (last) return r.data.file ? { ok: true, data: r.data.file } : { ok: false, httpStatus: 500, error: { code: "upload", message: "업로드를 마치지 못했습니다." } };
    offset = r.data.received;
  }
}

export const adminApi = {
  state: () => request<AdminState>("GET", "state"),
  get: (slug: string) => request<AdminAssetDetail>("GET", `assets/${enc(slug)}`),
  create: (input: CreateAssetInput) => request<AdminAssetDetail>("POST", "assets", input),
  save: (slug: string, input: SaveAssetInput) => request<AdminAssetDetail>("PUT", `assets/${enc(slug)}`, input),
  publish: (slug: string) => request<AdminAssetDetail>("POST", `assets/${enc(slug)}/publish`),
  unpublish: (slug: string) => request<AdminAssetDetail>("POST", `assets/${enc(slug)}/unpublish`),
  remove: (slug: string) => request<{ trashedTo: string }>("DELETE", `assets/${enc(slug)}`),
  uploadMedia: (slug: string, file: File, overwrite = false) =>
    upload<UploadedMedia>(`assets/${enc(slug)}/media?name=${enc(file.name)}${overwrite ? "&overwrite=1" : ""}`, file),
  uploadFile: uploadInChunks,
};

// ── 상태 저장소 (useSyncExternalStore) ──

export type Remote<T> = { status: "idle" } | { status: "loading" } | { status: "ready"; data: T } | ({ status: "error" } & AdminFailure);

function createStore<T>() {
  let snapshot: Remote<T> = { status: "idle" };
  const listeners = new Set<() => void>();
  return {
    get: () => snapshot,
    set(next: Remote<T>) {
      snapshot = next;
      listeners.forEach((l) => l());
    },
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
  };
}

const IDLE = { status: "idle" } as const;
const stateStore = createStore<AdminState>();
const detailStore = createStore<AdminAssetDetail>();

export function useAdminState(): Remote<AdminState> {
  return useSyncExternalStore(stateStore.subscribe, stateStore.get, () => IDLE);
}

/** 목록을 다시 불러온다. 이미 보이는 목록은 불러오는 동안에도 그대로 둔다 */
export async function refreshAdminState(): Promise<void> {
  if (stateStore.get().status !== "ready") stateStore.set({ status: "loading" });
  const r = await adminApi.state();
  stateStore.set(r.ok ? { status: "ready", data: r.data } : { status: "error", httpStatus: r.httpStatus, error: r.error });
}

export function useAssetDetail(): Remote<AdminAssetDetail> {
  return useSyncExternalStore(detailStore.subscribe, detailStore.get, () => IDLE);
}

/** 편집기에서 저장·공개한 결과를 반영한다 (다시 불러오지 않는다) */
export function setAssetDetail(detail: AdminAssetDetail): void {
  detailStore.set({ status: "ready", data: detail });
}

export async function loadAssetDetail(slug: string): Promise<void> {
  detailStore.set({ status: "loading" });
  const r = await adminApi.get(slug);
  detailStore.set(r.ok ? { status: "ready", data: r.data } : { status: "error", httpStatus: r.httpStatus, error: r.error });
}
