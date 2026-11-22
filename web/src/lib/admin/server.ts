/**
 * 작품 관리 서버: 관리 화면(/admin/)이 부르는 로컬 HTTP API. ./scripts/dev.sh 가 127.0.0.1 에서 띄운다 (ADR-0009).
 *
 *   브라우저 → Next 개발 서버(/__admin/*, rewrites) → 이 서버 → content/ · public/media · 다운로드 보관 폴더
 *
 * - 127.0.0.1 에서만 듣는다. 개발 서버를 HOST=0.0.0.0 으로 열면 같은 네트워크에서 화면에 닿으므로 토큰을 요구한다.
 * - 토큰은 Authorization 헤더로만 받는다. 다른 사이트는 이 헤더를 붙여 보낼 수 없다 (CORS 를 열지 않는다) → CSRF 방어.
 * - 출시 빌드·운영 서버와는 상관없다. 운영에는 이 서버가 없다.
 * - dev.sh 를 PUBLIC_URL 로 띄우면 인터넷에서도 닿는다 (ADR-0010). 토큰이 틀린 요청은 터미널에 알린다 (1분에 한 줄까지).
 * - /files/<slug>/<파일> 은 토큰 없이 읽기만 한다: 개발 미리보기의 다운로드 버튼용. 운영에서 nginx 의 /files/ 가 하는 일과 같다
 *   (같은 다운로드 보관 폴더, GET·HEAD, 이어받기 Range). 숨김 파일(받는 중인 조각)과 폴더 밖 경로는 404 다.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

import { AdminError, type AdminStore } from "./store";
import type { CreateAssetInput, SaveAssetInput } from "./types";

const JSON_LIMIT = 2 * 1024 * 1024;

/** /files/ 의 Content-Type. 나머지(exe·msi·html·svg 등)는 내려받기만 되도록 octet-stream 으로 준다 */
const FILE_TYPES: Record<string, string> = {
  ".zip": "application/zip",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
};

const notFound = () => new AdminError(404, "not_found", "파일이 없습니다.");

/** /files/ 아래 경로 → 다운로드 보관 폴더 안의 실제 파일. 폴더 밖·숨김 파일·폴더는 404 */
async function resolveDownload(filesDir: string, pathname: string): Promise<{ file: string; size: number }> {
  const segments = pathname.split("/").slice(2); // ["", "files", ...]
  if (segments.length === 0) throw notFound();
  const names = segments.map((s) => {
    let name: string;
    try {
      name = decodeURIComponent(s);
    } catch {
      throw notFound();
    }
    if (!name || name.startsWith(".") || /[/\\\0]/.test(name)) throw notFound();
    return name;
  });
  let root: string;
  let real: string;
  try {
    root = await fs.promises.realpath(filesDir);
    real = await fs.promises.realpath(path.join(root, ...names));
  } catch {
    throw notFound();
  }
  const rel = path.relative(root, real);
  if (!rel || rel.startsWith("..") || path.isAbsolute(rel)) throw notFound(); // 심볼릭 링크로 밖을 가리켜도 막는다
  const stat = await fs.promises.stat(real);
  if (!stat.isFile()) throw notFound();
  return { file: real, size: stat.size };
}

/** Range: bytes=a-b 하나만 받는다 (이어받기). 형식이 다르면 무시하고 전체를 준다, 범위 밖이면 416 */
function parseRange(header: string | undefined, size: number): { start: number; end: number } | null | "invalid" {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
  if (!m || (!m[1] && !m[2])) return null;
  let start: number;
  let end: number;
  if (!m[1]) {
    const suffix = Number(m[2]);
    if (suffix === 0) return "invalid";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (start >= size || start > end) return "invalid";
  return { start, end };
}

async function serveDownload(req: http.IncomingMessage, res: http.ServerResponse, filesDir: string, pathname: string): Promise<void> {
  const method = req.method ?? "GET";
  if (method !== "GET" && method !== "HEAD") {
    res.setHeader("Allow", "GET, HEAD");
    throw new AdminError(405, "method_not_allowed", "읽기만 됩니다.");
  }
  const { file, size } = await resolveDownload(filesDir, pathname);
  const headers: http.OutgoingHttpHeaders = {
    "Content-Type": FILE_TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "no-cache",
    "X-Content-Type-Options": "nosniff",
  };
  const range = parseRange(req.headers.range, size);
  if (range === "invalid") {
    res.writeHead(416, { ...headers, "Content-Range": `bytes */${size}` });
    res.end();
    return;
  }
  const start = range?.start ?? 0;
  const end = range?.end ?? size - 1;
  res.writeHead(range ? 206 : 200, {
    ...headers,
    "Content-Length": size === 0 ? 0 : end - start + 1,
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  });
  if (method === "HEAD" || size === 0) {
    res.end();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const stream = fs.createReadStream(file, { start, end });
    stream.on("error", reject);
    res.on("close", () => {
      stream.destroy(); // 받는 쪽이 끊으면 읽기도 멈춘다
      resolve();
    });
    stream.pipe(res);
  });
}

function digest(value: string): Buffer {
  return crypto.createHash("sha256").update(value).digest();
}

function send(res: http.ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(text),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(text);
}

