// Tiny inline price-trend sparkline (pure SVG, no deps). Renders only with >=2 points,
// so single-point offers show nothing (no clutter). Up = price rose (warning), down = fell.
export function Sparkline({ points, width = 56, height = 16 }: { points: number[]; width?: number; height?: number }) {
  if (!points || points.length < 2) return null;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const rng = max - min || 1;
  const step = width / (points.length - 1);
  const d = points
    .map((p, i) => `${i ? "L" : "M"}${(i * step).toFixed(1)} ${(height - ((p - min) / rng) * height).toFixed(1)}`)
    .join(" ");
  const up = points[points.length - 1] > points[0];
  return (
    <svg width={width} height={height} className={`inline-block align-middle ${up ? "text-warning" : "text-success"}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}
