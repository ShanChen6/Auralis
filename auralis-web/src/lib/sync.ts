import type { PostTimestamp } from "./types";

/**
 * Đoạn văn đang được đọc tại giây `time`: đoạn cuối cùng có start <= time.
 * Trong khoảng nghỉ giữa hai đoạn vẫn giữ đoạn trước để chữ không nhấp nháy.
 * Trả về -1 khi đang ở phần intro (trước đoạn đầu tiên).
 */
export function findActiveParagraph(timestamps: PostTimestamp[], time: number): number {
  let lo = 0;
  let hi = timestamps.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (timestamps[mid].start <= time) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found === -1 ? -1 : timestamps[found].index;
}

/** Tiến độ 0..1 trong đoạn đang đọc */
export function paragraphProgress(timestamp: PostTimestamp | undefined, time: number): number {
  if (!timestamp) return 0;
  const span = timestamp.end - timestamp.start;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (time - timestamp.start) / span));
}
