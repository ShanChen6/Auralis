import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { type AudioDriver, type Track, registerAudioDriver, usePlayer } from "./player";

const track = (id: string, duration = 60): Track => ({
  id,
  slug: id,
  title: `Bài ${id}`,
  artist: "Auralis",
  audioUrl: `/demo/${id}.mp3`,
  duration,
  moodTag: "CALM",
});

function fakeDriver() {
  return {
    load: vi.fn(),
    play: vi.fn(() => Promise.resolve()),
    pause: vi.fn(),
    seek: vi.fn(),
    setVolume: vi.fn(),
    fadeOut: vi.fn(() => Promise.resolve()),
  } satisfies AudioDriver;
}

const initial = usePlayer.getState();
let driver: ReturnType<typeof fakeDriver>;

beforeEach(() => {
  usePlayer.setState(initial, true);
  driver = fakeDriver();
  registerAudioDriver(driver);
});

afterEach(() => {
  usePlayer.getState().setSleepTimer(null);
  vi.useRealTimers();
});

describe("player store", () => {
  it("playTrack với queue thay hàng chờ và phát đúng bài", () => {
    const [a, b, c] = [track("a"), track("b"), track("c")];
    usePlayer.getState().playTrack(b, [a, b, c]);

    const s = usePlayer.getState();
    expect(s.queue.map((t) => t.id)).toEqual(["a", "b", "c"]);
    expect(s.index).toBe(1);
    expect(s.isPlaying).toBe(true);
    expect(driver.load).toHaveBeenCalledWith("/demo/b.mp3");
    expect(driver.play).toHaveBeenCalled();
  });

  it("playTrack không có queue thì thêm vào cuối hàng chờ", () => {
    usePlayer.getState().playTrack(track("a"), [track("a"), track("b")]);
    usePlayer.getState().playTrack(track("x"));
    expect(usePlayer.getState().queue.map((t) => t.id)).toEqual(["a", "b", "x"]);
    expect(usePlayer.getState().current()?.id).toBe("x");
  });

  it("bấm phát lại bài đang dừng thì chỉ tiếp tục, không tải lại", () => {
    usePlayer.getState().playTrack(track("a"));
    usePlayer.getState().pause();
    driver.load.mockClear();
    usePlayer.getState().playTrack(track("a"));
    expect(driver.load).not.toHaveBeenCalled();
    expect(usePlayer.getState().isPlaying).toBe(true);
  });

  it("next/previous và tự chuyển bài khi hết", () => {
    const player = usePlayer.getState();
    player.playTrack(track("a"), [track("a"), track("b")]);
    player.next();
    expect(usePlayer.getState().index).toBe(1);
    player.next(); // đã ở cuối
    expect(usePlayer.getState().index).toBe(1);

    player.previous(); // currentTime = 0 → về bài trước
    expect(usePlayer.getState().index).toBe(0);

    usePlayer.setState({ currentTime: 10 });
    player.previous(); // đã nghe > 3s → về đầu bài
    expect(usePlayer.getState().index).toBe(0);
    expect(driver.seek).toHaveBeenLastCalledWith(0);

    player._onEnded();
    expect(usePlayer.getState().index).toBe(1);
    player._onEnded();
    expect(usePlayer.getState().isPlaying).toBe(false);
  });

  it("seek kẹp trong thời lượng bài", () => {
    usePlayer.getState().playTrack(track("a", 60));
    usePlayer.getState().seek(120);
    expect(driver.seek).toHaveBeenLastCalledWith(60);
    usePlayer.getState().seek(-5);
    expect(driver.seek).toHaveBeenLastCalledWith(0);
  });

  it("enqueue bỏ trùng; removeFromQueue không xóa bài đang phát và giữ đúng index", () => {
    const player = usePlayer.getState();
    player.playTrack(track("b"), [track("a"), track("b"), track("c")]);
    player.enqueue(track("c"));
    player.enqueue(track("d"));
    expect(usePlayer.getState().queue.map((t) => t.id)).toEqual(["a", "b", "c", "d"]);

    player.removeFromQueue("b");
    expect(usePlayer.getState().queue).toHaveLength(4);

    player.removeFromQueue("a");
    expect(usePlayer.getState().queue.map((t) => t.id)).toEqual(["b", "c", "d"]);
    expect(usePlayer.getState().current()?.id).toBe("b");
  });

  it("hẹn giờ tắt: hạ nhỏ dần rồi dừng sau đúng số phút", async () => {
    vi.useFakeTimers();
    usePlayer.getState().playTrack(track("a"));
    usePlayer.getState().setSleepTimer(15);
    expect(usePlayer.getState().sleepTimerMinutes).toBe(15);

    await vi.advanceTimersByTimeAsync(15 * 60_000 - 1);
    expect(driver.fadeOut).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(driver.fadeOut).toHaveBeenCalled();
    expect(driver.pause).toHaveBeenCalled();
    expect(driver.setVolume).toHaveBeenLastCalledWith(0.9); // khôi phục âm lượng cho lần nghe sau
    expect(usePlayer.getState()).toMatchObject({
      isPlaying: false,
      sleepTimerMinutes: null,
      sleepTimerEndsAt: null,
    });
  });

  it("đặt lại hoặc tắt hẹn giờ thì hủy hẹn giờ cũ", async () => {
    vi.useFakeTimers();
    usePlayer.getState().playTrack(track("a"));
    usePlayer.getState().setSleepTimer(15);
    usePlayer.getState().setSleepTimer(60);
    await vi.advanceTimersByTimeAsync(15 * 60_000);
    expect(driver.pause).not.toHaveBeenCalled();

    usePlayer.getState().setSleepTimer(null);
    await vi.advanceTimersByTimeAsync(60 * 60_000);
    expect(driver.pause).not.toHaveBeenCalled();
    expect(usePlayer.getState().isPlaying).toBe(true);
  });
});