async function readJson(req: http.IncomingMessage): Promise<unknown> {
  if (!/^application\/json\b/i.test(req.headers["content-type"] ?? "")) {
    throw new AdminError(415, "bad_content_type", "JSON 으로 보내 주세요.");
  }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length;
    if (size > JSON_LIMIT) throw new AdminError(413, "too_large", "요청이 너무 큽니다.");
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new AdminError(400, "bad_json", "JSON 을 읽을 수 없습니다.");
  }
}

function uploadName(url: URL): string {
  const name = url.searchParams.get("name")?.trim();
  if (!name) throw new AdminError(400, "bad_request", "파일 이름(name)이 없습니다.");
  return name;
}

const FAILURE_LOG_INTERVAL_MS = 60_000;

export function createAdminServer({
  store,
  token,
  log = (message: string) => console.log(message),
}: {
  store: AdminStore;
  token: string;
  /** 터미널 알림 (테스트에서 바꾼다) */
  log?: (message: string) => void;
}): http.Server {
  if (token.length < 16) throw new Error("관리 토큰이 너무 짧다 (16자 이상)");
  const expected = digest(token);

  // 토큰이 틀린 요청: 처음 한 번은 바로, 그다음은 1분에 한 줄로 모아서 알린다 (스캐너가 두드려도 터미널이 넘치지 않게)
  let failures = 0;
  let lastLog = 0;
  function noteFailure(req: http.IncomingMessage): void {
    failures += 1;
    const now = Date.now();
    if (now - lastLog < FAILURE_LOG_INTERVAL_MS) return;
    lastLog = now;
    const from = String(req.headers["x-forwarded-for"] ?? "").split(",")[0]?.trim() || "알 수 없음";
    log(`[작품 관리] ⚠ 토큰이 맞지 않는 요청 (지금까지 ${failures}회, 최근: ${req.method} ${req.url?.split("?")[0]} · ${from})`);
  }

  async function route(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    const url = new URL(req.url ?? "/", "http://127.0.0.1");
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "files") return serveDownload(req, res, store.paths.filesDir, url.pathname);
    if (parts[0] !== "__admin") throw new AdminError(404, "not_found", "없는 주소입니다.");

    const auth = req.headers.authorization ?? "";
    const given = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    if (!given || !crypto.timingSafeEqual(digest(given), expected)) {
      noteFailure(req);
      throw new AdminError(401, "unauthorized", "관리 토큰이 없거나 맞지 않습니다. 터미널에 찍힌 관리 화면 주소(#k=…)로 다시 여세요.");
    }

    const method = req.method ?? "GET";
    const [, resource, slug, action, ...rest] = parts;
    if (rest.length) throw new AdminError(404, "not_found", "없는 주소입니다.");

    if (resource === "state" && !slug && method === "GET") return send(res, 200, await store.state());

    if (resource === "assets") {
      if (!slug) {
        if (method === "POST") return send(res, 201, await store.create((await readJson(req)) as CreateAssetInput));
      } else if (!action) {
        if (method === "GET") return send(res, 200, await store.get(slug));
        if (method === "PUT") return send(res, 200, await store.save(slug, (await readJson(req)) as SaveAssetInput));
        if (method === "DELETE") return send(res, 200, await store.remove(slug));
      } else if (method === "POST") {
        if (action === "publish") return send(res, 200, await store.publish(slug));
        if (action === "unpublish") return send(res, 200, await store.unpublish(slug));
        if (action === "media") {
          return send(res, 201, await store.saveMedia(slug, uploadName(url), req, { overwrite: url.searchParams.get("overwrite") === "1" }));
        }
        if (action === "files") {
          // 조각 업로드 (client.ts). upload 가 없으면 한 번에 받는다 (8MB 이하)
          const uploadId = url.searchParams.get("upload") ?? crypto.randomBytes(16).toString("hex");
          const offset = Number(url.searchParams.get("offset") ?? 0);
          const last = !url.searchParams.has("upload") || url.searchParams.get("last") === "1";
          const r = await store.receiveFile(slug, uploadName(url), req, { uploadId, offset, last });
          return send(res, r.file ? 201 : 200, r);
        }
      }
    }
    throw new AdminError(404, "not_found", "없는 주소입니다.");
  }

  return http.createServer((req, res) => {
    route(req, res).catch((e: unknown) => {
      if (req.destroyed && (e as NodeJS.ErrnoException)?.code === "ECONNRESET") {
        console.log("[작품 관리] 업로드가 중간에 끊겼습니다 (받던 파일은 지웠습니다)");
        return;
      }
      if (res.headersSent) {
        res.destroy();
        return;
      }
      if (!req.complete) {
        // 본문을 다 읽기 전에 거절했다 (크기 초과 등). 응답 뒤 연결을 닫고 남은 본문은 버린다
        res.setHeader("Connection", "close");
        req.resume();
      }
      if (e instanceof AdminError) {
        send(res, e.status, e.body);
        return;
      }
      console.error("[작품 관리] 처리하지 못한 오류:", e);
      send(res, 500, { code: "internal", message: "관리 서버에서 오류가 났습니다. 터미널을 확인해 주세요." });
    });
  });
}
