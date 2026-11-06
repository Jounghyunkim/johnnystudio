/**
 * 에셋 유형·상태 목록. zod 없이 값만 둔다.
 * 클라이언트 컴포넌트(Library 필터)는 schema.ts 대신 이 파일을 쓴다. schema.ts 를 가져오면 zod 전체가 브라우저 번들에 들어가고,
 * zod 가 eval 지원 여부를 알아보려고 Function("") 을 시도해서 CSP 위반이 기록된다.
 */
export const ASSET_TYPES = [
  "web-app",
  "desktop-app",
  "web-package",
  "video",
  "gallery",
  "article",
  "hardware",
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const ASSET_STATUSES = ["live", "beta", "dev", "archived"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
