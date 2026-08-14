import { NavLink, Outlet, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';

interface TabDef {
  to: string;
  label: string;
  icon: ReactNode;
}

/** Lucide icon wrapper — 24 viewBox, round caps, 1.75 stroke. */
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[21px] w-[21px]"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

// Lucide paths: house, dumbbell, utensils, trending-up, ellipsis.
const TABS: TabDef[] = [
  {
    to: '/',
    label: 'Home',
    icon: (
      <Icon>
        <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
        <path d="M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      </Icon>
    ),
  },
  {
    to: '/workout',
    label: 'Workout',
    icon: (
      <Icon>
        <path d="m6.5 6.5 11 11" />
        <path d="m21 21-1-1" />
        <path d="m3 3 1 1" />
        <path d="m18 22 4-4" />
        <path d="m2 6 4-4" />
        <path d="m3 10 7-7" />
        <path d="m14 21 7-7" />
      </Icon>
    ),
  },
  {
    to: '/nutrition',
    label: 'Nutrition',
    icon: (
      <Icon>
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
        <path d="M7 2v20" />
        <path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Z" />
      </Icon>
    ),
  },
  {
    to: '/progress',
    label: 'Progress',
    icon: (
      <Icon>
        <path d="M16 7h6v6" />
        <path d="m22 7-8.5 8.5-5-5L2 17" />
      </Icon>
    ),
  },
  {
    to: '/more',
    label: 'More',
    icon: (
      <Icon>
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
        <circle cx="5" cy="12" r="1" />
      </Icon>
    ),
  },
];

export function AppShell() {
  const location = useLocation();
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex md:w-56 md:shrink-0 md:flex-col md:border-r md:border-white/[0.14] md:bg-ground md:p-4">
        <div className="mb-8 px-2">
          <span className="text-lg font-extrabold tracking-tight text-ink">OneMoreRep</span>
        </div>
        <nav className="flex flex-col gap-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end={tab.to === '/'}
              className={({ isActive }) =>
                `relative flex items-center gap-3 px-3 py-2.5 text-sm font-extrabold uppercase tracking-[0.08em] transition-colors ${
                  isActive ? 'text-accent' : 'text-ink3 hover:text-ink'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute inset-y-1 left-0 w-0.5 bg-accent" />}
                  {tab.icon}
                  <span>{tab.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 pb-24 md:pb-0">
        {/* key on pathname so each screen replays the enter transition */}
        <div key={location.pathname} className="screen-enter">
          <Outlet />
        </div>
      </main>

      {/* Bottom tab bar (mobile) — opaque, no blur, 2px accent bar on active. */}
      <nav
        className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-5 border-t border-white/[0.14] bg-ground md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === '/'}
            className={({ isActive }) =>
              `relative flex flex-col items-center gap-1.5 pb-[15px] pt-[13px] text-[8.5px] font-extrabold uppercase tracking-[0.11em] transition-colors ${
                isActive ? 'text-accent' : 'text-ink3'
              }`
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute inset-x-0 top-[-1px] h-0.5 bg-accent" />
                )}
                {tab.icon}
                <span>{tab.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
