/**
 * 회원 클라이언트: 메일 링크(가입·재설정)와 이메일 + 비밀번호 로그인. API 는 같은 출처의 /api/ 다 (ADR-0007, ADR-0008).
 *
 * - 세션 쿠키는 httpOnly 라서 스크립트가 읽을 수 없다. 로그인 상태는 GET /api/auth/me 로 묻는다.
 * - 정적 페이지라서 빌드된 HTML 에는 로그인 상태가 없다. 브라우저에서 처음 구독할 때 한 번 물어본다.
 * - 클라이언트 컴포넌트에서만 쓴다 (fetch·window).
 */
import { useSyncExternalStore } from "react";

export type AuthUser = { id: string; email: string; has_password: boolean; created_at: string; last_login_at: string };

export type SessionState =
  | { status: "loading" }
  | { status: "signed-out" }
  | { status: "signed-in"; user: AuthUser }
  | { status: "unavailable" }; // API 에 닿지 않는다 (서버 중지, 네트워크)

export type ApiError = { ok: false; status: number; code: string; message: string };
export type ApiResult<T> = { ok: true; data: T } | ApiError;

/** 메일 링크를 보내는 이유: 메일 문구와, 링크를 연 뒤 비밀번호 설정 화면을 보여 줄지를 정한다 */
export type LinkPurpose = "signup" | "login" | "reset";

export type VerifyResult = { user: AuthUser; created: boolean; purpose: LinkPurpose; next: string | null };

/** 비밀번호 규칙의 최소 길이. 서버(api/app/passwords.py)가 최종 판단한다 */
export const PASSWORD_MIN_LENGTH = 10;

/** 링크로 들어온 뒤 비밀번호를 정하는 화면을 보여 줄까: 새로 가입했거나, 비밀번호가 없거나, 재설정하러 왔을 때 */
export function needsPasswordStep(r: Pick<VerifyResult, "created" | "purpose" | "user">): boolean {
  return r.created || !r.user.has_password || r.purpose === "reset";
}

// ── 오류 문구 ──

const FALLBACK: Record<string, string> = {
  network: "서버에 연결할 수 없습니다. 인터넷 연결을 확인하고 다시 시도해 주세요.",
  unavailable: "회원 서버가 잠시 응답하지 않습니다. 잠시 뒤 다시 시도해 주세요.",
  too_many_requests: "요청이 너무 많습니다. 잠시 뒤 다시 시도해 주세요.",
  unknown: "알 수 없는 오류가 났습니다. 잠시 뒤 다시 시도해 주세요.",
};

/** API 응답(또는 응답 없음)을 화면에 보여 줄 오류로 바꾼다. API 가 보낸 문구가 있으면 그것을 쓴다 */
export function toApiError(status: number, body: unknown): ApiError {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (detail && typeof detail === "object" && "code" in detail && "message" in detail) {
    const { code, message } = detail as { code: unknown; message: unknown };
    if (typeof code === "string" && typeof message === "string") return { ok: false, status, code, message };
  }
  if (status === 0) return { ok: false, status, code: "network", message: FALLBACK.network! };
  if (status === 429) return { ok: false, status, code: "too_many_requests", message: FALLBACK.too_many_requests! };
  // nginx 가 API 대신 답한 502·503·504 (본문이 JSON 이 아니다)
  if (status >= 500) return { ok: false, status, code: "unavailable", message: FALLBACK.unavailable! };
  return { ok: false, status, code: "unknown", message: FALLBACK.unknown! };
}

async function call<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown): Promise<ApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      cache: "no-store",
      headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    return toApiError(0, null);
  }
  if (res.status === 204) return { ok: true, data: undefined as T };
  const json: unknown = await res.json().catch(() => null);
  if (res.ok && json !== null) return { ok: true, data: json as T };
  return toApiError(res.ok ? 500 : res.status, json);
}

// ── 주소 도우미 ──

