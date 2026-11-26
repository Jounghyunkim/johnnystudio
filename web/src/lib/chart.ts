/**
 * 차트 계산 (설정 > 전체 현황, components/settings/admin-charts.tsx). 화면 없이 시험할 수 있게 따로 둔다.
 */

/** "2026-11-24" → "11월 24일" */
export function dayLabel(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}월 ${d}일`;
}

/** 0 부터 max 를 덮는 깔끔한 눈금 (정수, 3~5개) */
export function ticks(max: number): number[] {
  if (max <= 4) return Array.from({ length: Math.max(max, 1) + 1 }, (_, i) => i);
  const raw = max / 4;
  const pow = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? raw;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** 앞에서부터 더한 값 (누적) */
export function runningSum(values: readonly number[], start = 0): number[] {
  return values.reduce<number[]>((acc, v) => [...acc, (acc[acc.length - 1] ?? start) + v], []);
}

/** 막대: 끝만 둥글게(4px), 바닥은 각지게 */
export function columnPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}
