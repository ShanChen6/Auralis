export interface ClockTrack {
  postId: string;
  /** giây */
  duration: number;
}

export interface Playback {
  index: number;
  /** epoch ms – thời điểm bài hiện tại bắt đầu phát */
  startedAt: number;
}

/** Khoảng nghỉ giữa hai số Radio trong phòng */
export const TRACK_GAP_MS = 2000;

/**
 * Đồng hồ phòng nghe: từ bài đang phát + thời điểm bắt đầu, tính bài phải phát ở `now`
 * (playlist lặp vòng). Không cần tiến trình chạy liên tục: ai vào phòng cũng tính ra
 * cùng một kết quả.
 */
export function resolvePlayback(
  tracks: ClockTrack[],
  currentPostId: string | null,
  startedAt: number | null,
  now: number,
  gapMs = TRACK_GAP_MS,
): Playback | null {
  if (tracks.length === 0) return null;
  let index = currentPostId
    ? tracks.findIndex((t) => t.postId === currentPostId)
    : -1;
  if (index === -1 || startedAt === null || startedAt > now) {
    return { index: 0, startedAt: now };
  }

  const span = (i: number) => Math.max(tracks[i].duration, 1) * 1000 + gapMs;
  let start = startedAt;
  let elapsed = now - start;

  // Bỏ qua nguyên các vòng playlist khi phòng vắng lâu
  const cycle = tracks.reduce((sum, _, i) => sum + span(i), 0);
  if (elapsed >= cycle + span(index)) {
    const skipped = Math.floor((elapsed - span(index)) / cycle) * cycle;
    start += skipped;
    elapsed -= skipped;
  }
  while (elapsed >= span(index)) {
    start += span(index);
    elapsed -= span(index);
    index = (index + 1) % tracks.length;
  }
  return { index, startedAt: start };
}

/** Thời điểm (epoch ms) phải chuyển sang bài tiếp theo */
export function nextChangeAt(
  track: ClockTrack,
  startedAt: number,
  gapMs = TRACK_GAP_MS,
): number {
  return startedAt + Math.max(track.duration, 1) * 1000 + gapMs;
}
