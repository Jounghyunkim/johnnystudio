/**
 * 소개 자료 → Microsoft Store(Partner Center) 등록 항목 (2026-11-25 사용자 요청, ADR-0013).
 * 같은 소개 자료로 JohnnyStudio 와 Microsoft Store 에 함께 올릴 수 있게, Partner Center 칸 이름·한도대로 옮겨 적는다.
 * 한도 출처: learn.microsoft.com Windows 앱 제출 문서 (MSI/EXE·MSIX 의 Store 등록 정보, 2026-11-25 확인)
 */
import { LISTING_LIMITS, splitLines } from "./listing";
import type { ListingDraft } from "./listing-draft";

export type MsField = {
  /** Partner Center 의 칸 이름 (한국어 화면 / 영어) */
  label: string;
  en: string;
  value: string;
  /** 한 덩어리 글자 수 한도 (items 면 한 줄 한도) */
  max?: number;
  /** 여러 줄 항목 (제품 기능·요구 사항·검색어·스크린샷 설명) */
  items?: string[];
  maxItems?: number;
  /** 한도·필수 안내 (문제가 있으면 warn) */
  problems: string[];
  note?: string;
};

const count = (s: string) => Array.from(s).length;

/** Microsoft Store 설명은 일반 글자다. Markdown 표시를 걷어 낸다 (링크는 "글 (주소)") */
export function markdownToPlain(md: string): string {
  return md
    .replace(/\r\n?/g, "\n")
    .replace(/^```[^\n]*\n([\s\S]*?)\n```/gm, "$1")
    .replace(/^#{1,6}[ \t]+(.+?)[ \t]*#*[ \t]*$/gm, "$1")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|[^*])\*(?!\s)([^*\n]+?)\*/g, "$1$2")
    .replace(/`([^`\n]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^>\s?/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function featureLine(title: string, text: string): string {
  const t = title.trim();
  const x = text.trim().replace(/\s+/g, " ");
  return t && x ? `${t} — ${x}` : t || x;
}

/** 소개 자료(편집 상태)를 Partner Center 칸으로. kind 가 store 일 때만 '새로운 기능'(바뀐 점)을 넣는다 */
export function msStoreFields(draft: ListingDraft, msCategories: Record<string, string>, opts: { notes?: boolean } = {}): MsField[] {
  const fields: MsField[] = [];
  const add = (f: Omit<MsField, "problems"> & { required?: boolean }) => {
    const problems: string[] = [];
    const { required, ...rest } = f;
    if (required && !f.value.trim() && !f.items?.length) problems.push("Microsoft Store 에서는 꼭 채워야 합니다");
    if (f.max && !f.items && count(f.value) > f.max) problems.push(`${f.max}자를 넘습니다 (${count(f.value)}자)`);
    if (f.items && f.max) {
      const long = f.items.filter((x) => count(x) > (f.max ?? 0)).length;
      if (long) problems.push(`${long}개가 ${f.max}자를 넘습니다`);
    }
    if (f.items && f.maxItems && f.items.length > f.maxItems) problems.push(`${f.maxItems}개까지입니다 (${f.items.length}개)`);
    fields.push({ ...rest, problems });
  };

  add({ label: "설명", en: "Description", value: markdownToPlain(draft.description), max: 10000, required: true, note: "Markdown 표시를 걷어 낸 일반 글입니다" });
  if (opts.notes) add({ label: "이번 버전의 새로운 기능", en: "What's new in this version", value: draft.notes.trim(), max: LISTING_LIMITS.notes, note: "처음 제출할 때는 비워 둡니다" });
  const features = draft.features.filter((f) => f.title.trim() || f.text.trim()).map((f) => featureLine(f.title, f.text));
  add({ label: "제품 기능", en: "Product features", value: features.join("\n"), items: features, max: 200, maxItems: 20, note: "한 칸에 하나씩 넣습니다 (글머리표는 넣지 않습니다)" });
  const captions = draft.gallery.map((g) => g.caption.trim()).filter(Boolean);
  add({ label: "스크린샷 설명", en: "Screenshot captions", value: captions.join("\n"), items: captions, max: 200, maxItems: 10, note: "그림은 zip 의 images/ 원본 PNG(1366×768 이상)를 같은 순서로 올립니다" });
  add({ label: "짧은 설명", en: "Short description", value: draft.summary.trim(), max: 1000, note: "앞 270자만 보이는 화면이 있습니다" });
  const keywords = splitLines(draft.keywords, true);
  const words = new Set(keywords.flatMap((k) => k.split(/\s+/)).map((w) => w.toLowerCase()).filter(Boolean));
  add({ label: "검색어", en: "Search terms", value: keywords.join("\n"), items: keywords, max: 30, maxItems: 7, note: `단어는 모두 합쳐 21개까지 (지금 ${words.size}개)` });
  if (words.size > 21) fields.at(-1)?.problems.push("검색어의 단어가 21개를 넘습니다");
  const minimum = splitLines(draft.requirements);
  const recommended = splitLines(draft.recommended);
  add({ label: "추가 시스템 요구 사항 - 최소 하드웨어", en: "Additional system requirements: Minimum hardware", value: minimum.join("\n"), items: minimum, max: 200, maxItems: 11 });
  add({ label: "추가 시스템 요구 사항 - 권장 하드웨어", en: "Additional system requirements: Recommended hardware", value: recommended.join("\n"), items: recommended, max: 200, maxItems: 11 });
  add({ label: "저작권 및 상표 정보", en: "Copyright and trademark info", value: draft.copyright.trim(), max: 200 });
  add({ label: "적용 가능한 라이선스 조항", en: "Applicable license terms", value: draft.license.trim(), max: 10000, required: true, note: "Microsoft 문서에는 필수로 적혀 있습니다. 라이선스 이름(예: MIT)만 적었다면 전문을 붙여 넣으세요" });
  add({ label: "개발자", en: "Developed by", value: draft.developer.trim(), max: 255 });
  add({ label: "개인정보처리방침 URL", en: "Privacy policy URL", value: draft.privacyUrl.trim(), note: "앱이 개인정보를 다루거나 인터넷에 연결하면 필요합니다" });
  add({ label: "웹 사이트", en: "Website", value: draft.website.trim(), note: "Store 등록 페이지가 아닌 내 사이트 주소" });
  add({ label: "지원 연락처 정보", en: "Support contact info", value: draft.support.trim(), note: "지원 페이지 주소나 이메일" });
  add({ label: "범주", en: "Category", value: msCategories[draft.msCategory] ?? "", required: true });
  return fields;
}

/** 전체를 한 번에 붙여 넣기 좋게 (칸 이름 + 값) */
export function msStoreText(fields: readonly MsField[]): string {
  return fields
    .filter((f) => f.value.trim())
    .map((f) => `## ${f.label} (${f.en})\n${f.items ? f.items.map((x) => `- ${x}`).join("\n") : f.value}`)
    .join("\n\n");
}
