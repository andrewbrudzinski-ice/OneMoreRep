# OneMoreRep

A **local-first, mobile-first, offline-capable** personal fitness tracker (PWA).
Runs entirely on-device in v1 — no backend — but is architected so a future
migration to a multi-user Supabase/Postgres backend requires **no UI rewrite**.

> Core loop: **Beat Last Time.** The app always shows what you did last time and
> rewards beating it. Chase green, never punish.

## Stack

- **React + Vite + TypeScript** (strict mode)
- **Tailwind CSS**
- **Dexie.js** over IndexedDB (versioned schema + migrations)
- **Recharts** for charts
- **vite-plugin-pwa** for offline + install
- **Vitest** for unit tests

## Architecture (the parts that matter)

1. **The UI never touches storage directly.** All data access goes through the
   [`Repository`](src/repository/Repository.ts) interface. v1 ships
   [`IndexedDBRepository`](src/repository/IndexedDBRepository.ts); a future
   `SupabaseRepository` implements the same interface. The seam is
   [`getRepository()`](src/repository/index.ts) — swap the implementation there,
   no components change.
2. **Postgres-shaped schema.** Every record carries a UUID `id`, a `user_id`
   (default `"local-user"`), and `created_at` / `updated_at`. See
   [`src/types/index.ts`](src/types/index.ts) — the single source of truth for
   the data model — and [`src/db/database.ts`](src/db/database.ts) for the Dexie
   stores/indexes.
3. **Offline-always.** No feature requires the network; the app is installable
   and works fully offline.
4. **Historical accuracy via snapshots.** Set weight/reps are literal stored
   values; food entries snapshot their macros at log time.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` | Typecheck + production build (emits the PWA service worker) |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run test` | Run the Vitest suite |
| `npm run format` | Prettier write |

Regenerate PWA icons with `node scripts/generate-icons.mjs`.

## Build status — phased

Built in phases per the product spec; each phase is checked before the next.

- [x] **Phase 0 — Foundation & architecture.** Scaffold, full data-model types,
      Dexie schema, Repository interface + IndexedDB implementation, idempotent
      seeding (11 muscle groups, 55 exercises, default settings, `local-user`),
      app shell (bottom tab bar / sidebar, 5 tabs, routing), PWA registration.
- [x] **Phase 1 — Exercises & Routines.** Exercise database with instant
      search, muscle-group filter, detail view, add/edit custom exercises, and
      archive. Routine CRUD: create/edit, add/remove/reorder exercises, per-set
      targets & rep ranges, notes, and duplicate. Pure search + reorder logic
      unit-tested; routine round-trips (incl. reorder & deep-copy duplicate)
      tested through the repository.
- [x] **Phase 2 — Workout Mode + Beat Last Time.** Full-screen logger (own
      route, no tab bar): intent selector (Push/Normal/Light/Deload), sets
      pre-filled from last time, ± steppers with tap-to-type, ✓ complete,
      warm-up toggle, add/remove set, swap/remove exercise, always-visible
      LAST TIME reference, session timer, screen wake-lock, and immediate
      (crash-safe) persistence with a Resume banner. The **Beat Last Time
      engine** (reason-tagged green/amber/grey, honest e1RM detail, deload
      suppression, warm-up exclusion) and the **plate calculator** are pure
      and exhaustively unit-tested. Inline plate calc + non-blocking rest
      timer (Pause / +30s / Skip, gentle buzz at zero).
- [x] **Phase 3 — History, PRs, Workout Summary.** Auto **PR detection** on
      completion across all five pr_types, cached to `personal_records` with
      `previous_value` (pure & unit-tested; warm-ups excluded). Post-workout
      **summary**: duration, exercise/working-set counts, total volume,
      deload-aware **vs-last %** wording, and new PRs. **Exercise history**:
      lifetime bests, per-session breakdown, and e1RM / volume / top-weight
      **charts** (Recharts, code-split). **Progress** page: PR feed + per-exercise
      trend links.
- [x] **Phase 4 — Nutrition.** Custom foods CRUD + instant search; **meals**
      (grouped foods) CRUD with a per-item editor; daily log by meal type with
      **macros snapshotted at log time** (editing/deleting a food never rewrites
      past entries — unit-proven); edit servings / delete entries inline;
      quick-add a saved meal; live daily totals vs targets as **4 macro rings +
      a fiber bar**; per-day navigation.
- [x] **Phase 5 — Bodyweight, Dashboard, Analytics.** Bodyweight entry
      (one weigh-in/day, upsert) with a **7/30-day rolling-average** chart and
      stats (current, start, change, avg, high, low). Fixed **Dashboard**:
      today's workout, bodyweight + trend sparkline, macro rings, this-week
      count + streak, recent PRs, weekly volume — assembled repository-side.
      **Progress** analytics: workout frequency (14-day activity), current /
      longest streak, and 7-day macro consistency. Rolling-average and streak
      math are pure & unit-tested; Home uses inline SVG sparklines to stay off
      the Recharts bundle.
- [x] **Phase 6 — Export/Import + polish.** Validated **JSON export/import**
      (versioned envelope, rejects foreign/newer/corrupt files; atomic
      wipe-and-restore) — round-trip proven by test. **Settings** screen
      (profile, units, goal, theme, macro targets, rest default,
      load_always_green) with theme applied on load. Empty / loading / **error**
      states across the primary screens, an About sheet, and a restrained
      screen-enter transition. Verified installable + **fully offline** (SW
      precache; offline reload, navigation, and logging all work).
- [ ] Phase 7 — Should-haves (Readiness, heatmap, RPE auto-regulation)
