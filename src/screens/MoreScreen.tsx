import { useNavigate } from 'react-router-dom';
import { ScreenHeader } from '../components/ScreenHeader';

interface MenuItem {
  label: string;
  note: string;
  to?: string;
  soon?: boolean;
}

const ITEMS: MenuItem[] = [
  { label: 'Exercise Database', note: 'Browse, search & add custom exercises', to: '/more/exercises' },
  { label: 'Settings', note: 'Targets, units, rest timer, theme', soon: true },
  { label: 'Export / Import', note: 'Back up and restore your data (JSON)', soon: true },
  { label: 'About', note: 'OneMoreRep · local-first fitness tracker', soon: true },
];

export function MoreScreen() {
  const navigate = useNavigate();
  return (
    <>
      <ScreenHeader title="More" subtitle="Settings, data & about" />
      <ul className="divide-y divide-slate-800 border-t border-slate-800">
        {ITEMS.map((item) => (
          <li key={item.label}>
            <button
              disabled={item.soon}
              onClick={() => item.to && navigate(item.to)}
              className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left hover:bg-slate-900 disabled:opacity-50 disabled:hover:bg-transparent"
            >
              <div>
                <div className="font-medium">{item.label}</div>
                <div className="mt-0.5 text-xs text-slate-400">{item.note}</div>
              </div>
              {item.soon ? (
                <span className="rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                  soon
                </span>
              ) : (
                <span className="text-slate-600">›</span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
