import type { ButtonHTMLAttributes, ReactNode } from 'react';

/**
 * The shared visual vocabulary for the performance-dashboard UI. Every screen
 * composes from these so the product reads as one system: layered surfaces,
 * subtle borders, controlled radius, restrained elevation, and a strict
 * type hierarchy (heavy tabular display numbers, muted uppercase micro-labels).
 *
 * Surfaces: ground → surface (panel) → surface2 (inset well) → surface3 (raised).
 * Borders:  hairline (internal) → line (panel) → line-strong (emphasis/hover).
 */

/** Small uppercase, letter-spaced micro-label — the system's section voice. */
export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`text-[10px] font-bold uppercase leading-none tracking-[0.15em] text-ink3 ${className}`}
    >
      {children}
    </span>
  );
}

/** A bordered, softly-elevated surface. The primary containment element. */
export function Panel({
  children,
  className = '',
  inset = false,
  feature = false,
  interactive = false,
  onClick,
  ariaLabel,
}: {
  children: ReactNode;
  className?: string;
  /** Recess the panel (nested well) instead of lifting it. */
  inset?: boolean;
  /** Brighter surface + deeper elevation for a hero/feature panel. */
  feature?: boolean;
  /** Hover/press affordance (also renders as a button when onClick is set). */
  interactive?: boolean;
  onClick?: () => void;
  ariaLabel?: string;
}) {
  const surface = inset
    ? 'border-hairline bg-surface2 shadow-well'
    : feature
      ? 'border-line bg-feature shadow-raised'
      : 'border-line bg-surface shadow-panel';
  const inter = interactive
    ? 'transition-[border-color,background-color,transform] duration-150 hover:border-line-strong active:translate-y-px'
    : '';
  const cls = `rounded-panel border ${surface} ${inter} ${className}`;
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-label={ariaLabel} className={`w-full text-left ${cls}`}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}

/** A labelled panel header row: micro-label on the left, optional action right. */
export function PanelHeader({
  label,
  action,
  className = '',
}: {
  label: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex items-center justify-between gap-3 ${className}`}>
      {typeof label === 'string' ? <SectionLabel>{label}</SectionLabel> : label}
      {action}
    </div>
  );
}

/** A small accent-text action, used as a panel-header link ("All", "Log"). */
export function PanelAction({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="-mr-1 inline-flex items-center gap-1 rounded-control px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-accent transition-colors hover:bg-accent-soft"
    >
      {children}
    </button>
  );
}

/** A compact bordered metric — label, big value, optional unit + caption. */
export function MetricTile({
  label,
  value,
  unit,
  caption,
  accent = false,
  className = '',
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  caption?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-tile border border-hairline bg-surface2 px-3.5 py-3 ${className}`}>
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-2 flex items-baseline gap-1">
        <span
          className={`text-[21px] font-extrabold leading-none tracking-[-0.02em] tabular-nums ${accent ? 'text-accent' : 'text-ink'}`}
        >
          {value}
        </span>
        {unit && <span className="text-[11px] font-semibold text-ink3">{unit}</span>}
      </div>
      {caption && <div className="mt-1.5 text-[11px] leading-tight text-ink2">{caption}</div>}
    </div>
  );
}

/** A large hero number with an optional "/ target" and unit suffix. */
export function KpiValue({
  value,
  unit,
  target,
  accent = false,
  size = 'text-[44px]',
  className = '',
}: {
  value: ReactNode;
  unit?: string;
  target?: ReactNode;
  accent?: boolean;
  size?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-baseline gap-2 ${className}`}>
      <span
        className={`${size} font-extrabold leading-[0.9] tracking-[-0.04em] tabular-nums ${accent ? 'text-accent' : 'text-ink'}`}
      >
        {value}
      </span>
      {(unit || target !== undefined) && (
        <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink3">
          {target !== undefined && <>/ {target} </>}
          {unit}
        </span>
      )}
    </div>
  );
}

type BarTone = 'accent' | 'muted' | 'faint';

/** A thin rounded progress track + fill. `p` is the 0→1 animation pass. */
export function ProgressBar({
  ratio,
  p = 1,
  tone = 'accent',
  height = 'h-2',
  className = '',
}: {
  ratio: number;
  p?: number;
  tone?: BarTone;
  height?: string;
  className?: string;
}) {
  const fill = tone === 'accent' ? 'bg-accent' : tone === 'muted' ? 'bg-accent-muted' : 'bg-ink5';
  const w = Math.max(0, Math.min(1, ratio)) * p * 100;
  return (
    <div className={`w-full overflow-hidden rounded-full bg-surface2 ${height} ${className}`}>
      <div className={`h-full rounded-full ${fill}`} style={{ width: `${w.toFixed(1)}%` }} />
    </div>
  );
}

/** Restrained trend badge: up = accent, flat/down = muted ink (never red). */
export function DeltaBadge({
  percent,
  className = '',
}: {
  percent: number;
  className?: string;
}) {
  const up = percent > 0.05;
  const down = percent < -0.05;
  const tone = up ? 'text-accent bg-accent-soft' : 'text-ink2 bg-white/[0.05]';
  const sign = percent > 0 ? '+' : '';
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded-full px-2 py-[3px] text-[11px] font-bold tabular-nums ${tone} ${className}`}
    >
      <TrendCaret up={up} down={down} />
      {sign}
      {percent.toFixed(1)}%
    </span>
  );
}

