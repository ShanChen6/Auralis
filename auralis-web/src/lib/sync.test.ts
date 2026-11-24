import { describe, expect, it } from "vitest";
import { findActiveParagraph, paragraphProgress } from "./sync";

const stamps = [
  { index: 0, start: 3, end: 11.6 },
  { index: 1, start: 12.6, end: 24 },
  { index: 2, start: 25, end: 40 },
];

describe("findActiveParagraph", () => {
  it("trả -1 trong phần intro", () => {
    expect(findActiveParagraph(stamps, 0)).toBe(-1);
    expect(findActiveParagraph(stamps, 2.99)).toBe(-1);
  });

  it("chọn đoạn có start <= thời điểm hiện tại", () => {
    expect(findActiveParagraph(stamps, 3)).toBe(0);
    expect(findActiveParagraph(stamps, 13)).toBe(1);
    expect(findActiveParagraph(stamps, 39)).toBe(2);
  });

  it("giữ đoạn trước trong khoảng nghỉ và sau khi đọc xong", () => {
    expect(findActiveParagraph(stamps, 12)).toBe(0);
    expect(findActiveParagraph(stamps, 44)).toBe(2);
  });

  it("xử lý danh sách rỗng", () => {
    expect(findActiveParagraph([], 10)).toBe(-1);
  });
});

describe("paragraphProgress", () => {
  it("tính tiến độ trong đoạn, kẹp trong 0..1", () => {
    expect(paragraphProgress(stamps[0], 3)).toBe(0);
    expect(paragraphProgress(stamps[0], 7.3)).toBeCloseTo(0.5);
    expect(paragraphProgress(stamps[0], 99)).toBe(1);
    expect(paragraphProgress(undefined, 5)).toBe(0);
  });
});
