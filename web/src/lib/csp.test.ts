import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

import { injectCsp, scriptHashes } from "../../scripts/inject-csp.mjs";

const sha = (s: string) => `'sha256-${createHash("sha256").update(s, "utf8").digest("base64")}'`;
const page = (head: string, body: string) => `<!DOCTYPE html><html lang="ko"><head>${head}</head><body>${body}</body></html>`;

describe("inject-csp", () => {
  it("실행되는 인라인 스크립트만 해시한다 (src 있는 것·JSON 데이터 제외, 중복 제거)", () => {
    const html = page(
      '<meta charSet="utf-8"/><script src="/_next/a.js" async=""></script>',
      '<script>self.a=1</script><script id="x">self.b=2</script><script>self.a=1</script><script type="application/ld+json">{"a":1}</script>',
    );
    expect(scriptHashes(html)).toEqual([sha("self.a=1"), sha("self.b=2")]);
  });

  it("charset 바로 뒤, 첫 스크립트보다 앞에 <meta> 를 넣는다", () => {
    const out = injectCsp(page('<meta charSet="utf-8"/><title>t</title>', "<script>go()</script>"));
    expect(out).toContain(`<meta charSet="utf-8"/><meta http-equiv="Content-Security-Policy" content="script-src 'self' ${sha("go()")}"/><title>`);
    expect(out.indexOf("Content-Security-Policy")).toBeLessThan(out.indexOf("<script>"));
    expect(out).not.toContain("unsafe-inline");
  });

  it("두 번 돌려도 <meta> 가 하나다", () => {
    const once = injectCsp(page('<meta charSet="utf-8"/>', "<script>go()</script>"));
    const twice = injectCsp(once);
    expect(twice).toBe(once);
    expect(twice.match(/Content-Security-Policy/g)).toHaveLength(1);
  });

  it("인라인 스크립트가 없으면 'self' 만 허용한다", () => {
    expect(injectCsp(page("", "<p>hi</p>"))).toContain(`content="script-src 'self'"`);
  });
});