function TrendCaret({ up, down }: { up: boolean; down: boolean }) {
  if (!up && !down) return <span className="text-[10px]">→</span>;
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.75} strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5" aria-hidden="true">
      {up ? <path d="m6 15 6-6 6 6" /> : <path d="m6 9 6 6 6-6" />}
    </svg>
  );
}

/** A hairline divider. */
export function Divider({ className = '' }: { className?: string }) {
  return <div className={`h-px bg-hairline ${className}`} />;
}

/**
 * Editorial section header for OPEN sections (content sitting on the ground, no
 * panel): an accent tick, an uppercase label, a right-running hairline rule, and
 * an optional trailing action. The signature that ties un-boxed sections
 * together so the layout reads intentional rather than a stack of cards.
 */
export function SectionHeader({
  label,
  action,
  index,
  className = '',
}: {
  label: ReactNode;
  action?: ReactNode;
  /** Optional editorial index, e.g. "01". */
  index?: string;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {index && (
        <span className="shrink-0 text-[10px] font-bold tabular-nums tracking-[0.08em] text-ink4">
          {index}
        </span>
      )}
      <span className="h-3.5 w-[3px] shrink-0 rounded-full bg-accent" aria-hidden />
      <span className="shrink-0 text-[11px] font-bold uppercase tracking-[0.16em] text-ink">
        {label}
      </span>
      <span className="h-px min-w-4 flex-1 bg-hairline" aria-hidden />
      {action}
    </div>
  );
}

/**
 * A radial tick-gauge with centered content — the readiness hero. Reads like a
 * performance instrument: ticks fill in the level color up to the value. `p` is
 * the shared 0→1 animation pass, so the gauge sweeps in tick-by-tick on load.
 */
export function Ring({
  value,
  max = 100,
  size = 124,
  color = '#8FE81E',
  p = 1,
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  color?: string;
  p?: number;
  children?: ReactNode;
}) {
  const ticks = 44;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2 - 2;
  const rInner = rOuter - 9;
  const frac = Math.max(0, Math.min(1, value / max)) * p;
  const lit = Math.round(frac * ticks);
  const marks = [];
  for (let i = 0; i < ticks; i++) {
    const a = ((-90 + (i / ticks) * 360) * Math.PI) / 180;
    marks.push(
      <line
        key={i}
        x1={cx + rInner * Math.cos(a)}
        y1={cy + rInner * Math.sin(a)}
        x2={cx + rOuter * Math.cos(a)}
        y2={cy + rOuter * Math.sin(a)}
        stroke={i < lit ? color : '#2B333D'}
        strokeWidth={2.4}
        strokeLinecap="round"
      />,
    );
  }
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={cx} cy={cy} r={rInner - 3} fill="#10141A" />
        {marks}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{children}</div>
    </div>
  );
}

/**
 * The primary call-to-action — a raised dark control with a lime action chip,
 * so the accent reads as "go / status" rather than a generic green slab.
 */
export function PrimaryAction({
  label,
  onClick,
  className = '',
}: {
  label: ReactNode;
  onClick?: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex w-full items-center justify-between gap-3 rounded-control border border-line-strong bg-surface3 py-2.5 pl-4 pr-2.5 transition-[border-color,background-color] duration-150 hover:border-accent active:translate-y-px ${className}`}
    >
      <span className="text-[13px] font-extrabold uppercase tracking-[0.07em] text-ink">{label}</span>
      <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-accent text-on-accent transition-transform duration-150 group-hover:translate-x-0.5">
        <ArrowRight className="h-4 w-4" />
      </span>
    </button>
  );
}

/** The primary call-to-action button — solid lime, powerful but not garish. */
export function CtaButton({
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control bg-accent px-4 py-3 text-[13px] font-extrabold uppercase tracking-[0.06em] text-on-accent transition-[background-color,transform] duration-150 hover:bg-accent-hover active:translate-y-px active:bg-accent-press disabled:opacity-40 ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Right chevron used across list rows / drill-ins. */
export function ChevronRight({ className = 'h-[18px] w-[18px] text-ink4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Right arrow used in primary CTAs. */
export function ArrowRight({ className = 'h-[22px] w-[22px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </svg>
  );
}
