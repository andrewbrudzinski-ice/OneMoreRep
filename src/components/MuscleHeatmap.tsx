import type { ReactNode } from 'react';
import type { MuscleHeatmapCell } from '../repository/Repository';
import {
  BODY_BACK,
  BODY_FRONT,
  OUTLINE_BACK,
  OUTLINE_FRONT,
  VIEWBOX_BACK,
  VIEWBOX_FRONT,
  type BodyPart,
} from './bodyMuscleData';

/**
 * Anatomical front/back muscle map shaded by this week's per-muscle working
 * volume — resting muscle → electric lime (worked hard) — so a glance answers
 * "am I neglecting X?". Draws a detailed body outline + contoured muscle paths
 * (see bodyMuscleData.ts); tapping a muscle selects that group (syncs with the
 * ranked list). Same props as before.
 */

// The asset's muscle slug → our muscle-group id.
const SLUG_GROUP: Record<string, string> = {
  chest: 'mg-chest',
  'upper-back': 'mg-back',
  'lower-back': 'mg-back',
  trapezius: 'mg-back',
  deltoids: 'mg-shoulders',
  biceps: 'mg-biceps',
  triceps: 'mg-triceps',
  forearm: 'mg-forearms',
  quadriceps: 'mg-quads',
  hamstring: 'mg-hamstrings',
  gluteal: 'mg-glutes',
  calves: 'mg-calves',
  tibialis: 'mg-calves',
  abs: 'mg-abs',
  obliques: 'mg-abs',
};

const SKIN = new Set(['head', 'hair', 'hands', 'feet', 'ankles', 'knees', 'neck']);

const BODY_FILL = '#171C22'; // silhouette base / skin
const MUSCLE_BASE = '#333B45'; // resting muscle tone
const MUSCLE_BASE_RGB: [number, number, number] = [51, 59, 69];
const LIME: [number, number, number] = [143, 232, 30];
const EDGE = '#4A515C'; // body outline
const SEP = '#10151A'; // separation between muscles
const SELECTED = '#F2F4F3';

function shade(t: number): string {
  const k = Math.max(0, Math.min(1, t));
  const c = MUSCLE_BASE_RGB.map((f, i) => Math.round(f + (LIME[i]! - f) * k));
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

  const fillFor = (slug: string): string => {
    if (SKIN.has(slug)) return BODY_FILL;
    const group = SLUG_GROUP[slug];
    if (!group) return MUSCLE_BASE;
    const cell = byId.get(group);
    if (!cell || cell.volume <= 0) return MUSCLE_BASE;
    if (selectedId === group) return SELECTED;
    return shade(cell.intensity);
  };

  const renderParts = (parts: BodyPart[]) =>
    parts.map((part) => {
      const group = SLUG_GROUP[part.slug];
      const cell = group ? byId.get(group) : undefined;
      const ds = [...(part.path.left ?? []), ...(part.path.right ?? []), ...(part.path.common ?? [])];
      return (
        <g
          key={part.slug}
          fill={fillFor(part.slug)}
          stroke={SEP}
          strokeWidth={0.8}
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
          style={{ cursor: cell ? 'pointer' : 'default' }}
          onClick={() => cell && onSelect(cell)}
        >
          {cell && <title>{`${cell.name}: ${cell.volume}`}</title>}
          {ds.map((d, i) => (
            <path key={i} d={d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      );
    });

  return (
    <div className="grid grid-cols-2 gap-1">
      <Figure label="Front" viewBox={VIEWBOX_FRONT}>
        <path d={OUTLINE_FRONT} fill={BODY_FILL} stroke={EDGE} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {renderParts(BODY_FRONT)}
      </Figure>
      <Figure label="Back" viewBox={VIEWBOX_BACK}>
        <path d={OUTLINE_BACK} fill={BODY_FILL} stroke={EDGE} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
        {renderParts(BODY_BACK)}
      </Figure>
    </div>
  );
}

function Figure({
  label,
  viewBox,
  children,
}: {
  label: string;
  viewBox: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={viewBox} preserveAspectRatio="xMidYMid meet" className="h-72 w-full">
        {children}
      </svg>
      <span className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink3">
        {label}
      </span>
    </div>
  );
}
