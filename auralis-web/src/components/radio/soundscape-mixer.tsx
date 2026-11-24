"use client";

import { CloudRain, Flame, Waves } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { SOUNDSCAPE_CHANNELS, type SoundscapeChannel } from "@/lib/soundscape";
import { cn } from "@/lib/utils";
import { useSoundscape } from "@/store/soundscape";

const ICONS: Record<SoundscapeChannel, typeof CloudRain> = { rain: CloudRain, fire: Flame, waves: Waves };

export function SoundscapeMixer({ className }: { className?: string }) {
  const volumes = useSoundscape((s) => s.volumes);
  const { setVolume, toggle, stopAll } = useSoundscape.getState();
  const anyOn = Object.values(volumes).some((v) => v > 0);

  return (
    <section className={cn("glass rounded-3xl p-5", className)} aria-labelledby="soundscape-title">
      <div className="flex items-baseline justify-between">
        <h2 id="soundscape-title" className="text-xs font-medium uppercase tracking-[0.2em] text-secondary">
          Âm thanh môi trường
        </h2>
        {anyOn && (
          <button className="text-xs text-muted hover:text-foreground" onClick={stopAll}>
            Tắt tất cả
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-muted">Trộn thêm không gian, chạy song song với số Radio.</p>
      <ul className="mt-4 space-y-3">
        {SOUNDSCAPE_CHANNELS.map(({ id, label }) => {
          const Icon = ICONS[id];
          const on = volumes[id] > 0;
          return (
            <li key={id} className="flex items-center gap-3">
              <button
                onClick={() => toggle(id)}
                aria-pressed={on}
                aria-label={on ? `Tắt ${label}` : `Bật ${label}`}
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl border transition-all duration-500",
                  on
                    ? "border-secondary/40 bg-secondary/15 text-secondary shadow-[0_0_30px_-8px] shadow-secondary"
                    : "border-border text-muted hover:text-foreground",
                )}
              >
                <Icon className="size-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm", on ? "text-foreground" : "text-muted")}>{label}</p>
                <Slider
                  aria-label={`Âm lượng ${label}`}
                  className="mt-2"
                  min={0}
                  max={1}
                  step={0.01}
                  value={[volumes[id]]}
                  onValueChange={([v]) => setVolume(id, v)}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
