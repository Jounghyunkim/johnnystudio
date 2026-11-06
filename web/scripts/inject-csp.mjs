#!/usr/bin/env node
/**
 * 빌드 뒤 처리: 페이지마다 인라인 <script> 의 SHA-256 해시로 CSP <meta> 를 넣는다. (ADR-0007)
 *
 *   node scripts/inject-csp.mjs out      (npm run build 가 next build 다음에 부른다)
 *
 * 왜: Next.js 정적 내보내기는 페이지마다 인라인 <script>(RSC 데이터)를 넣는다. 그래서 nginx 의 CSP 헤더에는
 *     script-src 'unsafe-inline' 이 있어야 한다. 정적 파일이라 nonce 는 쓸 수 없지만, 내용이 빌드할 때 정해지므로
 *     해시는 쓸 수 있다. 브라우저는 헤더와 <meta> 두 정책을 모두 지키므로, 실제로는 해시가 맞는 인라인 스크립트만 실행된다.
 *     로그인이 생기면서 XSS 의 피해가 커졌기 때문에 넣는다 (ADR-0004 의 "로그인 전에 nonce CSP" 를 대신한다).
 *
 * 검사: scripts/check_site.py --built 가 다른 방법(HTMLParser)으로 해시를 다시 계산해서 맞춰 본다.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const INLINE_SCRIPT = /<script\b(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/gi;
const TYPE_ATTR = /\btype\s*=\s*["']?([^"'\s>]+)/i;
const META_CSP = /<meta http-equiv="Content-Security-Policy"[^>]*>/gi;
const CHARSET = /<meta charSet="utf-8"\s*\/?>/i;
const HEAD = /<head\b[^>]*>/i;
// 실행되지 않는 데이터 블록은 CSP 대상이 아니다
const DATA_TYPES = new Set(["application/ld+json", "application/json"]);

/** 페이지의 실행되는 인라인 스크립트 해시 (나온 순서, 중복 없이) */
export function scriptHashes(html) {
  const seen = new Set();
  for (const m of html.matchAll(INLINE_SCRIPT)) {
    const type = TYPE_ATTR.exec(m[1] ?? "")?.[1]?.toLowerCase();
    if (type && DATA_TYPES.has(type)) continue;
    seen.add(`'sha256-${createHash("sha256").update(m[2] ?? "", "utf8").digest("base64")}'`);
  }
  return [...seen];
}

export function injectCsp(html) {
  const clean = html.replace(META_CSP, "");
  const policy = ["script-src 'self'", ...scriptHashes(clean)].join(" ");
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}"/>`;
  // charset 선언은 문서 첫 1024바이트 안에 있어야 하므로 그 뒤에 넣는다. CSP 는 첫 <script> 보다 앞이어야 한다
  const anchor = CHARSET.exec(clean) ?? HEAD.exec(clean);
  if (!anchor) throw new Error("<head> 를 찾지 못했다");
  const at = anchor.index + anchor[0].length;
  return clean.slice(0, at) + meta + clean.slice(at);
}

function* htmlFiles(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(p);
    else if (entry.name.endsWith(".html")) yield p;
  }
}

function main() {
  const root = path.resolve(process.argv[2] ?? "out");
  if (!fs.existsSync(root)) {
    console.error(`✗ ${root} 가 없다`);
    process.exit(1);
  }
  let pages = 0;
  let scripts = 0;
  for (const file of htmlFiles(root)) {
    const html = fs.readFileSync(file, "utf8");
    const next = injectCsp(html);
    scripts += scriptHashes(next).length;
    fs.writeFileSync(file, next);
    pages += 1;
  }
  console.log(`CSP 해시: HTML ${pages}개, 인라인 스크립트 ${scripts}개`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main();
