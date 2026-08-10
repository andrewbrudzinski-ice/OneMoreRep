/**
 * A tiny inline-SVG sparkline — no chart library, so the dashboard stays off
 * the heavy Recharts bundle. Renders a smoothed-enough polyline of `values`.
 */
export function Sparkline({
  values,
  color = '#22c55e',
  height = 36,
  width = 120,
  strokeWidth = 2,
}: {
  values: number[];
  color?: string;
  height?: number;
  width?: number;
  strokeWidth?: number;
}) {
  const usable = values.filter((v) => Number.isFinite(v));
  if (usable.length < 2) {
    return <div style={{ height }} className="flex items-center text-xs text-slate-600">—</div>;
  }

  const min = Math.min(...usable);
  const max = Math.max(...usable);
  const range = max - min || 1;
  const stepX = width / (values.length - 1);
  const pad = strokeWidth;

  const points = values.map((v, i) => {
    const x = i * stepX;
    const norm = (v - min) / range;
    const y = height - pad - norm * (height - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <polyline
        points={points.join(' ')}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
