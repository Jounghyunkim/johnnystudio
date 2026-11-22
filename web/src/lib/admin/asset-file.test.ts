import { describe, expect, it } from "vitest";

import { applyData, AssetFileError, parseAssetSource, serializeAssetSource, sourceData, validateFrontmatter } from "./asset-file";
import { cleanValue } from "./fields";

const HAND_WRITTEN = `---
# 초안: 사람이 남긴 메모
# TODO(content): 날짜
title: 하드웨어 모니터링 앱
type: desktop-app
summary: "TODO(content): 한 줄 소개를 채워 주세요."
status: dev
date: 2024
tags: [데스크톱, 모니터링]
draft: true # 아직 비공개
downloads: []
---

## 무엇을 하나

본문.
`;

function edit(raw: string, change: (data: Record<string, unknown>) => Record<string, unknown>): string {
  const source = parseAssetSource(raw);
  applyData(source, cleanValue(change(sourceData(source))) as Record<string, unknown>);
  return serializeAssetSource(source);
}

describe("작품 파일 고치기", () => {
  it("아무것도 바꾸지 않으면 파일이 그대로다", () => {
    expect(edit(HAND_WRITTEN, (d) => d)).toBe(HAND_WRITTEN);
  });

  it("바꾼 키만 고치고 주석·순서·다른 값의 모양은 지킨다", () => {
    const out = edit(HAND_WRITTEN, (d) => ({ ...d, summary: "CPU·GPU 온도를 띄워 주는 도구", date: "2024" }));
    expect(out).toContain("# 초안: 사람이 남긴 메모\n# TODO(content): 날짜\ntitle: 하드웨어 모니터링 앱");
    expect(out).toContain("summary: CPU·GPU 온도를 띄워 주는 도구\n");
    expect(out).toContain("date: 2024\n"); // "2024" 와 2024 는 같은 값으로 본다 (따옴표가 생기지 않는다)
    expect(out).toContain("tags: [데스크톱, 모니터링]");
    expect(out).toContain("draft: true # 아직 비공개");
    expect(out.endsWith("## 무엇을 하나\n\n본문.\n")).toBe(true);
  });

  it("없던 키는 정해진 순서에 끼워 넣고, 짧은 목록은 한 줄로 쓴다", () => {
    const out = edit(HAND_WRITTEN, (d) => ({
      ...d,
      cover: "/media/hw/cover.webp",
      coverAlt: "그래프 화면",
      downloads: [{ label: "Windows", file: "/files/hw/a.exe", version: "1.0.0", os: ["windows"], size: 10, signed: false }],
    }));
    const keys = [...out.matchAll(/^([a-zA-Z]+):/gm)].map((m) => m[1]);
    expect(keys).toEqual(["title", "type", "summary", "status", "date", "tags", "cover", "coverAlt", "draft", "downloads"]);
    expect(out).toContain("    os: [windows]\n");
    expect(out).toContain("  - label: Windows\n");
  });

  it("빈 값이 된 키는 지운다", () => {
    const out = edit(HAND_WRITTEN, (d) => ({ ...d, draft: undefined, tags: [], date: "" }));
    expect(out).not.toMatch(/^draft:/m);
    expect(out).not.toMatch(/^date:/m);
    expect(out).toContain("tags: []");
  });

  it("긴 문장을 여러 줄로 접지 않는다", () => {
    const long = "가".repeat(130);
    expect(edit(HAND_WRITTEN, (d) => ({ ...d, summary: long }))).toContain(`summary: ${long}\n`);
  });

  it("스키마 검사는 필드 경로와 함께 실패를 알려 준다", () => {
    const r = validateFrontmatter({ title: "x", type: "video", summary: "x", status: "live", youtubeId: "short" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues[0]).toMatchObject({ path: "youtubeId" });
  });

  it("머리말이 없거나 YAML 이 틀리면 AssetFileError", () => {
    expect(() => parseAssetSource("본문만")).toThrow(AssetFileError);
    expect(() => parseAssetSource("---\ntitle: [\n---\n")).toThrow(/YAML/);
    expect(() => parseAssetSource("---\n- a\n---\n")).toThrow(/키: 값/);
  });
});
