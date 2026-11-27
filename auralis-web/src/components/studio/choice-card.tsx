import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Thẻ chọn dạng radio */
export function ChoiceCard({
  selected,
  onSelect,
  title,
  description,
  icon,
  className,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex items-start gap-3 rounded-2xl border p-4 text-left transition-all duration-300 ease-calm",
        selected
          ? "border-primary/60 bg-highlight shadow-[0_0_40px_-18px] shadow-primary"
          : "border-border bg-surface/40 hover:border-foreground/20",
        className,
      )}
    >
      {icon && <span className={cn("mt-0.5", selected ? "text-primary" : "text-muted")}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        {description && <span className="mt-1 block text-xs text-muted">{description}</span>}
      </span>
    </button>
  );
}
