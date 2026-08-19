import type { ReactNode } from 'react';
import type { MuscleHeatmapCell } from '../repository/Repository';

/**
 * Anatomical front/back body map shaded by this week's per-muscle working
 * volume — dark (untrained) → electric lime (worked hard) — so a glance answers
 * "am I neglecting X?". Muscle groups are drawn as contoured shapes over a
 * neutral body silhouette; tapping one selects it (syncs with the ranked list).
 */

const BODY = '#2A2F37'; // neutral "body" base beneath the muscles
const OUTLINE = '#0D1014'; // separation between muscle shapes (page ground)

function readChannels(name: string, fallback: [number, number, number]): [number, number, number] {
  if (typeof window === 'undefined') return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const parts = raw.split(/\s+/).map(Number);
  return parts.length === 3 && parts.every((n) => !Number.isNaN(n))
    ? (parts as [number, number, number])
    : fallback;
}

function shade(intensity: number, from: [number, number, number]): string {
  const to = [143, 232, 30]; // #8FE81E accent lime
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
  const cold = readChannels('--s-800', [27, 32, 39]); // surface 2

  const Region = ({ id, children }: { id: string; children: ReactNode }) => {
    const cell = byId.get(id);
    const selected = selectedId === id;
    return (
      <g
        onClick={() => cell && onSelect(cell)}
        style={{ cursor: cell ? 'pointer' : 'default' }}
        fill={shade(byId.get(id)?.intensity ?? 0, cold)}
        stroke={selected ? '#F2F4F3' : OUTLINE}
        strokeWidth={selected ? 1.4 : 0.7}
        strokeLinejoin="round"
      >
        <title>{cell ? `${cell.name}: ${cell.volume}` : id}</title>
        {children}
      </g>
    );
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <Figure label="Front">
        <FrontBody />
        <Region id="mg-shoulders">
          <path d="M22 41 C26 36 33 36 37 41 C38 46 35 51 30 51 C25 51 21 47 22 41 Z" />
          <path d="M78 41 C74 36 67 36 63 41 C62 46 65 51 70 51 C75 51 79 47 78 41 Z" />
        </Region>
        <Region id="mg-chest">
          <path d="M49 45 C44 44 38 45 36 50 C35 55 39 60 45 61 C48 61 49 58 49 54 Z" />
          <path d="M51 45 C56 44 62 45 64 50 C65 55 61 60 55 61 C52 61 51 58 51 54 Z" />
        </Region>
        <Region id="mg-biceps">
          <path d="M31 53 C27 55 25 61 26 69 C27 75 31 76 34 72 C36 65 35 57 33 53 Z" />
          <path d="M69 53 C73 55 75 61 74 69 C73 75 69 76 66 72 C64 65 65 57 67 53 Z" />
        </Region>
        <Region id="mg-abs">
          <path d="M43 61 C41 66 41 84 44 94 C47 97 53 97 56 94 C59 84 59 66 57 61 C52 59 48 59 43 61 Z" />
          {/* six-pack + midline detail */}
          <path
            d="M50 62 L50 93 M44 71 L56 71 M44 79 L56 79 M44 87 L56 87"
            fill="none"
            stroke={OUTLINE}
            strokeWidth={0.6}
          />
        </Region>
        <Region id="mg-forearms">
          <path d="M26 74 C23 79 22 88 25 97 C27 101 31 100 32 94 C33 85 31 78 30 74 Z" />
          <path d="M74 74 C77 79 78 88 75 97 C73 101 69 100 68 94 C67 85 69 78 70 74 Z" />
        </Region>
        <Region id="mg-quads">
          <path d="M40 100 C35 106 35 128 40 146 C43 152 48 151 49 145 C50 127 49 108 46 101 C44 99 42 99 40 100 Z" />
          <path d="M60 100 C65 106 65 128 60 146 C57 152 52 151 51 145 C50 127 51 108 54 101 C56 99 58 99 60 100 Z" />
        </Region>
        <Region id="mg-calves">
          <path d="M42 152 C39 158 39 174 43 184 C45 187 47 186 47 181 C48 170 46 159 45 153 Z" />
          <path d="M58 152 C61 158 61 174 57 184 C55 187 53 186 53 181 C52 170 54 159 55 153 Z" />
        </Region>
      </Figure>

      <Figure label="Back">
        <BackBody />
        <Region id="mg-shoulders">
          <path d="M22 41 C26 36 33 36 37 41 C38 46 35 51 30 51 C25 51 21 47 22 41 Z" />
          <path d="M78 41 C74 36 67 36 63 41 C62 46 65 51 70 51 C75 51 79 47 78 41 Z" />
        </Region>
        <Region id="mg-back">
          {/* trapezius */}
          <path d="M43 37 C46 35 54 35 57 37 C56 45 59 52 53 57 C51 59 49 59 47 57 C41 52 44 45 43 37 Z" />
          {/* lats */}
          <path d="M46 57 C42 60 37 70 41 85 C44 90 48 88 49 81 C50 71 49 62 48 57 Z" />
          <path d="M54 57 C58 60 63 70 59 85 C56 90 52 88 51 81 C50 71 51 62 52 57 Z" />
        </Region>
        <Region id="mg-triceps">
          <path d="M31 53 C27 55 25 61 26 69 C27 75 31 76 34 72 C36 65 35 57 33 53 Z" />
          <path d="M69 53 C73 55 75 61 74 69 C73 75 69 76 66 72 C64 65 65 57 67 53 Z" />
        </Region>
        <Region id="mg-forearms">
          <path d="M26 74 C23 79 22 88 25 97 C27 101 31 100 32 94 C33 85 31 78 30 74 Z" />
          <path d="M74 74 C77 79 78 88 75 97 C73 101 69 100 68 94 C67 85 69 78 70 74 Z" />
        </Region>
        <Region id="mg-glutes">
          <path d="M49 90 C44 90 39 95 40 103 C41 110 47 112 49 106 C50 101 50 94 49 90 Z" />
          <path d="M51 90 C56 90 61 95 60 103 C59 110 53 112 51 106 C50 101 50 94 51 90 Z" />
        </Region>
        <Region id="mg-hamstrings">
          <path d="M40 112 C36 118 37 136 41 150 C44 155 48 154 49 148 C50 132 49 118 46 113 C44 111 42 111 40 112 Z" />
          <path d="M60 112 C64 118 63 136 59 150 C56 155 52 154 51 148 C50 132 51 118 54 113 C56 111 58 111 60 112 Z" />
        </Region>
        <Region id="mg-calves">
          <path d="M41 153 C38 159 39 174 43 184 C45 187 47 186 47 181 C48 169 46 159 45 154 Z" />
          <path d="M59 153 C62 159 61 174 57 184 C55 187 53 186 53 181 C52 169 54 159 55 154 Z" />
        </Region>
      </Figure>
    </div>
  );
}

