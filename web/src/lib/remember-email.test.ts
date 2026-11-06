import { describe, expect, it } from "vitest";

import { parseRememberedEmail } from "./remember-email";

describe("parseRememberedEmail", () => {
  it("이메일처럼 생긴 값만 쓴다", () => {
    expect(parseRememberedEmail("me@example.com")).toBe("me@example.com");
    expect(parseRememberedEmail("  me@example.com ")).toBe("me@example.com");
  });

  it("비었거나 이상한 값은 버린다 (손으로 고친 값, 옛 형식)", () => {
    for (const bad of [null, "", "me", "me@example", "a b@example.com", '{"email":"me@example.com"}', `${"a".repeat(250)}@example.com`]) {
      expect(parseRememberedEmail(bad)).toBe("");
    }
  });
});
