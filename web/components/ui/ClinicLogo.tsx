// Initial-letter placeholder where there is no clinic photo (we do NOT scrape photos).
// On-brand: monochrome surface tile, hairline border, sharp corner, mono initial.
const SIZES = {
  sm: "h-9 w-9 text-sm",
  md: "h-11 w-11 text-lg",
  lg: "h-16 w-16 text-2xl",
} as const;

export function ClinicLogo({
  name,
  size = "md",
  className = "",
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const initial = (name?.trim()?.[0] ?? "?").toUpperCase();
  return (
    <span
      aria-hidden
      className={`inline-flex ${SIZES[size]} shrink-0 select-none items-center justify-center rounded-[2px] border border-border-strong bg-surface font-mono font-semibold text-muted ${className}`}
    >
      {initial}
    </span>
  );
}
