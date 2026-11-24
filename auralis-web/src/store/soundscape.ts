import { create } from "zustand";
import { getSoundscape, type SoundscapeChannel } from "@/lib/soundscape";

interface SoundscapeState {
  volumes: Record<SoundscapeChannel, number>;
  setVolume: (id: SoundscapeChannel, volume: number) => void;
  toggle: (id: SoundscapeChannel) => void;
  stopAll: () => void;
}

const DEFAULT_VOLUME = 0.35;

export const useSoundscape = create<SoundscapeState>()((set, get) => ({
  volumes: { rain: 0, fire: 0, waves: 0 },
  setVolume: (id, volume) => {
    set({ volumes: { ...get().volumes, [id]: volume } });
    getSoundscape().setVolume(id, volume);
  },
  toggle: (id) => get().setVolume(id, get().volumes[id] > 0 ? 0 : DEFAULT_VOLUME),
  stopAll: () => {
    for (const id of Object.keys(get().volumes) as SoundscapeChannel[]) {
      if (get().volumes[id] > 0) get().setVolume(id, 0);
    }
  },
}));
