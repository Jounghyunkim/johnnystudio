/** 표시용 형식 변환 */

/** "2025-12-19" → "2025. 12. 19." · "2025-12" → "2025. 12." · "2025" → "2025" */
export function formatDate(date: string | undefined): string {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  if (d) return `${y}. ${Number(m)}. ${Number(d)}.`;
  if (m) return `${y}. ${Number(m)}.`;
  return y ?? "";
}

export function yearOf(date: string): string {
  return date.slice(0, 4);
}

/** 1536 → "1.5 KB" (1024 단위) */
export function formatBytes(bytes: number | undefined): string {
  if (bytes === undefined) return "";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const digits = value >= 100 ? 0 : 1;
  return `${value.toFixed(digits)} ${units[i]}`;
}

/** 외부 주소에서 호스트만: "https://arkurator.net/about" → "arkurator.net" */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}
