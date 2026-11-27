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
  renderMarkdown,
  toSummary,
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

  it("missingFields 는 본문에 남은 TODO( 도 잡는다", () => {
    const asset = { slug: "t", html: "<p>TODO(content): 소개</p>", title: "t", summary: "t", status: "live" as const, date: "2026", tags: [], featured: false, draft: false, links: [], type: "article" as const, url: "https://a.b" };
    expect(missingFields(asset)).toEqual(["본문에 TODO( 표시가 남아 있다"]);
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

  it("아이콘도 사이트 안 이미지로 검사한다", () => {
    const asset = { slug: "t", html: "", title: "t", summary: "t", status: "live" as const, tags: [], featured: false, draft: false, links: [], type: "desktop-app" as const, downloads: [], icon: "/media/t/icon.png" };
    expect(mediaPaths(asset)).toEqual(["/media/t/icon.png"]);
    expect(AssetFrontmatter.safeParse({ title: "t", type: "video", summary: "t", status: "live", icon: "icon.png" }).success).toBe(false);
  });
});

describe("본문 Markdown", () => {
  it("외부 링크는 새 탭으로 열고, 사이트 안 링크는 그대로 둔다", () => {
    const html = renderMarkdown("소스는 https://ffmpeg.org 를 보세요. [목록](/library/) · [원문](http://example.com/a?b=1)");
    expect(html).toContain('<a href="https://ffmpeg.org" target="_blank" rel="noopener noreferrer">');
    expect(html).toContain('<a href="http://example.com/a?b=1" target="_blank" rel="noopener noreferrer">');
    expect(html).toContain('<a href="/library/">');
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
      if (prev === undefined) delete process.env.CONTENT_DIR;
      else process.env.CONTENT_DIR = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("개발 서버 캐시", () => {
  it("파일을 더하거나 고치면 다시 읽는다 (개발 서버를 다시 켜지 않아도 된다)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "js-content-"));
    fs.mkdirSync(path.join(dir, "assets"));
    const write = (slug: string, title: string) =>
      fs.writeFileSync(path.join(dir, "assets", `${slug}.md`), `---\ntitle: ${title}\ntype: article\nsummary: x\nstatus: dev\ndraft: true\n---\n`);
    write("one", "하나");
    const prev = process.env.CONTENT_DIR;
    process.env.CONTENT_DIR = dir;
    try {
      const { vi } = await import("vitest");
      vi.resetModules();
      const fresh = await import("./content");
      expect(fresh.loadAllAssets().map((a) => a.title)).toEqual(["하나"]);
      expect(fresh.loadAllAssets()).toBe(fresh.loadAllAssets()); // 바뀐 것이 없으면 같은 결과를 그대로 쓴다

      write("two", "둘");
      expect(fresh.loadAllAssets().map((a) => a.title).sort()).toEqual(["둘", "하나"]);

      const file = path.join(dir, "assets", "one.md");
      fs.writeFileSync(file, fs.readFileSync(file, "utf8").replace("하나", "하나(고침)"));
      fs.utimesSync(file, new Date(), new Date(Date.now() + 5000)); // 수정 시각 해상도가 낮은 파일 시스템 대비
      expect(fresh.loadAllAssets().map((a) => a.title)).toContain("하나(고침)");
    } finally {
      if (prev === undefined) delete process.env.CONTENT_DIR;
      else process.env.CONTENT_DIR = prev;
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

describe("Microsoft Store 주소 (desktop-app 의 microsoftStore)", () => {
  const desktop = (microsoftStore: string) =>
    AssetFrontmatter.safeParse({ title: "t", type: "desktop-app", summary: "t", status: "live", microsoftStore }).success;

  it("apps.microsoft.com 의 앱 상세 주소만 받는다", () => {
    expect(desktop("https://apps.microsoft.com/detail/9PCP2R7RSDQ8?hl=ko-kr&gl=KR")).toBe(true);
    expect(desktop("https://apps.microsoft.com/detail/9PCP2R7RSDQ8")).toBe(true);
    expect(desktop("http://apps.microsoft.com/detail/9PCP2R7RSDQ8")).toBe(false);
    expect(desktop("https://apps.microsoft.com.evil.example/detail/9PCP2R7RSDQ8")).toBe(false);
    expect(desktop("https://apps.microsoft.com/search?query=wlt")).toBe(false);
    expect(desktop("https://apps.microsoft.com/detail/short")).toBe(false);
    expect(AssetFrontmatter.safeParse({ title: "t", type: "web-app", summary: "t", status: "live", microsoftStore: "https://apps.microsoft.com/detail/9PCP2R7RSDQ8" }).success).toBe(false);
  });

  it("카드에 'MS Store' 바로가기(아이콘과 함께)가 생긴다", () => {
    const asset = {
      slug: "t", html: "", title: "t", summary: "t", status: "live" as const, tags: [], featured: false, draft: false, links: [],
      type: "desktop-app" as const, downloads: [], microsoftStore: "https://apps.microsoft.com/detail/9PCP2R7RSDQ8",
    };
    expect(toSummary(asset).quickAction).toEqual({ label: "MS Store", href: "https://apps.microsoft.com/detail/9PCP2R7RSDQ8", icon: "microsoft-store" });
    expect(toSummary({ ...asset, microsoftStore: undefined }).quickAction).toBeUndefined();
  });
});

describe("안드로이드 앱 (android-app, 2026-11-27 사용자 요청)", () => {
  const PLAY = "https://play.google.com/store/apps/details?id=com.johnnystudio.app";
  const android = (fields: Record<string, unknown>) =>
    AssetFrontmatter.safeParse({ title: "t", type: "android-app", summary: "t", status: "live", ...fields }).success;
  const asset = {
    slug: "t", html: "", title: "t", summary: "t", status: "live" as const, date: "2026", tags: [], featured: false, draft: false, links: [],
    type: "android-app" as const, downloads: [],
  };
  const apk = { label: "Android APK", file: "/files/t/t-1.0.apk", version: "1.0", os: ["android" as const], size: 1, signed: true, sha256: "a".repeat(64) };

  it("Google Play 주소는 play.google.com 의 앱 상세(id=패키지 이름)만 받는다", () => {
    expect(android({ googlePlay: PLAY })).toBe(true);
    expect(android({ googlePlay: `${PLAY}&hl=ko` })).toBe(true);
    expect(android({ googlePlay: PLAY.replace("https:", "http:") })).toBe(false);
    expect(android({ googlePlay: "https://play.google.com.evil.example/store/apps/details?id=com.a.b" })).toBe(false);
    expect(android({ googlePlay: "https://play.google.com/store/search?q=johnny" })).toBe(false);
    expect(android({ googlePlay: "https://play.google.com/store/apps/details?id=noperiod" })).toBe(false);
    expect(AssetFrontmatter.safeParse({ title: "t", type: "desktop-app", summary: "t", status: "live", googlePlay: PLAY }).success).toBe(false);
  });

  it("APK 는 os: [android] 로 받는다", () => {
    expect(android({ downloads: [apk] })).toBe(true);
  });

  it("공개하려면 Google Play 주소나 APK 가 있어야 하고, APK 는 크기·체크섬이 있어야 한다", () => {
    expect(missingFields(asset)).toEqual(["googlePlay 또는 downloads"]);
    expect(missingFields({ ...asset, googlePlay: PLAY })).toEqual([]);
    expect(missingFields({ ...asset, downloads: [apk] })).toEqual([]);
    expect(missingFields({ ...asset, downloads: [{ ...apk, size: undefined, sha256: "0".repeat(64) }] })).toEqual(["downloads.0.size", "downloads.0.sha256"]);
  });

  it("카드에 'Google Play' 바로가기가 생기고, 상세는 Library 에 있다", () => {
    const s = toSummary({ ...asset, googlePlay: PLAY });
    expect(s.quickAction).toEqual({ label: "Google Play", href: PLAY });
    expect(s.href).toBe("/library/t/");
    expect(toSummary(asset).quickAction).toBeUndefined();
  });
});

describe("Store·Showroom DB 로 옮긴 작품 (storeApp·showroomService, ADR-0014)", () => {
  const parse = (data: Record<string, unknown>) => AssetFrontmatter.safeParse({ title: "t", summary: "t", status: "live", ...data }).success;

  it("코드는 영문·숫자 4~12자이고, 앱은 storeApp, 웹 서비스는 showroomService 만 받는다", () => {
    expect(parse({ type: "desktop-app", storeApp: "Ab12Cd34" })).toBe(true);
    expect(parse({ type: "desktop-app", storeApp: "ab-12" })).toBe(false);
    expect(parse({ type: "desktop-app", storeApp: "abc" })).toBe(false);
    expect(parse({ type: "web-app", showroomService: "Xy98Zw76" })).toBe(true);
    expect(parse({ type: "web-app", storeApp: "Ab12Cd34" })).toBe(false);
    expect(parse({ type: "desktop-app", showroomService: "Ab12Cd34" })).toBe(false);
  });

  it("옮긴 작품은 Store·Showroom 목록에 content 의 '공식'으로 다시 합쳐지지 않는다 (DB 의 것이 보인다)", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "js-official-"));
    fs.mkdirSync(path.join(dir, "assets"));
    const app = (slug: string, extra: string) =>
      `---\ntitle: ${slug}\ntype: desktop-app\nsummary: t\nstatus: live\ndate: 2026-01-01\n${extra}downloads:\n  - label: Windows\n    file: /files/${slug}/a.exe\n    version: 1.0.0\n    os: [windows]\n---\n본문\n`;
    fs.writeFileSync(path.join(dir, "assets", "kept.md"), app("kept", ""));
    fs.writeFileSync(path.join(dir, "assets", "moved.md"), app("moved", "storeApp: Ab12Cd34\n"));
    fs.writeFileSync(path.join(dir, "assets", "web.md"), "---\ntitle: web\ntype: web-app\nsummary: t\nstatus: live\nurl: https://a.example\nshowroomService: Xy98Zw76\n---\n");
    const prev = process.env.CONTENT_DIR;
    process.env.CONTENT_DIR = dir;
    try {
      const { vi } = await import("vitest");
      vi.resetModules(); // CONTENT_DIR 은 모듈을 읽을 때 정해진다 (위 '개발 서버 캐시' 시험과 같다)
      const { getOfficialStoreApps, getOfficialShowroomServices } = await import("./content");
      expect(getOfficialStoreApps().map((a) => a.slug)).toEqual(["kept"]);
      expect(getOfficialShowroomServices()).toEqual([]);
    } finally {
      if (prev === undefined) delete process.env.CONTENT_DIR;
      else process.env.CONTENT_DIR = prev;
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("Library = JohnnyStudio 가 Store·Showroom 에 올린 것 (ADR-0015, 2026-11-27 사용자 요청)", () => {
  const read = (file: string) => fs.readFileSync(path.join(process.cwd(), file), "utf8");

  it("Library 화면은 Store·Showroom 의 공식 목록(official=true)만 부른다 (회원 앱·서비스는 Store·Showroom 에만)", () => {
    const browser = read("src/components/library-browser.tsx");
    expect(browser).toMatch(/storeApi\.list\(OFFICIAL_SEARCH\)/);
    expect(browser).toMatch(/showroomApi\.list\(OFFICIAL_SEARCH\)/);
    expect(browser.match(/Api\.list\(/g)).toHaveLength(2);
    expect(read("src/lib/library.ts")).toMatch(/export const OFFICIAL_SEARCH = "\?official=true";/);
    for (const file of ["src/app/library/page.tsx", "src/components/asset-card.tsx", "src/lib/filter.ts"]) {
      expect([file, /@\/lib\/(store|showroom)["']/.test(read(file))]).toEqual([file, false]);
    }
  });

  it("Store·Showroom 으로 옮긴 작품은 누르면 그 화면으로 간다 (Library 상세를 따로 두지 않는다)", () => {
    for (const a of assets.filter((x) => !x.draft)) {
      const s = toSummary(a);
      if (a.type === "desktop-app" && a.storeApp) expect([a.slug, s.href]).toEqual([a.slug, `/store/app/?id=${a.storeApp}`]);
      else if (a.type === "web-app" && a.showroomService) expect([a.slug, s.href]).toEqual([a.slug, `/showroom/service/?id=${a.showroomService}`]);
      else expect([a.slug, s.href]).toEqual([a.slug, `/library/${a.slug}/`]);
      expect(s.bookmark).toBe(a.slug); // 즐겨찾기는 어디서 눌러도 slug (Store·Showroom 화면은 getLibrarySlugs 로 받는다)
    }
  });

  it("Library 상세는 옮긴 작품을 Store·Showroom 화면으로 넘겨 준다", () => {
    const page = read("src/app/library/[slug]/page.tsx");
    expect(page).toMatch(/if \(summary\.storeApp \|\| summary\.showroomService\) return <MovedNotice /);
    expect(page).toMatch(/<meta httpEquiv="refresh" content=\{`0;url=\$\{href\}`\} \/>/);
  });
});
