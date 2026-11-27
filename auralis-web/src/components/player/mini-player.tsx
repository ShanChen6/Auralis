"use client";

import { ListMusic, Moon, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CoverArt } from "@/components/radio/cover-art";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { formatTime, type MoodTag } from "@/lib/format";
import { cn } from "@/lib/utils";
import { type SleepTimerMinutes, usePlayer } from "@/store/player";

const SLEEP_OPTIONS: SleepTimerMinutes[] = [15, 30, 60];

export function MiniPlayer() {
  const track = usePlayer((s) => s.queue[s.index] ?? null);
  const isPlaying = usePlayer((s) => s.isPlaying);

  return (
    <AnimatePresence>
      {track && (
        <motion.div
          key="mini-player"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 sm:px-6 sm:pb-5"
          role="region"
          aria-label="Trình phát"
        >
          <div className="glass mx-auto flex max-w-6xl items-center gap-3 rounded-3xl p-2.5 pr-3 shadow-2xl sm:gap-5 sm:p-3 sm:pr-5">
            <Link
              href={`/radio/${track.slug}`}
              className="flex min-w-0 flex-1 items-center gap-3 sm:w-64 sm:flex-none"
            >
              <div
                className={cn(
                  "size-12 shrink-0 overflow-hidden rounded-2xl transition-shadow duration-700",
                  isPlaying && "shadow-glow",
                )}
              >
                <CoverArt slug={track.slug} mood={track.moodTag as MoodTag} title={track.title} />
              </div>
              <div className="min-w-0">
                <p className="truncate font-serif text-sm font-medium text-foreground">{track.title}</p>
                <p className="truncate text-xs text-muted">{track.artist}</p>
              </div>
            </Link>

            <Transport />
            <SeekBar className="hidden flex-1 md:flex" />

            <div className="hidden items-center gap-1 sm:flex">
              <VolumeControl />
              <QueuePopover />
              <SleepTimerPopover />
            </div>
          </div>
          <SeekBar className="mx-auto mt-1 flex max-w-6xl px-4 md:hidden" compact />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Transport() {
  const isPlaying = usePlayer((s) => s.isPlaying);
  const hasNext = usePlayer((s) => s.index < s.queue.length - 1);
  const { togglePlay, next, previous } = usePlayer.getState();
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon-sm" onClick={previous} aria-label="Bài trước" className="hidden sm:inline-flex">
        <SkipBack className="size-4" />
      </Button>
      <Button size="icon" onClick={togglePlay} aria-label={isPlaying ? "Tạm dừng" : "Phát"}>
        {isPlaying ? <Pause className="size-5 fill-current" /> : <Play className="size-5 translate-x-px fill-current" />}
      </Button>
      <Button variant="ghost" size="icon-sm" onClick={next} disabled={!hasNext} aria-label="Bài tiếp theo">
        <SkipForward className="size-4" />
      </Button>
    </div>
  );
}

function SeekBar({ className, compact = false }: { className?: string; compact?: boolean }) {
  const currentTime = usePlayer((s) => s.currentTime);
  const duration = usePlayer((s) => s.duration);
  const seek = usePlayer((s) => s.seek);
  const [dragging, setDragging] = useState<number | null>(null);
  const shown = dragging ?? currentTime;

  return (
    <div className={cn("items-center gap-3 text-[11px] tabular-nums text-muted", className)}>
      {!compact && <span className="w-10 text-right">{formatTime(shown)}</span>}
      <Slider
        aria-label="Tua"
        min={0}
        max={duration || 1}
        step={0.1}
        value={[Math.min(shown, duration || 1)]}
        onValueChange={([v]) => setDragging(v)}
        onValueCommit={([v]) => {
          seek(v);
          setDragging(null);
        }}
      />
      {!compact && <span className="w-10">{formatTime(duration)}</span>}
    </div>
  );
}

function VolumeControl() {
  const volume = usePlayer((s) => s.volume);
  const setVolume = usePlayer((s) => s.setVolume);
  const [restore, setRestore] = useState(0.9);
  return (
    <div className="group flex items-center">
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={volume === 0 ? "Bật tiếng" : "Tắt tiếng"}
        onClick={() => {
          if (volume === 0) setVolume(restore || 0.9);
          else {
            setRestore(volume);
            setVolume(0);
          }
        }}
      >
        {volume === 0 ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
      </Button>
      <Slider
        aria-label="Âm lượng"
        className="w-0 opacity-0 transition-all duration-300 group-focus-within:w-20 group-focus-within:opacity-100 group-hover:w-20 group-hover:opacity-100"
        min={0}
        max={1}
        step={0.01}
        value={[volume]}
        onValueChange={([v]) => setVolume(v)}
      />
    </div>
  );
}

function QueuePopover() {
  const queue = usePlayer((s) => s.queue);
  const index = usePlayer((s) => s.index);
  const { jumpTo, removeFromQueue } = usePlayer.getState();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Danh sách chờ">
          <ListMusic className="size-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-80">
        <p className="mb-3 text-xs font-medium uppercase tracking-widest text-muted">Danh sách chờ</p>
        <ol className="max-h-80 space-y-1 overflow-y-auto">
          {queue.map((t, i) => (
            <li
              key={t.id}
              className={cn(
                "group/item flex items-center gap-2 rounded-xl px-2 py-1.5",
                i === index ? "bg-highlight text-primary" : "hover:bg-foreground/5",
              )}
            >
              <button className="min-w-0 flex-1 text-left" onClick={() => jumpTo(i)}>
                <span className="block truncate text-sm">{t.title}</span>
                <span className="block truncate text-xs text-muted">{t.artist}</span>
              </button>
              {i !== index && (
                <button
                  aria-label={`Bỏ ${t.title} khỏi danh sách chờ`}
                  className="text-muted opacity-0 transition-opacity group-hover/item:opacity-100 hover:text-foreground focus-visible:opacity-100"
                  onClick={() => removeFromQueue(t.id)}
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ol>
      </PopoverContent>
    </Popover>
  );
}

function useCountdown(endsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [endsAt]);
  return endsAt ? Math.max(0, Math.round((endsAt - now) / 1000)) : null;
}

function SleepTimerPopover() {
  const endsAt = usePlayer((s) => s.sleepTimerEndsAt);
  const active = usePlayer((s) => s.sleepTimerMinutes);
  const setSleepTimer = usePlayer((s) => s.setSleepTimer);
  const remaining = useCountdown(endsAt);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size={remaining !== null ? "sm" : "icon-sm"}
          aria-label="Hẹn giờ tắt"
          className={cn(remaining !== null && "text-secondary")}
        >
          <Moon className="size-4" />
          {remaining !== null && <span className="tabular-nums">{formatTime(remaining)}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" side="top" className="w-60">
        <p className="mb-1 text-xs font-medium uppercase tracking-widest text-muted">Hẹn giờ tắt</p>
        <p className="mb-3 text-xs text-muted">Âm thanh sẽ nhỏ dần rồi dừng.</p>
        <div className="grid grid-cols-3 gap-2">
          {SLEEP_OPTIONS.map((m) => (
            <Button
              key={m}
              size="sm"
              variant={active === m ? "primary" : "outline"}
              onClick={() => setSleepTimer(m)}
            >
              {m} phút
            </Button>
          ))}
        </div>
        {active && (
          <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => setSleepTimer(null)}>
            Tắt hẹn giờ
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
