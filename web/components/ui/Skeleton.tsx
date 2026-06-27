import { HTMLAttributes } from "react";
import { cn } from "@/lib/utils/cn";

// Loading placeholder — monochrome, sharp, gentle pulse.
export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-[2px] bg-surface", className)}
      {...props}
    />
  );
}
