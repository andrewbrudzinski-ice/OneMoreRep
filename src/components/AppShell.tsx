import { NavLink, Outlet } from 'react-router-dom';
import type { ReactNode } from 'react';

interface TabDef {
  to: string;
  label: string;
  icon: ReactNode;
}

/** Simple inline SVG icons — no icon dependency for the shell. */
function Icon({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

const TABS: TabDef[] = [
  { to: '/', label: 'Home', icon: <Icon path="M3 11l9-8 9 8M5 10v10h14V10" /> },
  { to: '/workout', label: 'Workout', icon: <Icon path="M6.5 6.5l11 11M4 9l2-2 3 3-2 2zM15 18l2-2 3 3-2 2zM3 21l3-3M18 3l3 3" /> },
  { to: '/nutrition', label: 'Nutrition', icon: <Icon path="M12 3v18M5 8c0 4 3 5 7 5M19 8c0 4-3 5-7 5" /> },
  { to: '/progress', label: 'Progress', icon: <Icon path="M3 3v18h18M7 15l3-4 3 3 4-6" /> },
  { to: '/more', label: 'More', icon: <Icon path="M4 6h16M4 12h16M4 18h16" /> },
];

const activeClasses = 'text-beat';
const inactiveClasses = 'text-slate-400 hover:text-slate-200';

export function AppShell() {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r md:border-slate-800 md:bg-slate-900/50 md:p-4">
        <div className="mb-8 flex items-center gap-2 px-2">
          <span className="text-2xl">🏋️</span>
          <span className="text-lg font-bold tracking-tight">OneMoreRep</span>
        </div>
        <nav className="flex flex-col gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive ? 'bg-slate-800 text-beat' : inactiveClasses
                }`
              }
            >
              {tab.icon}
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom tab bar (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-20 flex border-t border-slate-800 bg-slate-900/90 backdrop-blur md:hidden">
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition-colors ${
                isActive ? activeClasses : inactiveClasses
              }`
            }
            style={{ paddingBottom: 'calc(0.5rem + env(safe-area-inset-bottom))' }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
