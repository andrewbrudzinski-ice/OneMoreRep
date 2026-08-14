import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';
import { Modal } from '../components/ui';

interface MenuItem {
  label: string;
  note: string;
  to?: string;
  action?: 'about';
}

const ITEMS: MenuItem[] = [
  { label: 'Exercise Database', note: 'Browse, search & add custom exercises', to: '/more/exercises' },
  { label: 'Settings', note: 'Targets, units, rest timer, goal', to: '/more/settings' },
  { label: 'Export / Import', note: 'Back up and restore your data (JSON)', to: '/more/data' },
  { label: 'About', note: 'OneMoreRep · local-first fitness tracker', action: 'about' },
];

export function MoreScreen() {
  const navigate = useNavigate();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <ScreenHeader kicker="Settings, data & about" title="More" />

      <ul>
        {ITEMS.map((item) => (
          <li key={item.label}>
            <button
              onClick={() =>
                item.action === 'about' ? setAboutOpen(true) : item.to && navigate(item.to)
              }
              className="flex w-full items-center justify-between gap-3 border-b border-white/[0.08] px-5 py-[18px] text-left transition-colors hover:bg-surface"
            >
              <div>
                <div className="text-[14px] font-extrabold text-ink">{item.label}</div>
                <div className="mt-0.5 text-[11.5px] text-ink2">{item.note}</div>
              </div>
              <ChevronRight className="h-[17px] w-[17px] shrink-0 text-ink5" />
            </button>
          </li>
        ))}
      </ul>

      {/* Local-first closing section — the About copy inline. */}
      <section className="px-5 py-[22px]">
        <div className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.14em] text-ink3">
          Local-first
        </div>
        <div className="space-y-3 text-[12.5px] leading-[1.6] text-ink2">
          <p>
            <span className="font-extrabold text-ink">OneMoreRep</span> is a local-first,
            offline-capable fitness tracker. Everything lives on this device — no account, no cloud.
          </p>
          <p>
            The core loop is <span className="font-extrabold text-accent">Beat Last Time</span>: it
            always shows what you did last time and rewards beating it. Chase green, never punish.
          </p>
          <p className="text-[11.5px] text-ink3">
            Your only backup is <span className="font-semibold text-ink2">Export / Import</span> —
            export regularly, especially before clearing browser data.
          </p>
        </div>
      </section>

      {aboutOpen && (
        <Modal title="About OneMoreRep" onClose={() => setAboutOpen(false)}>
          <div className="space-y-3 text-sm text-ink2">
            <p>
              <span className="font-extrabold text-ink">OneMoreRep</span> is a local-first,
              offline-capable fitness tracker. Everything lives on this device — no account, no
              cloud.
            </p>
            <p>
              The core loop is <span className="text-accent">Beat Last Time</span>: it always shows
              what you did last time and rewards beating it. Chase green, never punish.
            </p>
            <p className="text-xs text-ink3">
              Your only backup is <span className="font-medium">Export / Import</span> — export
              regularly, especially before clearing browser data.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
