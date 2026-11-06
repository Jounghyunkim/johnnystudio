/**
 * 실제 content/ 를 검사한다. 콘텐츠 파일을 추가하거나 고치면 이 테스트가 형식과 완성도를 확인한다.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { AssetFrontmatter } from "./schema";
import {
  getPage,
  getProfile,
  loadAllAssets,
  loadLifeLog,
  localMediaExists,
  mediaPaths,
  missingFields,
} from "./content";

const assets = loadAllAssets();

describe("content/assets", () => {
  it("에셋이 하나 이상 있다", () => {
    expect(assets.length).toBeGreaterThan(0);
  });

  it("초안이 아닌 에셋은 출시할 만큼 채워져 있다", () => {
    const problems = assets
      .filter((a) => !a.draft)
      .flatMap((a) => missingFields(a).map((m) => `${a.slug}: ${m}`));
    expect(problems).toEqual([]);
  });

  it("sample- 에셋은 반드시 초안이다", () => {
    expect(assets.filter((a) => a.slug.startsWith("sample-") && !a.draft).map((a) => a.slug)).toEqual([]);
  });

  it("사이트 안 이미지 경로가 public/ 에 있다", () => {
    const missing = assets.flatMap((a) => mediaPaths(a).filter((p) => !localMediaExists(p)).map((p) => `${a.slug}: ${p}`));
    expect(missing).toEqual([]);
  });

  it("대표 이미지에는 대체 텍스트가 있다", () => {
    expect(assets.filter((a) => a.cover && !a.coverAlt).map((a) => a.slug)).toEqual([]);
  });

  it("공개 에셋이 적어도 하나는 있다 (출시 빌드가 비지 않게)", () => {
    expect(assets.filter((a) => !a.draft).length).toBeGreaterThan(0);
  });
});

describe("content/lifelog.yaml", () => {
  it("asset 이 가리키는 에셋이 있다", () => {
    const slugs = new Set(assets.map((a) => a.slug));
    const broken = loadLifeLog().filter((e) => e.asset && !slugs.has(e.asset));
    expect(broken).toEqual([]);
  });
});

describe("content/profile.yaml", () => {
  it("형식이 맞고, 서비스가 가리키는 에셋이 있다", () => {
    const profile = getProfile();
    const slugs = new Set(assets.map((a) => a.slug));
    const broken = profile.services.flatMap((s) => s.related.filter((r) => !slugs.has(r)));
    expect(broken).toEqual([]);
  });
});

describe("스키마", () => {
  it("모르는 필드는 거부한다 (오타 잡기)", () => {
    const r = AssetFrontmatter.safeParse({ title: "x", type: "web-app", summary: "x", status: "live", urll: "https://a.b" });
    expect(r.success).toBe(false);
  });

  it("날짜는 YYYY 숫자도 받는다", () => {
    const r = AssetFrontmatter.safeParse({ title: "x", type: "article", summary: "x", status: "live", date: 2024 });
    expect(r.success && r.data.date).toBe("2024");
  });

  it("잘못된 SHA-256 을 거부한다", () => {
    const r = AssetFrontmatter.safeParse({
      title: "x",
      type: "desktop-app",
      summary: "x",
      status: "live",
      downloads: [{ label: "a", file: "/files/a.exe", version: "1", os: ["windows"], sha256: "XYZ" }],
    });
    expect(r.success).toBe(false);
  });

  it("missingFields 는 빈 체크섬과 0 으로 채운 체크섬을 잡는다", () => {
    const base = { slug: "t", html: "", title: "t", summary: "t", status: "live" as const, date: "2026", tags: [], featured: false, draft: false, links: [] };
    const asset = {
      ...base,
      type: "desktop-app" as const,
      downloads: [
        { label: "a", file: "/files/a.exe", version: "1", os: ["windows" as const], size: 1, signed: false },
        { label: "b", file: "/files/b.exe", version: "1", os: ["windows" as const], size: 1, signed: false, sha256: "0".repeat(64) },
      ],
    };
    expect(missingFields(asset)).toEqual(["downloads.0.sha256", "downloads.1.sha256"]);
  });
});

describe("콘텐츠 오류 메시지", () => {
  it("잘못된 파일은 파일명과 필드를 알려 주며 실패한다", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "js-content-"));
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "assets", "bad.md"), "---\ntitle: x\ntype: video\nsummary: x\nstatus: nope\n---\n");
    const prev = process.env.CONTENT_DIR;
    process.env.CONTENT_DIR = dir;
    try {
      const { vi } = await import("vitest");
      vi.resetModules();
      const fresh = await import("./content");
      expect(() => fresh.loadAllAssets()).toThrowError(/bad\.md: status/);
    } finally {
      process.env.CONTENT_DIR = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("content/pages", () => {
  it("개인정보처리방침이 있고 형식이 맞다", () => {
    const page = getPage("privacy");
    expect(page.title).toBe("개인정보처리방침");
    expect(page.html).toContain("<table>");
  });

  it("없는 페이지는 분명한 오류를 낸다", () => {
    expect(() => getPage("no-such-page")).toThrow(/파일이 없다/);
  });
});

describe("content/profile.yaml 의 landing", () => {
  const appDir = path.join(process.cwd(), "src", "app");
  const pageExists = (href: string) => {
    const route = href.split(/[?#]/, 1)[0]!.replace(/^\/|\/$/g, "");
    return fs.existsSync(path.join(appDir, route, "page.tsx"));
  };

  it("단계·FAQ 의 링크가 실제 페이지를 가리킨다", () => {
    const { landing } = getProfile();
    const hrefs = [...landing.steps.map((s) => s.href), ...landing.faq.flatMap((f) => (f.link ? [f.link.href] : []))];
    expect(hrefs.filter((h) => !pageExists(h))).toEqual([]);
  });
});
