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
  { label: 'Settings', note: 'Targets, units, rest timer, theme, goal', to: '/more/settings' },
  { label: 'Export / Import', note: 'Back up and restore your data (JSON)', to: '/more/data' },
  { label: 'About', note: 'OneMoreRep · local-first fitness tracker', action: 'about' },
];

export function MoreScreen() {
  const navigate = useNavigate();
  const [aboutOpen, setAboutOpen] = useState(false);

  return (
    <>
      <ScreenHeader title="More" subtitle="Settings, data & about" />
      <ul className="divide-y divide-slate-800 border-t border-slate-800">
        {ITEMS.map((item) => (
          <li key={item.label}>
            <button
              onClick={() => (item.action === 'about' ? setAboutOpen(true) : item.to && navigate(item.to))}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-slate-900"
            >
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="mt-0.5 text-xs text-slate-400">{item.note}</div>
              </div>
              <span className="text-slate-600">›</span>
            </button>
          </li>
        ))}
      </ul>

      {aboutOpen && (
        <Modal title="About OneMoreRep" onClose={() => setAboutOpen(false)}>
          <div className="space-y-3 text-sm text-slate-300">
            <p>
              <span className="font-semibold">OneMoreRep</span> is a local-first, offline-capable
              fitness tracker. Everything lives on this device — no account, no cloud.
            </p>
            <p>
              The core loop is <span className="text-beat">Beat Last Time</span>: it always shows what
              you did last time and rewards beating it. Chase green, never punish.
            </p>
            <p className="text-xs text-slate-500">
              Your only backup is <span className="font-medium">Export / Import</span> — export
              regularly, especially before clearing browser data.
            </p>
          </div>
        </Modal>
      )}
    </>
  );
}
