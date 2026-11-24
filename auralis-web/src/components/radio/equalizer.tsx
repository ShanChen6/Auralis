import { cn } from "@/lib/utils";

/** 3 vạch nhấp nhô báo "đang phát" */
export function Equalizer({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <span className={cn("inline-flex h-3.5 items-end gap-[3px]", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-primary"
          style={{
            height: playing ? undefined : "35%",
            animation: playing ? `auralis-eq 0.9s ${i * 0.15}s ease-in-out infinite alternate` : undefined,
          }}
        />
      ))}
      <style>{`@keyframes auralis-eq{from{height:25%}to{height:100%}}`}</style>
    </span>
  );
}
