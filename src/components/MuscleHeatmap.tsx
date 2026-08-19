import type { ReactNode } from 'react';
import Model, { type IExerciseData, type IMuscleStats, type Muscle } from 'react-body-highlighter';
import type { MuscleHeatmapCell } from '../repository/Repository';

/**
 * Anatomical front/back muscle map shaded by this week's per-muscle working
 * volume — dark (untrained) → electric lime (worked hard) — so a glance answers
 * "am I neglecting X?". Uses react-body-highlighter's anatomical muscle
 * polygons; our muscle groups map onto its muscles, and tapping one selects the
 * group (syncs with the ranked list). Same props as before.
 */

// Our muscle-group id → the library's muscle regions.
const GROUP_MUSCLES: Record<string, Muscle[]> = {
  'mg-chest': ['chest'],
  'mg-back': ['trapezius', 'upper-back', 'lower-back'],
  'mg-shoulders': ['front-deltoids', 'back-deltoids'],
  'mg-biceps': ['biceps'],
  'mg-triceps': ['triceps'],
  'mg-forearms': ['forearm'],
  'mg-quads': ['quadriceps'],
  'mg-hamstrings': ['hamstring'],
  'mg-glutes': ['gluteal'],
  'mg-calves': ['calves', 'left-soleus', 'right-soleus'],
  'mg-abs': ['abs', 'obliques'],
};

const MUSCLE_GROUP: Partial<Record<Muscle, string>> = {};
for (const [group, muscles] of Object.entries(GROUP_MUSCLES)) {
  for (const m of muscles) MUSCLE_GROUP[m] = group;
}

const BODY_COLOR = '#2A2F37'; // untrained / body base on the dark ground
const SELECTED_COLOR = '#F2F4F3';
const LEVELS = 5;

function readChannels(name: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = raw.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => !Number.isNaN(n))
    ? (parts as [number, number, number])
    : fallback;
}

function shade(t: number, from: [number, number, number]): string {
  const to = [143, 232, 30]; // #8FE81E accent lime
  const k = Math.max(0, Math.min(1, t));
  const c = from.map((f, i) => Math.round(f + (to[i]! - f) * k));
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
  const cold = readChannels('--s-800', [27, 32, 39]); // surface 2
  // Intensity buckets 1..LEVELS, then a distinct colour for the selected group.
  const highlightedColors = [
    ...Array.from({ length: LEVELS }, (_, i) => shade((i + 1) / LEVELS, cold)),
    SELECTED_COLOR,
  ];

  const byId = new Map(cells.map((c) => [c.muscleGroupId, c]));

  const data: IExerciseData[] = [];
  for (const cell of cells) {
    if (cell.volume <= 0) continue;
    const muscles = GROUP_MUSCLES[cell.muscleGroupId];
    if (!muscles) continue;
    const level =
      selectedId === cell.muscleGroupId
        ? LEVELS + 1
        : Math.max(1, Math.min(LEVELS, Math.ceil(cell.intensity * LEVELS)));
    data.push({ name: cell.name, muscles, frequency: level });
  }

  const handleClick = ({ muscle }: IMuscleStats) => {
    const group = MUSCLE_GROUP[muscle];
    const cell = group ? byId.get(group) : undefined;
    if (cell) onSelect(cell);
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Figure label="Front">
        <Model
          type="anterior"
          data={data}
          bodyColor={BODY_COLOR}
          highlightedColors={highlightedColors}
          onClick={handleClick}
          style={{ height: '15rem' }}
        />
      </Figure>
      <Figure label="Back">
        <Model
          type="posterior"
          data={data}
          bodyColor={BODY_COLOR}
          highlightedColors={highlightedColors}
          onClick={handleClick}
          style={{ height: '15rem' }}
        />
      </Figure>
    </div>
  );
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1">
      {children}
      <span className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink3">
        {label}
      </span>
    </div>
  );
}
