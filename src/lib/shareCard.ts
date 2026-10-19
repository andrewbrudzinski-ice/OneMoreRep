/**
 * Generates a shareable workout summary card as a PNG blob using the
 * Canvas 2D API. No external dependencies — pure browser APIs only.
 *
 * Card size: 1080×1350 px (4:5 ratio — fits Instagram, X, etc.).
 */

export interface ShareCardParams {
  workoutName: string;
  /** "Monday, October 14" */
  dateLabel: string;
  /** "1h 12m" */
  duration: string;
  sets: number;
  volume: number;
  unit: string;
  /** Up to 5 exercises, best working set each. */
  exercises: { name: string; setLabel: string }[];
  /** New PRs earned this session. */
  prs: { typeLabel: string; valueLabel: string }[];
  /** One-line motivational recap text. */
  recap: string;
}

// ---------------------------------------------------------------------------
// Colors
// ---------------------------------------------------------------------------
const BG = '#0E0E0E';
const BG2 = '#1A1A1A';
const ACCENT = '#8FE81E';
const BEAT = '#4ADE80';
const INK = '#F5F5F5';
const INK2 = '#AAAAAA';
const INK3 = '#666666';
const LINE = '#2A2A2A';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function px(n: number) { return Math.round(n); }

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number, y: number,
  { size = 28, weight = '600', color = INK2, align = 'left' as CanvasTextAlign } = {},
) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillText(text, x, y);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Main draw
// ---------------------------------------------------------------------------
export async function generateWorkoutCard(params: ShareCardParams): Promise<Blob> {
  const W = 1080;
  const H = 1350;
  const PAD = 72;
  const INNER = W - PAD * 2;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // ── Background ──────────────────────────────────────────────────────────
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Subtle top gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 400);
  grad.addColorStop(0, 'rgba(142,232,30,0.07)');
  grad.addColorStop(1, 'rgba(142,232,30,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  let y = 88;

  // ── Brand row ────────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = ACCENT;
  ctx.font = `800 38px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('ONEMOREREP', PAD, y);
  ctx.restore();

  label(ctx, params.dateLabel, W - PAD, y + 6, { size: 26, color: INK3, align: 'right' });

  y += 72;

  // ── Workout name ─────────────────────────────────────────────────────────
  ctx.save();
  ctx.fillStyle = INK;
  ctx.font = `800 68px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  // Truncate long names
  let name = params.workoutName;
  while (ctx.measureText(name).width > INNER && name.length > 10) {
    name = name.slice(0, -1);
  }
  if (name !== params.workoutName) name += '…';
  ctx.fillText(name, PAD, y);
  ctx.restore();

  y += 100;

  // ── Divider ───────────────────────────────────────────────────────────────
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();

  y += 56;

  // ── Stats row ─────────────────────────────────────────────────────────────
  const statW = INNER / 3;
  const stats = [
    { value: params.duration, lbl: 'Duration' },
    { value: String(params.sets), lbl: 'Sets' },
    { value: params.volume.toLocaleString(), lbl: `Vol (${params.unit})` },
  ];
  stats.forEach(({ value, lbl }, i) => {
    const sx = PAD + i * statW;
    ctx.save();
    ctx.fillStyle = INK;
    ctx.font = `800 58px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(value, px(sx), y);
    ctx.restore();
    label(ctx, lbl, px(sx), y + 70, { size: 24, color: INK3 });
  });

  y += 132;

  // ── Divider ───────────────────────────────────────────────────────────────
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();

  y += 52;

  // ── Exercises ─────────────────────────────────────────────────────────────
  label(ctx, 'EXERCISES', PAD, y, { size: 22, weight: '700', color: INK3 });
  y += 46;

  for (const ex of params.exercises.slice(0, 5)) {
    label(ctx, ex.name, PAD, y, { size: 32, weight: '600', color: INK });
    label(ctx, ex.setLabel, W - PAD, y + 4, { size: 28, weight: '700', color: INK2, align: 'right' });
    y += 58;
  }

  y += 20;

  // ── PRs ───────────────────────────────────────────────────────────────────
  if (params.prs.length > 0) {
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(PAD, y);
    ctx.lineTo(W - PAD, y);
    ctx.stroke();
    y += 48;

    label(ctx, 'NEW PRs', PAD, y, { size: 22, weight: '700', color: INK3 });
    y += 46;

    for (const pr of params.prs.slice(0, 3)) {
      // PR pill
      ctx.save();
      roundRect(ctx, PAD, y - 4, INNER, 52, 10);
      ctx.fillStyle = 'rgba(142,232,30,0.08)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(142,232,30,0.22)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();

      label(ctx, pr.typeLabel, PAD + 20, y + 8, { size: 26, weight: '600', color: ACCENT });
      label(ctx, pr.valueLabel, W - PAD - 20, y + 8, { size: 26, weight: '800', color: BEAT, align: 'right' });
      y += 66;
    }
  }

  // ── Recap ─────────────────────────────────────────────────────────────────
  // Place at fixed position near bottom
  const recapY = H - 130;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PAD, recapY - 32);
  ctx.lineTo(W - PAD, recapY - 32);
  ctx.stroke();

  ctx.save();
  ctx.fillStyle = INK2;
  ctx.font = `italic 500 30px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  // Wrap to ~900px wide
  const words = params.recap.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > INNER - 40) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  lines.slice(0, 2).forEach((l, i) => ctx.fillText(l, W / 2, recapY + i * 42));
  ctx.restore();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png');
  });
}

// ---------------------------------------------------------------------------
// Share / download
// ---------------------------------------------------------------------------
export async function shareOrDownloadCard(blob: Blob, filename: string): Promise<void> {
  const file = new File([blob], filename, { type: 'image/png' });
  if (
    typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [file] })
  ) {
    await navigator.share({ files: [file], title: filename });
    return;
  }
  // Fallback: trigger a download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
