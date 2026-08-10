import type { MuscleHeatmapCell } from '../repository/Repository';

/**
 * A stylized front/back body silhouette shaded by this week's per-muscle
 * working volume. Tapping a region selects it. Not anatomically precise —
 * just recognizable enough to answer "am I neglecting X?".
 */

/** Read a space-separated RGB-channel CSS variable, with a fallback. */
function readChannels(name: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = raw.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => !Number.isNaN(n))
    ? (parts as [number, number, number])
    : fallback;
}

function shade(intensity: number, from: [number, number, number]): string {
  const to = [34, 197, 94]; // beat green
  const t = Math.max(0, Math.min(1, intensity));
  const c = from.map((f, i) => Math.round(f + (to[i]! - f) * t));
  return `rgb(${c[0]} ${c[1]} ${c[2]})`;
}

export function MuscleHeatmap({
  cells,
  selectedId,
  onSelect,
}: {
  cells: MuscleHeatmapCell[];
  selectedId: string | null;
  onSelect: (cell: MuscleHeatmapCell) => void;
}) {
  const byId = new Map(cells.map((c) => [c.muscleGroupId, c]));
  const intensity = (id: string) => byId.get(id)?.intensity ?? 0;
  const isSel = (id: string) => selectedId === id;
  // Cold (zero-volume) color follows the theme's slate-800.
  const coldRGB = readChannels('--s-800', [30, 41, 59]);

  const region = (id: string, children: React.ReactNode) => {
    const cell = byId.get(id);
    return (
      <g
        onClick={() => cell && onSelect(cell)}
        style={{ cursor: cell ? 'pointer' : 'default' }}
        fill={shade(intensity(id), coldRGB)}
        className={isSel(id) ? 'stroke-slate-100' : 'stroke-slate-900'}
        strokeWidth={isSel(id) ? 1.5 : 0.75}
      >
        <title>{cell ? `${cell.name}: ${cell.volume}` : id}</title>
        {children}
      </g>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Silhouette label="Front">
        {/* head (outline only) */}
        <circle cx={50} cy={16} r={9} className="fill-slate-800 stroke-slate-900" strokeWidth={0.75} />
        {region(
          'mg-shoulders',
          <>
            <ellipse cx={33} cy={40} rx={8} ry={6} />
            <ellipse cx={67} cy={40} rx={8} ry={6} />
          </>,
        )}
        {region('mg-chest', <rect x={38} y={36} width={24} height={16} rx={4} />)}
        {region(
          'mg-biceps',
          <>
            <rect x={26} y={48} width={7} height={22} rx={3} />
            <rect x={67} y={48} width={7} height={22} rx={3} />
          </>,
        )}
        {region('mg-abs', <rect x={42} y={54} width={16} height={26} rx={3} />)}
        {region(
          'mg-forearms',
          <>
            <rect x={23} y={71} width={7} height={22} rx={3} />
            <rect x={70} y={71} width={7} height={22} rx={3} />
          </>,
        )}
        {region(
          'mg-quads',
          <>
            <rect x={40} y={84} width={9} height={38} rx={4} />
            <rect x={51} y={84} width={9} height={38} rx={4} />
          </>,
        )}
        {region(
          'mg-calves',
          <>
            <rect x={41} y={128} width={8} height={30} rx={3} />
            <rect x={51} y={128} width={8} height={30} rx={3} />
          </>,
        )}
      </Silhouette>

      <Silhouette label="Back">
        <circle cx={50} cy={16} r={9} fill="#1e293b" stroke="#0f172a" strokeWidth={0.75} />
        {region(
          'mg-shoulders',
          <>
            <ellipse cx={33} cy={40} rx={8} ry={6} />
            <ellipse cx={67} cy={40} rx={8} ry={6} />
          </>,
        )}
        {region('mg-back', <rect x={38} y={36} width={24} height={30} rx={4} />)}
        {region(
          'mg-triceps',
          <>
            <rect x={26} y={48} width={7} height={22} rx={3} />
            <rect x={67} y={48} width={7} height={22} rx={3} />
          </>,
        )}
        {region(
          'mg-forearms',
          <>
            <rect x={23} y={71} width={7} height={22} rx={3} />
            <rect x={70} y={71} width={7} height={22} rx={3} />
          </>,
        )}
        {region('mg-glutes', <rect x={40} y={68} width={20} height={16} rx={5} />)}
        {region(
          'mg-hamstrings',
          <>
            <rect x={40} y={86} width={9} height={36} rx={4} />
            <rect x={51} y={86} width={9} height={36} rx={4} />
          </>,
        )}
        {region(
          'mg-calves',
          <>
            <rect x={41} y={128} width={8} height={30} rx={3} />
            <rect x={51} y={128} width={8} height={30} rx={3} />
          </>,
        )}
      </Silhouette>
    </div>
  );
}

function Silhouette({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 165" className="h-56 w-full">
        {children}
      </svg>
      <span className="text-xs text-slate-500">{label}</span>
    </div>
  );
}
