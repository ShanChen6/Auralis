"use client";

import { useEffect } from "react";
import { registerAudioDriver, usePlayer } from "@/store/player";

/**
 * Một thẻ <audio> duy nhất cho cả ứng dụng, gắn ở layout gốc nên không bị
 * hủy khi chuyển trang → âm thanh phát liền mạch.
 */
export function AudioEngine() {
  useEffect(() => {
    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = usePlayer.getState().volume;
    let fadeFrame = 0;

    registerAudioDriver({
      load: (src) => {
        cancelAnimationFrame(fadeFrame);
        audio.src = src;
        audio.load();
      },
      play: () => audio.play(),
      pause: () => audio.pause(),
      seek: (seconds) => {
        audio.currentTime = seconds;
      },
      setVolume: (volume) => {
        audio.volume = volume;
      },
      fadeOut: (ms) =>
        new Promise((resolve) => {
          const from = audio.volume;
          const start = performance.now();
          const step = (now: number) => {
            const progress = Math.min(1, (now - start) / ms);
            audio.volume = from * (1 - progress);
            if (progress < 1) fadeFrame = requestAnimationFrame(step);
            else resolve();
          };
          fadeFrame = requestAnimationFrame(step);
        }),
    });

    const { _sync, _onEnded } = usePlayer.getState();
    const counted = new Set<string>();
    const recordListen = () => {
      const track = usePlayer.getState().current();
      if (!track || counted.has(track.id)) return;
      const threshold = Math.min(30, (audio.duration || 60) / 2);
      if (audio.currentTime < threshold) return;
      counted.add(track.id);
      void fetch(`/backend/posts/${track.id}/listen`, { method: "POST" }).catch(() => counted.delete(track.id));
    };
    const onTime = () => {
      _sync({ currentTime: audio.currentTime });
      recordListen();
    };
    const onMeta = () => Number.isFinite(audio.duration) && _sync({ duration: audio.duration });
    const onPlay = () => _sync({ isPlaying: true });
    const onPause = () => _sync({ isPlaying: false });
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", _onEnded);

    // Media Session: điều khiển từ màn hình khóa / tai nghe
    const session = "mediaSession" in navigator ? navigator.mediaSession : null;
    const unsubscribe = usePlayer.subscribe((state, prev) => {
      const track = state.queue[state.index];
      if (!session || !track || track === prev.queue[prev.index]) return;
      session.metadata = new MediaMetadata({ title: track.title, artist: track.artist, album: "Auralis" });
    });
    if (session) {
      const player = usePlayer.getState;
      session.setActionHandler("play", () => player().play());
      session.setActionHandler("pause", () => player().pause());
      session.setActionHandler("nexttrack", () => player().next());
      session.setActionHandler("previoustrack", () => player().previous());
      session.setActionHandler("seekto", (e) => e.seekTime != null && player().seek(e.seekTime));
    }

    return () => {
      unsubscribe();
      cancelAnimationFrame(fadeFrame);
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", _onEnded);
      registerAudioDriver(null);
    };
  }, []);

  return null;
}
