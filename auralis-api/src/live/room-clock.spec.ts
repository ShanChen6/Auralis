import { TRACK_GAP_MS, nextChangeAt, resolvePlayback } from './room-clock.js';

const tracks = [
  { postId: 'a', duration: 10 },
  { postId: 'b', duration: 20 },
  { postId: 'c', duration: 30 },
];
const T0 = 1_000_000;
const span = (s: number) => s * 1000 + TRACK_GAP_MS;

describe('resolvePlayback', () => {
  it('playlist rỗng → null', () => {
    expect(resolvePlayback([], null, null, T0)).toBeNull();
  });

  it('chưa phát / bài hiện tại không còn trong playlist → bắt đầu bài đầu tiên ngay', () => {
    expect(resolvePlayback(tracks, null, null, T0)).toEqual({
      index: 0,
      startedAt: T0,
    });
    expect(resolvePlayback(tracks, 'x', T0 - 5000, T0)).toEqual({
      index: 0,
      startedAt: T0,
    });
  });

  it('giữ nguyên khi bài hiện tại chưa hết', () => {
    expect(resolvePlayback(tracks, 'b', T0, T0 + 5000)).toEqual({
      index: 1,
      startedAt: T0,
    });
  });

  it('chuyển sang bài kế khi hết bài (kèm khoảng nghỉ)', () => {
    expect(resolvePlayback(tracks, 'a', T0, T0 + span(10) - 1)).toEqual({
      index: 0,
      startedAt: T0,
    });
    expect(resolvePlayback(tracks, 'a', T0, T0 + span(10))).toEqual({
      index: 1,
      startedAt: T0 + span(10),
    });
  });

  it('lặp vòng playlist và bỏ qua nhiều vòng khi phòng vắng lâu', () => {
    const cycle = span(10) + span(20) + span(30);
    expect(resolvePlayback(tracks, 'c', T0, T0 + span(30) + 1000)).toEqual({
      index: 0,
      startedAt: T0 + span(30),
    });
    // 1000 vòng sau, vẫn đúng bài và đúng mốc bắt đầu
    const result = resolvePlayback(
      tracks,
      'a',
      T0,
      T0 + 1000 * cycle + span(10) + 5000,
    );
    expect(result).toEqual({
      index: 1,
      startedAt: T0 + 1000 * cycle + span(10),
    });
  });

  it('nextChangeAt = startedAt + thời lượng + khoảng nghỉ', () => {
    expect(nextChangeAt(tracks[1], T0)).toBe(T0 + span(20));
  });
});
