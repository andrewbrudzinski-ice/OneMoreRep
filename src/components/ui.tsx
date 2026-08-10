import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-beat text-slate-950 hover:bg-green-400 font-semibold',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
  ghost: 'bg-transparent text-slate-300 hover:bg-slate-800',
  danger: 'bg-transparent text-red-400 hover:bg-red-500/10',
};

export function Button({
  variant = 'secondary',
  className = '',
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm transition-colors disabled:opacity-40 ${variantClasses[variant]} ${className}`}
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
      {label && <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>}
      <input
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none focus:border-beat ${className}`}
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
      {label && <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>}
      <textarea
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none focus:border-beat ${className}`}
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
      {label && <span className="mb-1 block text-xs font-medium text-slate-400">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-slate-100 outline-none focus:border-beat ${className}`}
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
      className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active
          ? 'border-beat bg-beat/15 text-beat'
          : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'
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
        className="h-9 w-9 rounded-lg bg-slate-800 text-lg text-slate-200 hover:bg-slate-700"
        aria-label="Decrease"
      >
        −
      </button>
      <span className="w-8 text-center text-sm font-semibold tabular-nums">{value}</span>
      <button
        type="button"
        onClick={() => onChange(clamp(value + 1))}
        className="h-9 w-9 rounded-lg bg-slate-800 text-lg text-slate-200 hover:bg-slate-700"
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="flex max-h-[92vh] w-full max-w-lg flex-col rounded-t-2xl border border-slate-800 bg-slate-950 sm:rounded-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <div className="border-t border-slate-800 p-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-pulse text-slate-500">Loading…</div>
    </div>
  );
}

export function EmptyState({ icon, title, note }: { icon: string; title: string; note?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      <div className="text-4xl">{icon}</div>
      <p className="font-medium text-slate-200">{title}</p>
      {note && <p className="max-w-xs text-sm text-slate-400">{note}</p>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="text-4xl">⚠️</div>
      <p className="font-medium text-red-400">Something went wrong</p>
      <p className="max-w-xs text-sm text-slate-400">{error.message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
