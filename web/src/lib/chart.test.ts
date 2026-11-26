import { describe, expect, it } from "vitest";

import { columnPath, dayLabel, runningSum, ticks } from "./chart";

describe("차트 계산 (설정 > 전체 현황)", () => {
  it("눈금은 0 부터 최댓값을 덮는 깔끔한 정수", () => {
    expect(ticks(0)).toEqual([0, 1]);
    expect(ticks(3)).toEqual([0, 1, 2, 3]);
    expect(ticks(7)).toEqual([0, 2, 4, 6, 8]);
    expect(ticks(37)).toEqual([0, 10, 20, 30, 40]);
    expect(ticks(1234)).toEqual([0, 500, 1000, 1500]);
  });

  it("누적은 시작값부터 더한다 (기간 앞의 회원 + 그날까지 가입)", () => {
    expect(runningSum([1, 0, 2], 10)).toEqual([11, 11, 13]);
    expect(runningSum([])).toEqual([]);
  });

  it("날짜는 '월 일'로", () => {
    expect(dayLabel("2026-11-04")).toBe("11월 4일");
  });

  it("막대는 끝만 둥글고 바닥은 각지다 (낮은 막대는 반지름이 높이를 넘지 않는다)", () => {
    expect(columnPath(0, 10, 20, 30)).toBe("M0,40V14Q0,10 4,10H16Q20,10 20,14V40Z");
    expect(columnPath(0, 38, 20, 2)).toBe("M0,40V40Q0,38 2,38H18Q20,38 20,40V40Z");
  });
});
