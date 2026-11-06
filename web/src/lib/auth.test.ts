import { describe, expect, it } from "vitest";

import { type AuthUser, loginHref, needsPasswordStep, parseLinkToken, safeNext, toApiError } from "./auth";

const TOKEN = "AbC_def-123456789012345678901234567890abcd";

describe("parseLinkToken", () => {
  it("#t= 에서 토큰을 꺼낸다", () => {
    expect(parseLinkToken(`#t=${TOKEN}`)).toBe(TOKEN);
    expect(parseLinkToken(`t=${TOKEN}`)).toBe(TOKEN);
  });

  it("없거나 형식이 틀리면 null", () => {
    expect(parseLinkToken("")).toBeNull();
    expect(parseLinkToken("#t=")).toBeNull();
    expect(parseLinkToken("#t=short")).toBeNull();
    expect(parseLinkToken("#t=<script>alert(1)</script>aaaaaaaaaaaaaaaa")).toBeNull();
  });
});

describe("safeNext", () => {
  it("사이트 안 경로만 받는다", () => {
    expect(safeNext("/studio/")).toBe("/studio/");
    expect(safeNext("/library/?type=video")).toBe("/library/?type=video");
  });

  it("다른 사이트·API·로그인 페이지·이상한 문자는 받지 않는다", () => {
    for (const bad of [null, undefined, "", "https://evil.example/", "//evil.example/", "/\\evil", "/api/auth/me", "/login/", "/a b", "/a\nb"]) {
      expect(safeNext(bad)).toBeNull();
    }
  });
});

describe("loginHref", () => {
  it("돌아올 곳을 ?next= 로 붙인다", () => {
    expect(loginHref("/account/")).toBe("/login/?next=%2Faccount%2F");
    expect(loginHref("//evil.example/")).toBe("/login/");
    expect(loginHref()).toBe("/login/");
  });
});

describe("toApiError", () => {
  it("API 가 보낸 code·message 를 그대로 쓴다", () => {
    const e = toApiError(400, { detail: { code: "invalid_email", message: "이메일 주소 형식을 확인해 주세요." } });
    expect(e).toEqual({ ok: false, status: 400, code: "invalid_email", message: "이메일 주소 형식을 확인해 주세요." });
  });

  it("응답이 없거나 JSON 이 아니면 상태 코드로 문구를 고른다", () => {
    expect(toApiError(0, null).code).toBe("network");
    expect(toApiError(429, null).code).toBe("too_many_requests");
    expect(toApiError(502, null).code).toBe("unavailable");
    expect(toApiError(422, { detail: [{ msg: "x" }] }).code).toBe("unknown");
  });
});

describe("needsPasswordStep", () => {
  const user = (has_password: boolean): AuthUser => ({ id: "u", email: "me@example.com", has_password, created_at: "", last_login_at: "" });

  it("가입·비밀번호 없음·재설정일 때만 비밀번호 화면을 보여 준다", () => {
    expect(needsPasswordStep({ created: true, purpose: "signup", user: user(false) })).toBe(true);
    expect(needsPasswordStep({ created: false, purpose: "login", user: user(false) })).toBe(true);
    expect(needsPasswordStep({ created: false, purpose: "reset", user: user(true) })).toBe(true);
    expect(needsPasswordStep({ created: false, purpose: "login", user: user(true) })).toBe(false);
  });
});
