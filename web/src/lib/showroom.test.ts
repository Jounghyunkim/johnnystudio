import { describe, expect, it } from "vitest";

import { looksLikeServiceUrl, serviceHref, showroomEntries } from "./showroom";

describe("Showroom", () => {
  const categories = { ai: "AI", productivity: "생산성", other: "기타" };
  const official = [{ slug: "arkurator", title: "Arkurator", summary: "지식 관리", tags: ["AI", "RAG"], url: "https://arkurator.net", date: "2025-12-19" }];
  const member = {
    code: "AveRZ5ed", name: "메모 노트", url: "https://notes.example.com/", host: "notes.example.com", summary: "브라우저 메모장",
    category: "productivity", category_label: "생산성", publisher: "개발자", has_icon: false, updated_at: "2026-11-24T03:00:00+00:00",
  };
  const q = (patch: Partial<{ q: string; category: string; sort: "new" | "name" }> = {}) => ({ q: "", category: "", sort: "new" as const, ...patch });

  it("공식 서비스와 회원 서비스를 최신순으로 섞고, 공식 분류는 태그로", () => {
    const entries = showroomEntries(official, [member], q(), categories);
    expect(entries.map((e) => e.kind)).toEqual(["member", "official"]);
    expect(entries[1]).toMatchObject({ category: "ai", categoryLabel: "AI" });
    expect(showroomEntries(official, [member], q({ category: "ai" }), categories)).toHaveLength(2); // 회원 서비스는 API 가 이미 걸렀다
    expect(showroomEntries(official, [], q({ q: "메모" }), categories)).toHaveLength(0);
  });

  it("주소 앞부분 확인과 링크", () => {
    expect(looksLikeServiceUrl("https://notes.example.com")).toBe(true);
    for (const bad of ["http://notes.example.com", "https://localhost", "https://u:p@a.example.com", "notes.example.com"]) expect(looksLikeServiceUrl(bad)).toBe(false);
    expect(serviceHref("AveRZ5ed")).toBe("/showroom/service/?id=AveRZ5ed");
  });
});
