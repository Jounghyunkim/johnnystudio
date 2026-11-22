/**
 * 작품 관리 서버: 관리 화면(/admin/)이 부르는 로컬 HTTP API. ./scripts/dev.sh 가 127.0.0.1 에서 띄운다 (ADR-0009).
 *
 *   브라우저 → Next 개발 서버(/__admin/*, rewrites) → 이 서버 → content/ · public/media · 다운로드 보관 폴더
 *
 * - 127.0.0.1 에서만 듣는다. 개발 서버를 HOST=0.0.0.0 으로 열면 같은 네트워크에서 화면에 닿으므로 토큰을 요구한다.
 * - 토큰은 Authorization 헤더로만 받는다. 다른 사이트는 이 헤더를 붙여 보낼 수 없다 (CORS 를 열지 않는다) → CSRF 방어.
 * - 출시 빌드·운영 서버와는 상관없다. 운영에는 이 서버가 없다.
 * - dev.sh 를 PUBLIC_URL 로 띄우면 인터넷에서도 닿는다 (ADR-0010). 토큰이 틀린 요청은 터미널에 알린다 (1분에 한 줄까지).
 */
import crypto from "node:crypto";
import http from "node:http";

import { AdminError, type AdminStore } from "./store";
import type { CreateAssetInput, SaveAssetInput } from "./types";

const JSON_LIMIT = 2 * 1024 * 1024;

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
