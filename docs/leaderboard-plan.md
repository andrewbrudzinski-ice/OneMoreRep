# Friends Leaderboard — design & build plan (not yet implemented)

Status: **planned, not built.** This is the blueprint to execute when there are
friends to share with. Nothing here ships in the app until the phases below are
implemented; the app stays 100% local until then.

## Goal

Let friends compare weekly training stats on a leaderboard, **without giving up
local-first**. Your raw training log never leaves the device. The only thing
that syncs is a tiny, opt-in weekly summary.

Ranking metrics (agreed):

- Weekly volume (working lbs = Σ weight × reps of completed working sets, last 7 days)
- Days trained this week
- Current streak
- Total workouts (all-time)
- **Fifth metric — OPEN.** Candidates: heaviest lift / best e1RM this week ·
  total working sets this week · workouts this month · PRs set this week. Pick
  one before Phase 4.

## The core principle: what syncs vs. what stays local

| Stays 100% local (IndexedDB, unchanged) | Syncs (opt-in, tiny) |
|---|---|
| Every workout, set, weight, rep, exercise | A weekly **summary** row per person |
| Nutrition, bodyweight, routines, PRs | Display name + group membership |

The synced summary is only:

```jsonc
{
  "user_key": "uuid (device-generated)",
  "display_name": "Andrew",
  "group_id": "uuid",
  "week_start": "2026-08-10",      // Monday of the ISO week
  "week_volume": 48200,
  "days_trained": 4,
  "streak": 6,
  "total_workouts": 132,
  // fifth metric field TBD
  "updated_at": "2026-08-14T14:00:00Z"
}
```

No exercise names, no per-lift weights — just the totals. Sharing is off by
default and toggled on in Settings.

## Backend: Supabase

Free tier is plenty. The `anon` key is **meant** to ship in the client; Row-Level
Security (RLS) is what actually protects data. Config via env (baked into the
static build at deploy time):

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

When these are unset, the app behaves exactly as it does today (fully local, no
social features shown). This keeps the feature dormant until it's configured.

### Schema (copy-paste SQL)

```sql
-- Groups (a friend circle) identified by a short human invite code.
create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  invite_code text not null unique,          -- e.g. "APEX-7F3"
  created_at timestamptz not null default now()
);

-- Membership: a device/user belongs to a group with a display name.
create table group_members (
  group_id uuid not null references groups(id) on delete cascade,
  user_key uuid not null,                     -- device-generated, stored locally
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_key)
);

-- The weekly summary each member publishes.
create table weekly_summaries (
  group_id uuid not null references groups(id) on delete cascade,
  user_key uuid not null,
  week_start date not null,
  display_name text not null,
  week_volume integer not null default 0,
  days_trained integer not null default 0,
  streak integer not null default 0,
  total_workouts integer not null default 0,
  -- fifth_metric integer,                    -- add when chosen
  updated_at timestamptz not null default now(),
  primary key (group_id, user_key, week_start)
);

alter table groups enable row level security;
alter table group_members enable row level security;
alter table weekly_summaries enable row level security;
```

### Identity & auth (lightweight, friends-only)

No passwords. Each device generates a random `user_key` (UUID) once and stores
it locally. To avoid a full auth setup, use **Supabase anonymous sign-in** so
`auth.uid()` exists for RLS, and store the app's `user_key` in the member row.

### RLS policies (the important part)

The rule that makes this safe: **you can only read summaries for groups you're a
member of, and only write your own row.** Sketch (tighten during Phase 1):

```sql
-- You may read members/summaries only for groups you belong to.
create policy read_own_groups on weekly_summaries
  for select using (
    exists (select 1 from group_members m
            where m.group_id = weekly_summaries.group_id
              and m.user_key = auth.uid())
  );

-- You may write only your own summary row.
create policy write_own_summary on weekly_summaries
  for insert with check (user_key = auth.uid());
create policy update_own_summary on weekly_summaries
  for update using (user_key = auth.uid());
```

(Joining a group happens through an RPC that validates the invite code, so the
`groups` table itself isn't world-readable.)

## App architecture (keep the Repository seam intact)

- **Do not touch** `IndexedDBRepository` or the local data model. Raw workouts
  stay local.
- Add a **separate, optional** `SocialClient` — it never reads/writes workout
  storage directly; it consumes summaries computed from the existing repo.

```ts
export interface WeeklySummary { /* the payload above */ }

export interface SocialClient {
  isConfigured(): boolean;                       // false when env unset → feature hidden
  getGroup(): Promise<Group | null>;
  createGroup(name: string, displayName: string): Promise<Group>;
  joinGroup(inviteCode: string, displayName: string): Promise<Group>;
  leaveGroup(): Promise<void>;
  publishSummary(s: WeeklySummary): Promise<void>;
  getLeaderboard(weekStart: string): Promise<WeeklySummary[]>;
}
```

- **Summary computation is pure and local** — a `computeWeeklySummary(repo)`
  that derives the numbers from existing data (mostly reuses
  `getDashboardData` / `getProgressStats` / `getWorkoutHistory`). This is the one
  piece worth building first because it's testable and backend-independent.
- **Offline-safe publish:** queue the latest summary locally; flush on
  reconnect. Never block the local logging flow on the network.

## UX

- **Settings:** a "Share weekly stats with friends" toggle + display name. Off
  by default. Only visible when Supabase is configured.
- **Connect:** create a group → show invite code to share, or enter a code to
  join. Simple sheet.
- **Leaderboard screen** (new tab or a More entry): the group's members ranked,
  with the metrics as sortable tabs/columns, "you" highlighted, week switcher.
  Built on the existing design system (kicker header, hairline rows, accent for
  the leader / your row).
- **Publish triggers:** recompute + publish your summary when you finish or edit
  a workout (and on app open if the week rolled over).

## Privacy & trust

- Opt-in; nothing syncs until the toggle is on.
- Only aggregate totals are shared, never individual lifts.
- Numbers are self-reported from each device — an honor system, which is fine
  for a friends group. (No anti-cheat planned.)
- Leaving a group deletes your membership + summary rows for it.

## Testing note

The CI/build sandbox blocks outbound connections to third-party hosts, so the
live Supabase round-trip can't be verified from CI — only the local logic,
types, unit tests (mocked client), and the production build. The end-to-end
check (publish a summary, see a friend's row) is done on the deployed site with
a real project.

## Phased build (each phase = one reviewable PR)

1. **Foundation (backend-independent, safe to do anytime):**
   `computeWeeklySummary()` + `WeeklySummary` type + unit tests. No UI, no
   network. This is the only phase worth doing before there are friends.
2. **Supabase client + schema:** run the SQL, add the `SocialClient`
   implementation behind `isConfigured()`, env wiring, anonymous auth.
3. **Connect flow:** create/join/leave group via invite code; Settings toggle +
   display name.
4. **Publish + Leaderboard screen:** publish on workout complete/edit; the
   ranked UI with sortable metrics (finalize the 5th metric here).
5. **Polish:** offline queue, week switcher, empty/error states, "you" v. group.

## To start later

Ping me with "let's build the leaderboard" once you have a Supabase project (or
want me to scaffold against placeholders first). Decisions still open: the fifth
metric, and whether the Leaderboard gets its own bottom-nav tab or lives under
More.
