import type { ReactNode } from 'react';

/**
 * Shared page header — sits flat on the page ground with a generous top inset
 * and a hairline rule below. Optional accent kicker, subtitle, and a trailing
 * action (kept vertically centered against the title).
 */
export function ScreenHeader({
  title,
  subtitle,
  kicker,
  action,
}: {
  title: string;
  subtitle?: string;
  /** Small uppercase accent line above the title. */
  kicker?: string;
  action?: ReactNode;
}) {
  return (
    <header className="border-b border-hairline px-4 pb-4 pt-7">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3">
        <div className="min-w-0">
          {kicker && (
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.18em] text-accent">
              {kicker}
            </div>
          )}
          <h1 className="text-[27px] font-extrabold leading-none tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-[13px] text-ink2">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

/**
 * The padded, max-width scroll body that panels live in. Gives every screen the
 * same horizontal gutters and inter-panel rhythm so containers can float on the
 * ground with consistent margins.
 */
export function PageBody({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto max-w-xl space-y-4 px-4 pb-12 pt-4 ${className}`}>{children}</div>
  );
}

/** Placeholder body used by the not-yet-built screens (empty state). */
export function ComingSoon({ note }: { note: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <p className="max-w-xs text-sm text-ink2">{note}</p>
    </div>
  );
}
