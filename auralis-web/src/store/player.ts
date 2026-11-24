import { create } from "zustand";

export interface Track {
  id: string;
  slug: string;
  title: string;
  artist: string;
  audioUrl: string;
  duration: number | null;
  moodTag: string;
}

export type SleepTimerMinutes = 15 | 30 | 60;

/** Lớp mỏng bọc thẻ <audio>: tách ra để store test được không cần trình duyệt thật. */
export interface AudioDriver {
  load(src: string): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  fadeOut(ms: number): Promise<void>;
}

interface PlayerState {
  queue: Track[];
  index: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  sleepTimerEndsAt: number | null;
  sleepTimerMinutes: SleepTimerMinutes | null;

  current: () => Track | null;
  /** Phát một track; nếu truyền queue thì thay hàng chờ (VD: "Phát trọn số này" từ carousel) */
  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  play: () => void;
  pause: () => void;
  next: () => void;
  previous: () => void;
  seek: (seconds: number) => void;
  setVolume: (volume: number) => void;
  enqueue: (track: Track) => void;
  removeFromQueue: (id: string) => void;
  jumpTo: (index: number) => void;
  setSleepTimer: (minutes: SleepTimerMinutes | null) => void;

  /** Được AudioEngine gọi khi thẻ <audio> phát sự kiện */
  _sync: (patch: Partial<Pick<PlayerState, "isPlaying" | "currentTime" | "duration">>) => void;
  _onEnded: () => void;
}

let driver: AudioDriver | null = null;
let sleepTimeout: ReturnType<typeof setTimeout> | null = null;

export function registerAudioDriver(next: AudioDriver | null) {
  driver = next;
}

const SLEEP_FADE_MS = 8_000;

export const usePlayer = create<PlayerState>()((set, get) => {
  const loadAndPlay = (index: number) => {
    const track = get().queue[index];
    if (!track) return;
    set({ index, currentTime: 0, duration: track.duration ?? 0, isPlaying: true });
    driver?.load(track.audioUrl);
    driver?.play().catch(() => set({ isPlaying: false }));
  };

  return {
    queue: [],
    index: -1,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: 0.9,
    sleepTimerEndsAt: null,
    sleepTimerMinutes: null,

    current: () => get().queue[get().index] ?? null,

    playTrack: (track, queue) => {
      const state = get();
      if (state.current()?.id === track.id) {
        if (!state.isPlaying) get().play();
        return;
      }
      const nextQueue = queue ?? [...state.queue.filter((t) => t.id !== track.id), track];
      set({ queue: nextQueue });
      loadAndPlay(nextQueue.findIndex((t) => t.id === track.id));
    },

    togglePlay: () => (get().isPlaying ? get().pause() : get().play()),

    play: () => {
      if (!get().current()) return;
      set({ isPlaying: true });
      driver?.play().catch(() => set({ isPlaying: false }));
    },

    pause: () => {
      set({ isPlaying: false });
      driver?.pause();
    },

    next: () => {
      const { index, queue } = get();
      if (index < queue.length - 1) loadAndPlay(index + 1);
    },

    previous: () => {
      const { index, currentTime } = get();
      // Giống các trình phát quen thuộc: đã nghe > 3s thì quay về đầu bài
      if (currentTime > 3 || index <= 0) {
        get().seek(0);
        return;
      }
      loadAndPlay(index - 1);
    },

    seek: (seconds) => {
      const clamped = Math.max(0, get().duration ? Math.min(seconds, get().duration) : seconds);
      set({ currentTime: clamped });
      driver?.seek(clamped);
    },

    setVolume: (volume) => {
      const v = Math.min(1, Math.max(0, volume));
      set({ volume: v });
      driver?.setVolume(v);
    },

    enqueue: (track) => {
      if (get().queue.some((t) => t.id === track.id)) return;
      set({ queue: [...get().queue, track] });
    },

    removeFromQueue: (id) => {
      const { queue, index } = get();
      const removeAt = queue.findIndex((t) => t.id === id);
      if (removeAt === -1 || removeAt === index) return; // không xóa bài đang phát
      set({ queue: queue.filter((t) => t.id !== id), index: removeAt < index ? index - 1 : index });
    },

    jumpTo: (index) => loadAndPlay(index),

    setSleepTimer: (minutes) => {
      if (sleepTimeout) clearTimeout(sleepTimeout);
      sleepTimeout = null;
      if (minutes === null) {
        set({ sleepTimerEndsAt: null, sleepTimerMinutes: null });
        return;
      }
      const ms = minutes * 60_000;
      set({ sleepTimerEndsAt: Date.now() + ms, sleepTimerMinutes: minutes });
      sleepTimeout = setTimeout(async () => {
        // Hạ nhỏ dần rồi tắt, để không giật mình khi đang ngủ
        await driver?.fadeOut(SLEEP_FADE_MS);
        get().pause();
        driver?.setVolume(get().volume);
        set({ sleepTimerEndsAt: null, sleepTimerMinutes: null });
        sleepTimeout = null;
      }, ms);
    },

    _sync: (patch) => set(patch),

    _onEnded: () => {
      const { index, queue } = get();
      if (index < queue.length - 1) loadAndPlay(index + 1);
      else set({ isPlaying: false, currentTime: get().duration });
    },
  };
});
