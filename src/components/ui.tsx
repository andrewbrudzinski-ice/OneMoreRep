import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<Variant, string> = {
  primary:
    'bg-accent text-on-accent hover:bg-accent-hover active:translate-y-px active:bg-accent-press font-extrabold',
  secondary: 'border border-line bg-surface3 text-ink hover:border-line-strong active:translate-y-px',
  ghost: 'text-ink2 hover:bg-white/[0.05] hover:text-ink',
  danger: 'text-fatigued hover:bg-fatigued/10',
};

export function Button({
  variant = 'secondary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-control px-4 py-2.5 text-sm transition-[background-color,border-color,transform] duration-150 disabled:opacity-40 ${variantClasses[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TextField({
  label,
  className = '',
  ...rest
}: InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink3">
          {label}
        </span>
      )}
      <input
        className={`w-full rounded-control border border-line bg-surface2 px-3 py-2.5 text-ink outline-none transition-colors placeholder:text-ink4 focus:border-accent ${className}`}
        {...rest}
      />
    </label>
  );
}

export function TextAreaField({
  label,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink3">
          {label}
        </span>
      )}
      <textarea
        className={`w-full rounded-control border border-line bg-surface2 px-3 py-2.5 text-ink outline-none transition-colors placeholder:text-ink4 focus:border-accent ${className}`}
        rows={3}
        {...rest}
      />
    </label>
  );
}

export function SelectField({
  label,
  className = '',
  children,
  value,
  onChange,
}: {
  label?: string;
  className?: string;
  children: ReactNode;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-[0.12em] text-ink3">
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-control border border-line bg-surface2 px-3 py-2.5 text-ink outline-none transition-colors focus:border-accent ${className}`}
      >
        {children}
      </select>
    </label>
  );
}

export function Chip({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`whitespace-nowrap rounded-control border px-3 py-1.5 text-xs font-semibold transition-colors ${
        active
          ? 'border-accent bg-accent-soft text-accent'
          : 'border-line bg-surface2 text-ink2 hover:border-line-strong hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

/** A stepper for integer targets — big tap targets, minimal typing. */
export function Stepper({
  value,
  onChange,
  min = 0,
  max = 999,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  ariaLabel?: string;
}) {
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <div className="inline-flex items-center gap-1" aria-label={ariaLabel}>
      <button
        type="button"
        onClick={() => onChange(clamp(value - 1))}
        className="h-9 w-9 rounded-control border border-line bg-surface2 text-lg text-ink2 hover:border-line-strong hover:text-ink"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="h-9 w-9 rounded-control border border-line bg-surface2 text-lg text-ink2 hover:border-line-strong hover:text-ink"
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}

export function Modal({
  title,
  onClose,
  children,
  footer,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-panel border border-line bg-surface shadow-raised sm:rounded-panel">
        <div className="flex items-center justify-between border-b border-hairline px-4 py-3.5">
          <h2 className="text-base font-extrabold text-ink">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-control px-2 py-1 text-ink3 hover:bg-white/[0.05] hover:text-ink"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-hairline p-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-pulse text-ink3">Loading…</div>
    </div>
  );
}

export function EmptyState({ title, note }: { icon?: string; title: string; note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <p className="font-extrabold text-ink">{title}</p>
      {note && <p className="max-w-xs text-sm text-ink2">{note}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <p className="font-extrabold text-fatigued">Something went wrong</p>
      <p className="max-w-xs text-sm text-ink2">{error.message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
