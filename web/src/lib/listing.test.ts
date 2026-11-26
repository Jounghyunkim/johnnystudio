import { deflateRawSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { emptyPage, httpsHost, splitLines } from "./listing";
import { BundleError, readListingFile } from "./listing-bundle";
import { addImages, applyImport, newDraft, pageInput, removeImage, saveListing } from "./listing-draft";
import { cleanImagePath, parseListingMarkdown } from "./listing-format";
import { featureLine, markdownToPlain, msStoreFields, msStoreText } from "./listing-msstore";
import { listingPrompt, listingTemplate } from "./listing-prompt";
import { ZipError, listZip } from "./zip";

const categories = { productivity: "생산성", developer: "개발 도구", other: "기타" };
const msCategories = { productivity: "Productivity (생산성)", "utilities-tools": "Utilities + tools (유틸리티·도구)" };

/** 테스트용 zip 만들기 (저장·deflate) */
function makeZip(files: Record<string, string | Uint8Array>, { deflate = true } = {}): ArrayBuffer {
  const enc = new TextEncoder();
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const raw = typeof content === "string" ? enc.encode(content) : content;
    const data = deflate ? new Uint8Array(deflateRawSync(raw)) : raw;
    const nameBytes = enc.encode(name);
    const head = new DataView(new ArrayBuffer(30));
    head.setUint32(0, 0x04034b50, true);
    head.setUint16(6, 0x0800, true);
    head.setUint16(8, deflate ? 8 : 0, true);
    head.setUint32(18, data.length, true);
    head.setUint32(22, raw.length, true);
    head.setUint16(26, nameBytes.length, true);
    local.push(new Uint8Array(head.buffer), nameBytes, data);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, deflate ? 8 : 0, true);
    cd.setUint32(20, data.length, true);
    cd.setUint32(24, raw.length, true);
    cd.setUint16(28, nameBytes.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const cdSize = central.reduce((n, b) => n + b.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, Object.keys(files).length, true);
  end.setUint16(10, Object.keys(files).length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  const parts = [...local, ...central, new Uint8Array(end.buffer)];
  const out = new Uint8Array(parts.reduce((n, b) => n + b.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out.buffer;
}

const SAMPLE = `---
format: johnnystudio-listing/1
kind: showroom
name: 메모 노트
summary: 단축키 하나로 바로 적는 메모장
category: 생산성
url: https://notes.example.com/
pricing: 무료
keywords: [메모, 노트, 회의록]
icon: images/icon.png
cover: images/cover.png
cover_caption: 메모 노트 대표 그림
---

# 메모 노트

회의 중에도 바로 적습니다.

## 이런 분께 추천해요
- 회의록을 자주 쓰는 분
- 생각을 빨리 적고 싶은 분

## 주요 기능
### **빠른 메모**
단축키로 바로 엽니다.
![빠른 메모](images/feature-1.png)

### 태그
메모를 태그로 묶습니다.

## How to use
1. 가입합니다
2. 메모를 씁니다

## 상세 설명
### 왜 만들었나
메모 앱이 느려서 만들었습니다.

\`\`\`
## 코드 안의 제목은 절이 아니다
\`\`\`

## 필요한 환경
- Chrome 최신판

## FAQ
### Q. 무료인가요?
네, 무료입니다.

## 관련 링크
- [GitHub](https://github.com/example/notes)
- 문서: https://notes.example.com/docs
- https://blog.example.com/notes

## 화면
![첫 화면](images/screen-1.png)
![설정](images/screen-2.png "설정 화면")
![나쁜 경로](../secret.png)

## 개발 이야기
혼자 만들었습니다.
`;

describe("listing.md 읽기", () => {
  it("머리말과 절을 양식 값으로", () => {
    const p = parseListingMarkdown(SAMPLE);
    expect(p.kind).toBe("showroom");
    expect(p.fields).toMatchObject({ name: "메모 노트", summary: "단축키 하나로 바로 적는 메모장", category: "생산성", url: "https://notes.example.com/" });
    expect(p.pricing).toBe("무료");
    expect(p.keywords).toEqual(["메모", "노트", "회의록"]);
    expect(p.audience).toEqual(["회의록을 자주 쓰는 분", "생각을 빨리 적고 싶은 분"]);
    expect(p.features).toEqual([
      { title: "빠른 메모", text: "단축키로 바로 엽니다.", image: "images/feature-1.png" },
      { title: "태그", text: "메모를 태그로 묶습니다.", image: null },
    ]);
    expect(p.steps).toEqual(["가입합니다", "메모를 씁니다"]); // 영어 절 이름도 받는다
    expect(p.requirements).toEqual(["Chrome 최신판"]);
    expect(p.faq).toEqual([{ q: "무료인가요?", a: "네, 무료입니다." }]);
    expect(p.links).toEqual([
      { label: "GitHub", url: "https://github.com/example/notes" },
      { label: "문서", url: "https://notes.example.com/docs" },
      { label: "", url: "https://blog.example.com/notes" },
    ]);
    expect(p.icon).toBe("images/icon.png");
    expect(p.gallery).toEqual([
      { path: "images/cover.png", caption: "메모 노트 대표 그림" },
      { path: "images/screen-1.png", caption: "첫 화면" },
      { path: "images/screen-2.png", caption: "설정 화면" },
    ]);
    // 첫 절 앞의 글 + 상세 설명 + 모르는 절. 코드 블록 안의 ## 은 그대로
    expect(p.fields.description).toContain("회의 중에도 바로 적습니다.");
    expect(p.fields.description).toContain("## 코드 안의 제목은 절이 아니다");
    expect(p.fields.description).toContain("### 개발 이야기\n\n혼자 만들었습니다.");
    expect(p.fields.description).not.toContain("# 메모 노트");
    expect(p.warnings.some((w) => w.includes("../secret.png"))).toBe(true);
    expect(p.warnings.some((w) => w.includes("'개발 이야기'"))).toBe(true);
  });

  it("머리말이 없거나 깨져도 읽는다", () => {
    expect(parseListingMarkdown("## 사용 방법\n- 하나").steps).toEqual(["하나"]);
    const broken = parseListingMarkdown("---\nname: [깨진\n---\n## 기능\n### A\nb");
    expect(broken.warnings[0]).toContain("머리말");
    expect(broken.features[0]?.title).toBe("A");
  });

  it("한도를 넘으면 알리고 개수는 자른다", () => {
    const p = parseListingMarkdown(`---\nsummary: ${"가".repeat(161)}\nkeywords: [${Array.from({ length: 12 }, (_, i) => `k${i}`).join(", ")}]\n---\n`);
    expect(p.keywords).toHaveLength(7); // Microsoft Store 검색어 한도
    expect(p.warnings.join("\n")).toMatch(/한 줄 소개.*160자/);
    expect(p.warnings.join("\n")).toMatch(/연관 검색어.*7개/);
  });

  it("그림 경로는 zip 안의 상대 경로만", () => {
    expect(cleanImagePath("./images/a.PNG")).toBe("images/a.PNG");
    expect(cleanImagePath("images\\b.webp")).toBe("images/b.webp");
    for (const bad of ["../a.png", "/etc/a.png", "https://x.com/a.png", "data:image/png;base64,AA", "images/a.svg", "a/../../b.png"]) expect(cleanImagePath(bad)).toBeNull();
  });

  it("견본을 읽으면 같은 칸이 나온다", () => {
    for (const kind of ["store", "showroom"] as const) {
      const p = parseListingMarkdown(listingTemplate(kind, categories, msCategories));
      expect(p.meta).toMatchObject({ developer: "만든 사람 또는 회사 이름", license: "MIT", support: "support@example.com", ms_store_url: "", ms_category: "productivity" });
      expect(p.recommended).toHaveLength(1);
      expect(p.kind).toBe(kind);
      expect(p.fields.category).toBe("productivity");
      expect(p.features).toHaveLength(2);
      expect(p.faq).toHaveLength(1);
      expect(p.gallery.map((g) => g.path)).toEqual(["images/cover.png", "images/screen-1.png", "images/screen-2.png"]);
      expect(p.warnings).toEqual([]);
      if (kind === "store") expect(p.fields.notes).toContain("이번 버전");
      else expect(p.fields.url).toBe("https://example.com/");
    }
  });
});

describe("zip 읽기", () => {
  it("deflate·저장 항목을 푼다", async () => {
    for (const deflate of [true, false]) {
      const entries = listZip(makeZip({ "a/listing.md": "# 안녕", "a/images/": "", "a/images/x.png": new Uint8Array([1, 2, 3]) }, { deflate }));
      expect(entries.map((e) => e.name)).toEqual(["a/listing.md", "a/images/x.png"]);
      expect(new TextDecoder().decode(await entries[0]!.read())).toBe("# 안녕");
      expect([...(await entries[1]!.read())]).toEqual([1, 2, 3]);
    }
  });

  it("깨진 파일·한도를 막는다 (큰 항목은 꺼낼 때만)", async () => {
    expect(() => listZip(new ArrayBuffer(10))).toThrow(ZipError);
    const big = listZip(makeZip({ "x.bin": new Uint8Array(2048), "y.txt": "ok" }), { fileBytes: 1e6, entries: 10, entryBytes: 1024 });
    await expect(big[0]!.read()).rejects.toThrow(/너무 큽니다/);
    expect(new TextDecoder().decode(await big[1]!.read())).toBe("ok");
    expect(() => listZip(makeZip({ a: "1", b: "2", c: "3" }), { fileBytes: 1e6, entries: 2, entryBytes: 1e6 })).toThrow(/너무 많습니다/);
    expect(() => listZip(makeZip({ a: "1" }), { fileBytes: 10, entries: 2, entryBytes: 1e6 })).toThrow(/zip 파일이 너무 큽니다/);
  });
});

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

describe("소개 자료 불러오기", () => {
  it("zip 에서 listing.md 와 그림을 찾는다 (폴더 하나 안에 있어도)", async () => {
    const zip = makeZip({
      "johnnystudio-listing/listing.md": SAMPLE,
      "johnnystudio-listing/images/icon.png": PNG,
      "johnnystudio-listing/images/cover.png": PNG,
      "johnnystudio-listing/images/Screen-1.png": PNG, // 대소문자가 달라도 찾는다
      "johnnystudio-listing/images/feature-1.png": PNG,
      "johnnystudio-listing/images/unused.png": PNG,
      "__MACOSX/johnnystudio-listing/._listing.md": "x",
    });
    const imp = await readListingFile(new File([zip], "listing.zip"));
    expect([...imp.files.keys()].sort()).toEqual(["images/cover.png", "images/feature-1.png", "images/icon.png", "images/screen-1.png"]);
    expect(imp.files.get("images/icon.png")?.type).toBe("image/png");
    expect(imp.missing).toEqual(["images/screen-2.png"]);
    expect(imp.warnings.join("\n")).toContain("unused.png");
  });

  it("md 만 올리면 그림은 모두 따로 올릴 것", async () => {
    const imp = await readListingFile(new File([SAMPLE], "listing.md"));
    expect(imp.files.size).toBe(0);
    expect(imp.missing).toContain("images/screen-1.png");
  });

  it("다른 파일은 받지 않는다", async () => {
    await expect(readListingFile(new File(["x"], "a.pdf"))).rejects.toBeInstanceOf(BundleError);
    await expect(readListingFile(new File([makeZip({ "a.txt": "x" })], "a.zip"))).rejects.toThrow(/listing.md/);
  });
});

describe("편집 상태", () => {
  it("불러온 값으로 채우고, 이름이 같은 그림 파일을 제자리에 넣는다", async () => {
    const imp = await readListingFile(new File([SAMPLE], "listing.md"));
    const { draft, notes } = applyImport(newDraft({ category: "other" }), imp, categories);
    expect(draft.category).toBe("productivity"); // 분류 이름(생산성)도 값으로 바꾼다
    expect(draft.gallery).toHaveLength(0);
    expect(draft.pending.map((p) => p.role)).toEqual(["gallery", "gallery", "gallery", "feature", "icon"]);
    expect(notes).toEqual([]);

    const { draft: d2, rejected } = addImages(draft, [new File([PNG], "screen-1.png"), new File([PNG], "feature-1.png"), new File([PNG], "icon.png"), new File([PNG], "extra.png")]);
    expect(rejected).toEqual([]);
    expect(d2.icon?.file.name).toBe("icon.png");
    expect(d2.gallery.map((g) => g.caption)).toEqual(["첫 화면", "빠른 메모", ""]);
    const feature = d2.features.find((f) => f.title === "빠른 메모");
    expect(feature?.image).toBe(d2.gallery[1]?.key);
    expect(d2.pending.map((p) => p.path)).toEqual(["images/cover.png", "images/screen-2.png"]);

    const ids = new Map(d2.gallery.map((g, i) => [g.key, `${i}`.padStart(16, "0")]));
    const input = pageInput(removeImage(d2, d2.gallery[2]!.key), ids);
    expect(input.gallery).toEqual([
      { id: "0000000000000000", caption: "첫 화면" },
      { id: "0000000000000001", caption: "빠른 메모" },
    ]);
    expect(input.features[0]).toEqual({ title: "빠른 메모", text: "단축키로 바로 엽니다.", image: "0000000000000001" });
    expect(input.keywords).toEqual(["메모", "노트", "회의록"]);
    expect(input.steps).toEqual(["가입합니다", "메모를 씁니다"]);
  });

  it("저장: 아이콘·새 그림을 올린 뒤 순서대로 보낸다. 그림 하나가 실패해도 나머지는 저장한다", async () => {
    const page = { ...emptyPage(), gallery: [{ id: "aaaaaaaaaaaaaaaa", caption: "예전", width: 10, height: 10 }] };
    let draft = newDraft({ name: "x" }, page, (id) => `/img/${id}`);
    draft = addImages(draft, [new File([PNG], "a.png"), new File([PNG], "b.png")]).draft;
    draft = { ...draft, icon: { file: new File([PNG], "icon.png") }, gallery: [draft.gallery[1]!, draft.gallery[0]!, draft.gallery[2]!] };
    const calls: string[] = [];
    let sent: unknown = null;
    const r = await saveListing(
      {
        uploadIcon: async () => (calls.push("icon"), { ok: true, data: null }),
        uploadImage: async (_code, file) => {
          calls.push(file.name);
          return file.name === "b.png" ? { ok: false, status: 415, code: "bad_image", message: "그림이 아닙니다" } : { ok: true, data: { image: { id: "bbbbbbbbbbbbbbbb", caption: "", width: 1, height: 1 } } };
        },
        savePage: async (_code, body) => ((sent = body), { ok: true, data: { page: emptyPage() } }),
      },
      "CODE1234",
      draft,
      () => {},
    );
    expect(calls).toEqual(["icon", "a.png", "b.png"]);
    expect(r.ok && r.failed).toEqual(["b.png: 그림이 아닙니다"]);
    expect((sent as { gallery: { id: string }[] }).gallery.map((g) => g.id)).toEqual(["bbbbbbbbbbbbbbbb", "aaaaaaaaaaaaaaaa"]);
  });
});

describe("도우미", () => {
  it("목록 나누기·https 호스트", () => {
    expect(splitLines("- 하나\n2) 둘\n\n하나\n• 셋")).toEqual(["하나", "둘", "셋"]);
    expect(splitLines("메모, 노트，회의록、메모", true)).toEqual(["메모", "노트", "회의록"]);
    expect(httpsHost("https://Docs.Example.com/a")).toBe("docs.example.com");
    expect(httpsHost("http://example.com")).toBeNull();
    expect(httpsHost("javascript:alert(1)")).toBeNull();
  });

  it("프롬프트에 양식·분류·규칙이 들어 있다", () => {
    const p = listingPrompt("showroom", categories, "https://johnnystudio.net", msCategories);
    expect(p).toContain("Microsoft Store");
    expect(p).toContain("  - utilities-tools: Utilities + tools");
    expect(p).toContain("1920×1080");
    expect(p).toContain("johnnystudio-listing/1");
    expect(p).toContain("  - productivity: 생산성");
    expect(p).toContain("Playwright");
    expect(p).toContain("지어내지 않는다");
    expect(p).toContain("https://johnnystudio.net/store/guide/");
    expect(listingPrompt("store", categories)).toContain("Tauri");
  });
});

describe("Microsoft Store 제출용", () => {
  it("Markdown 을 일반 글로", () => {
    expect(markdownToPlain("### 소제목\n\n**굵게** 와 *기울임*, `코드`, [문서](https://x.com/d)\n- 하나\n\n\n\n끝")).toBe(
      "소제목\n\n굵게 와 기울임, 코드, 문서 (https://x.com/d)\n• 하나\n\n끝",
    );
    expect(featureLine("빠른 메모", "단축키로\n바로 엽니다.")).toBe("빠른 메모 — 단축키로 바로 엽니다.");
  });

  it("칸마다 한도를 본다", async () => {
    const imp = await readListingFile(new File([SAMPLE], "listing.md"));
    const { draft } = applyImport(newDraft({ category: "other" }), imp, categories, msCategories);
    const d = { ...draft, keywords: "하나 둘 셋 넷, 다섯 여섯 일곱 여덟, 아홉 열 열하나 열둘, 가 나 다 라, 마 바 사 아, 자 차 카 타, 파 하 거 너", msCategory: "productivity", notes: "가".repeat(1501) };
    const fields = msStoreFields(d, msCategories, { notes: true });
    const by = (en: string) => fields.find((f) => f.en === en);
    expect(by("Product features")?.items).toEqual(["빠른 메모 — 단축키로 바로 엽니다.", "태그 — 메모를 태그로 묶습니다."]);
    expect(by("Search terms")?.problems.join()).toContain("21개");
    expect(by("What's new in this version")?.problems.join()).toContain("1500자");
    expect(by("Category")?.value).toBe("Productivity (생산성)");
    expect(by("Applicable license terms")?.problems.join()).toContain("꼭 채워야");
    expect(by("Description")?.problems).toEqual([]);
    expect(msStoreFields(d, msCategories).some((f) => f.en === "What's new in this version")).toBe(false);
    expect(msStoreText(fields)).toContain("## 제품 기능 (Product features)\n- 빠른 메모 — 단축키로 바로 엽니다.");
  });
});
