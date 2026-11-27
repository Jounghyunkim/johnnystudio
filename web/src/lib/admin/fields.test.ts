import { describe, expect, it } from "vitest";

import { missingFields, toAsset } from "../content";
import { AssetFrontmatter, SLUG_PATTERN } from "../schema";
import { ASSET_TYPES } from "../asset-types";
import { createAssetText, parseAssetSource, sourceData, validateFrontmatter } from "./asset-file";
import {
  BASE_FIELDS,
  cleanValue,
  describeMissing,
  FIELD_ORDER,
  guessDownload,
  SLUG_RE,
  stripForeignFields,
  suggestSlug,
  TYPE_FIELDS,
  youtubeIdFrom,
} from "./fields";
import { templateBody, templateData } from "./templates";

const shapes = AssetFrontmatter.options.map((o) => ({ type: o.shape.type.value, keys: Object.keys(o.shape) }));

describe("관리 도구의 필드 정보가 스키마와 같다", () => {
  it("유형별 필드 = 스키마의 유형별 키", () => {
    for (const { type, keys } of shapes) {
      const extra = keys.filter((k) => !(BASE_FIELDS as readonly string[]).includes(k)).sort();
      expect([type, extra]).toEqual([type, [...TYPE_FIELDS[type]].sort()]);
    }
  });

  it("공통 필드는 모든 유형에 있다", () => {
    for (const { keys } of shapes) expect(BASE_FIELDS.filter((k) => !keys.includes(k))).toEqual([]);
  });

  it("키 순서 목록이 모든 키를 담는다", () => {
    const all = new Set(shapes.flatMap((s) => s.keys));
    expect([...all].filter((k) => !(FIELD_ORDER as readonly string[]).includes(k))).toEqual([]);
  });

  it("slug 규칙이 같다", () => {
    expect(SLUG_RE.source).toBe(SLUG_PATTERN.source);
  });

  it("유형을 바꾸면 이전 유형의 칸을 뺀다", () => {
    expect(stripForeignFields({ title: "a", type: "web-app", url: "https://a.b", tags: [] }, "video")).toEqual({ title: "a", type: "web-app", tags: [] });
  });
});

describe("새 작품 틀", () => {
  it.each(ASSET_TYPES)("%s: 스키마를 통과하는 초안이고, 채우기 전에는 공개할 수 없다", (type) => {
    const text = createAssetText(templateData({ type, title: "새 작품" }), templateBody(type));
    const data = sourceData(parseAssetSource(text));
    const valid = validateFrontmatter(data);
    expect(valid.ok).toBe(true);
    if (!valid.ok) return;
    expect(valid.value.draft).toBe(true);
    const missing = missingFields(toAsset(valid.value, "new-asset", templateBody(type)));
    expect(missing).toContain("date");
    expect(missing).toContain("TODO( 표시가 남아 있다");
    expect(missing).toContain("본문에 TODO( 표시가 남아 있다");
  });

  it("한 줄 소개를 주면 그것을 쓴다", () => {
    expect(templateData({ type: "article", title: " 글 ", summary: "요약" })).toMatchObject({ title: "글", summary: "요약", status: "dev" });
  });
});

describe("입력 도우미", () => {
  it("이름에서 slug 후보를 만든다", () => {
    expect(suggestSlug("Hardware Monitor 2!")).toBe("hardware-monitor-2");
    expect(suggestSlug("SSH 터미널 클라이언트")).toBe("ssh");
    expect(suggestSlug("하드웨어 모니터")).toBe("");
    expect(suggestSlug("Café Déjà-vu")).toBe("cafe-deja-vu");
  });

  it("YouTube 주소에서 ID 를 꺼낸다", () => {
    expect(youtubeIdFrom("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom("https://youtu.be/dQw4w9WgXcQ?si=x")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom(" dQw4w9WgXcQ ")).toBe("dQw4w9WgXcQ");
    expect(youtubeIdFrom("not a video")).toBe("not a video");
  });

  it("파일 이름으로 다운로드 정보를 짐작한다", () => {
    expect(guessDownload("hw-monitor-1.2.0-setup.exe")).toEqual({ label: "Windows 설치 파일", version: "1.2.0-setup", os: ["windows"] });
    expect(guessDownload("Tool_2.1.dmg")).toEqual({ label: "macOS 설치 파일", version: "2.1", os: ["macos"] });
    expect(guessDownload("tool-0.9.1.tar.gz")).toMatchObject({ version: "0.9.1", os: ["linux"] });
    expect(guessDownload("JohnnyApp-1.4.2.apk")).toEqual({ label: "Android APK", version: "1.4.2", os: ["android"] });
    expect(guessDownload("readme.pdf")).toEqual({ label: "", version: "", os: [] });
  });

  it("빈 값을 지운다", () => {
    expect(cleanValue({ a: " x ", b: "", c: null, d: [" ", "t"], e: [{ src: "/a", caption: "" }], f: 0, g: false })).toEqual({
      a: "x",
      d: ["t"],
      e: [{ src: "/a" }],
      f: 0,
      g: false,
    });
  });

  it("채울 것을 풀어 쓴다", () => {
    expect(describeMissing("downloads.1.sha256")).toMatch(/^다운로드 2번의 SHA-256/);
    expect(describeMissing("date")).toMatch(/날짜/);
    expect(describeMissing("모르는 항목")).toBe("모르는 항목");
  });
});
