import { describe, expect, it } from "vitest";
import { estimateClockOffset, livePosition } from "./live";

describe("đồng bộ phòng nghe", () => {
  it("ước lượng lệch đồng hồ có bù nửa độ trễ khứ hồi", () => {
    // Máy khách chậm hơn máy chủ 5s, RTT 200ms
    const sentAt = 10_000;
    const receivedAt = 10_200;
    const serverTime = 15_100; // máy chủ trả lời ở giữa chuyến đi
    expect(estimateClockOffset(sentAt, receivedAt, serverTime)).toBe(5_000);
  });

  it("vị trí phát theo đồng hồ máy chủ, không âm", () => {
    expect(livePosition(100_000, 5_000, 107_500)).toBe(12.5);
    expect(livePosition(100_000, 0, 90_000)).toBe(0);
  });
});
