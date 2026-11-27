/**
 * 새 작품의 틀. 모두 초안(draft: true)으로 만들고, 사람이 채워야 할 곳에는 TODO(content) 를 넣는다.
 * 완성도 검사(content.ts 의 missingFields)가 TODO( 와 비어 있는 필수 값을 막으므로, 채우기 전에는 공개되지 않는다.
 */
import type { AssetType } from "../asset-types";
import { TODO_SUMMARY } from "./fields";

export interface TemplateInput {
  type: AssetType;
  title: string;
  summary?: string;
  date?: string;
}

/** 유형별로 처음부터 보이게 둘 빈 목록 (편집기에서 바로 채울 수 있게) */
const TYPE_DEFAULTS: Record<AssetType, Record<string, unknown>> = {
  "web-app": {},
  "desktop-app": { downloads: [] },
  "android-app": { downloads: [] },
  "web-package": {},
  video: {},
  gallery: { photos: [] },
  article: {},
  hardware: { photos: [] },
};

/** 유형별 본문 틀: 상세 페이지의 "소개" 가 된다 */
const BODY: Record<AssetType, string> = {
  "web-app": "## 무엇을 하나\n\nTODO(content): 이 서비스로 할 수 있는 일을 적어 주세요.\n\n## 구성\n\nTODO(content): 기술 구성과 운영 방식",
  "desktop-app": "## 무엇을 하나\n\nTODO(content): 이 도구로 할 수 있는 일을 적어 주세요.\n\n## 변경 내역\n\n- **1.0.0**: 첫 공개",
  "android-app": "## 무엇을 하나\n\nTODO(content): 이 앱으로 할 수 있는 일을 적어 주세요.\n\n## 변경 내역\n\n- **1.0.0**: 첫 공개",
  "web-package": "## 무엇을 하나\n\nTODO(content): 패키지로 체험할 수 있는 것을 적어 주세요.",
  video: "## 영상 소개\n\nTODO(content): 어떤 영상인지, 언제 왜 만들었는지 적어 주세요.",
  gallery: "## 사진 소개\n\nTODO(content): 언제 어디서 찍었는지 적어 주세요.",
  article: "TODO(content): 글을 한두 문단으로 요약해 주세요.",
  hardware: "## 무엇을 만들었나\n\nTODO(content): 만든 이유와 과정을 적어 주세요.\n\n## 부품과 구성\n\nTODO(content)",
};

export function templateData(input: TemplateInput): Record<string, unknown> {
  const summary = input.summary?.trim();
  return {
    title: input.title.trim(),
    type: input.type,
    summary: summary || TODO_SUMMARY,
    status: "dev",
    ...(input.date ? { date: input.date } : {}),
    tags: [],
    draft: true,
    ...TYPE_DEFAULTS[input.type],
  };
}

export function templateBody(type: AssetType): string {
  return BODY[type];
}
