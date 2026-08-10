import type { ReactNode } from 'react';

/** Shared page header with a title and optional subtitle / action slot. */
export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-800 bg-slate-950/80 px-4 py-4 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

/** Placeholder body used by the not-yet-built screens (empty state). */
export function ComingSoon({ note }: { note: string }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-6 text-center">
      <div className="text-4xl">🚧</div>
      <p className="max-w-xs text-sm text-slate-400">{note}</p>
    </div>
  );
}
