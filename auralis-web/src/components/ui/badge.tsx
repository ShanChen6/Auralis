import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  amber: "bg-primary/15 text-primary border-primary/25",
  lavender: "bg-secondary/15 text-secondary border-secondary/25",
  green: "bg-emerald-400/10 text-emerald-300 border-emerald-400/25",
  red: "bg-red-400/10 text-red-300 border-red-400/25",
  muted: "bg-foreground/5 text-muted border-border",
};

export function Badge({ tone = "muted", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs", tones[tone], className)}>
      {children}
    </span>
  );
}
