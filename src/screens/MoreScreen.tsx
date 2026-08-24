import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { Modal } from '../components/ui';
import { ChevronRight, Panel, SectionHeader } from '../components/primitives';

interface MenuItem {
  label: string;
  note: string;
  to?: string;
  action?: 'about';
}

const ITEMS: MenuItem[] = [
  { label: 'Workout History', note: 'Browse & edit past sessions', to: '/more/history' },
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

      <PageBody>
        {/* Grouped menu — a bordered list panel */}
        <Panel className="overflow-hidden p-0">
          <ul>
            {ITEMS.map((item) => (
              <li key={item.label}>
                <button
                  onClick={() =>
                    item.action === 'about' ? setAboutOpen(true) : item.to && navigate(item.to)
                  }
                  className="flex w-full items-center justify-between gap-3 border-t border-hairline px-4 py-4 text-left transition-colors first:border-t-0 hover:bg-white/[0.03]"
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
        </Panel>

        {/* Local-first closing section — open on the ground */}
        <section className="pt-2">
          <SectionHeader label="Local-first" />
          <div className="mt-3 space-y-3 text-[12.5px] leading-[1.6] text-ink2">
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
      </PageBody>

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
