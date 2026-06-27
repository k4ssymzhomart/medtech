import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

type Variant = "default" | "best" | "fresh" | "stale" | "outline";

const variants: Record<Variant, string> = {
  default: "bg-surface text-muted border-border",
  best: "bg-accent text-accent-foreground border-accent", // "Лучшая цена"
  fresh: "bg-background text-success border-border",        // freshness: fresh
  stale: "bg-background text-warning border-border",        // freshness: stale
  outline: "bg-background text-foreground border-border",
};

export function Badge({
  className,
  variant = "default",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-[2px] border px-2 py-0.5 text-xs font-medium",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