/* Neutral body silhouette layers (drawn under the muscle groups). */
function FrontBody() {
  return (
    <g fill={BODY} stroke={OUTLINE} strokeWidth={0.6} strokeLinejoin="round">
      <circle cx={50} cy={17} r={8.5} />
      <path d="M46 24 C46 28 46 31 47 34 L53 34 C54 31 54 28 54 24 Z" />
      {/* torso */}
      <path d="M34 40 C40 37 60 37 66 40 C66 60 64 92 62 100 C54 103 46 103 38 100 C36 92 34 60 34 40 Z" />
      {/* arms */}
      <path d="M34 41 C28 43 23 52 24 72 C24 88 25 96 27 99 C30 100 32 99 32 96 C30 78 32 58 37 48 Z" />
      <path d="M66 41 C72 43 77 52 76 72 C76 88 75 96 73 99 C70 100 68 99 68 96 C70 78 68 58 63 48 Z" />
      {/* hands */}
      <ellipse cx={27} cy={102} rx={3.5} ry={5} />
      <ellipse cx={73} cy={102} rx={3.5} ry={5} />
      {/* pelvis + legs */}
      <path d="M38 98 C46 101 54 101 62 98 C63 106 63 112 61 116 L39 116 C37 112 37 106 38 98 Z" />
      <path d="M39 112 C36 130 37 150 41 186 C42 190 47 190 48 186 C51 150 50 130 49 112 Z" />
      <path d="M61 112 C64 130 63 150 59 186 C58 190 53 190 52 186 C49 150 50 130 51 112 Z" />
      {/* feet */}
      <path d="M41 186 C40 191 40 194 45 194 L48 194 L48 187 Z" />
      <path d="M59 186 C60 191 60 194 55 194 L52 194 L52 187 Z" />
    </g>
  );
}

function BackBody() {
  return <FrontBody />;
}

function Figure({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 100 200" className="h-64 w-full">
        {children}
      </svg>
      <span className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-ink3">
        {label}
      </span>
    </div>
  );
}
