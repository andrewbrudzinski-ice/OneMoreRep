import type { ReactNode } from 'react';

/**
 * Shared page header — flat on the page ground with a 2px rule below, an
 * optional accent kicker above the title, and an optional subtitle / action.
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
    <header className="border-b-2 border-white/[0.15] px-5 pb-[18px] pt-[26px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {kicker && (
            <div className="mb-1.5 text-[10px] font-extrabold uppercase tracking-[0.18em] text-accent">
              {kicker}
            </div>
          )}
          <h1 className="text-[29px] font-extrabold leading-none tracking-[-0.03em] text-ink">
            {title}
          </h1>
          {subtitle && <p className="mt-2 text-sm text-ink2">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
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
