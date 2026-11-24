import { describe, expect, it } from "vitest";
import { categoryMoodLabel, formatDurationLabel, formatTime, musicLabel, voiceLabel } from "./format";

describe("format", () => {
  it("formatTime", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(83.9)).toBe("1:23");
    expect(formatTime(3725)).toBe("1:02:05");
    expect(formatTime(Number.NaN)).toBe("0:00");
  });

  it("formatDurationLabel làm tròn phút, tối thiểu 1 phút", () => {
    expect(formatDurationLabel(20)).toBe("1 phút");
    expect(formatDurationLabel(150)).toBe("3 phút");
    expect(formatDurationLabel(null)).toBe("—");
  });

  it("nhãn giọng đọc và nhạc nền", () => {
    expect(voiceLabel("vi-VN-HoaiMyNeural", true)).toBe("Giọng AI · Hoài My · Nữ trầm ấm");
    expect(voiceLabel(null, false)).toBe("Chưa có giọng đọc");
    expect(musicLabel("lofi_warm")).toBe("Lo-fi ấm áp");
    expect(musicLabel(null)).toBe("Không nhạc nền");
  });

  it("categoryMoodLabel bỏ lặp", () => {
    expect(categoryMoodLabel("Radio đêm", "CALM")).toBe("Radio đêm · Bình yên");
    expect(categoryMoodLabel("Chữa lành", "HEALING")).toBe("Chữa lành");
    expect(categoryMoodLabel(null, "HOPEFUL")).toBe("Hy vọng");
  });
});