/** 메일 링크의 #t=… 에서 토큰을 꺼낸다. 토큰은 주소의 # 뒤에 있어서 서버 로그·Referer 에 남지 않는다 */
export function parseLinkToken(hash: string): string | null {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const token = params.get("t");
  return token && /^[A-Za-z0-9_-]{20,200}$/.test(token) ? token : null;
}

/** 로그인 뒤 돌아갈 주소. 이 사이트 안의 경로만 받는다 (API 의 safe_next 와 같은 규칙) */
export function safeNext(path: string | null | undefined): string | null {
  if (!path || path.length > 200) return null;
  if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\")) return null;
  if (/[\s\u0000-\u001f]/.test(path)) return null;
  if (path.startsWith("/api/") || path.startsWith("/login/") || path.startsWith("/signup/")) return null;
  return path;
}

/** 로그인 페이지 주소. 돌아올 곳이 있으면 ?next= 로 붙인다 */
export function loginHref(next?: string | null): string {
  const safe = safeNext(next);
  return safe ? `/login/?next=${encodeURIComponent(safe)}` : "/login/";
}

// ── 세션 상태 (모든 컴포넌트가 하나를 함께 본다) ──

const LOADING: SessionState = { status: "loading" };
const SIGNED_OUT: SessionState = { status: "signed-out" };
const UNAVAILABLE: SessionState = { status: "unavailable" };

let state: SessionState = LOADING;
let started = false;
const listeners = new Set<() => void>();

function emit(next: SessionState): void {
  state = next;
  for (const l of listeners) l();
}

export async function refreshSession(): Promise<void> {
  const r = await call<{ user: AuthUser | null }>("GET", "/api/auth/me");
  if (!r.ok) emit(UNAVAILABLE);
  else emit(r.data.user ? { status: "signed-in", user: r.data.user } : SIGNED_OUT);
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (!started) {
    started = true;
    void refreshSession();
  }
  return () => listeners.delete(onChange);
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => LOADING,
  );
}

// ── 동작 ──

export function requestLink(
  email: string,
  next: string | null,
  purpose: LinkPurpose = "login",
): Promise<ApiResult<{ ok: true; expires_in_minutes: number }>> {
  return call("POST", "/api/auth/request", { email, next: safeNext(next), purpose });
}

export async function loginWithPassword(email: string, password: string): Promise<ApiResult<{ user: AuthUser }>> {
  const r = await call<{ user: AuthUser }>("POST", "/api/auth/login", { email, password });
  if (r.ok) emit({ status: "signed-in", user: r.data.user });
  return r;
}

/** 비밀번호 정하기·바꾸기. 비밀번호가 이미 있으면 보통 현재 비밀번호가 필요하다 (메일 링크로 방금 들어온 경우는 빼고) */
export async function setPassword(password: string, currentPassword?: string): Promise<ApiResult<undefined>> {
  const r = await call<undefined>("POST", "/api/account/password", { password, current_password: currentPassword || null });
  if (r.ok && state.status === "signed-in") emit({ status: "signed-in", user: { ...state.user, has_password: true } });
  return r;
}

export async function verifyLink(token: string): Promise<ApiResult<VerifyResult>> {
  const r = await call<VerifyResult>("POST", "/api/auth/verify", { token });
  if (r.ok) emit({ status: "signed-in", user: r.data.user });
  return r;
}

async function endSession(r: ApiResult<undefined>): Promise<ApiResult<undefined>> {
  if (r.ok) emit(SIGNED_OUT);
  return r;
}

export async function logout(): Promise<ApiResult<undefined>> {
  return endSession(await call("POST", "/api/auth/logout"));
}

export async function logoutEverywhere(): Promise<ApiResult<undefined>> {
  return endSession(await call("POST", "/api/auth/logout-all"));
}

export async function deleteAccount(): Promise<ApiResult<undefined>> {
  return endSession(await call("DELETE", "/api/account"));
}
