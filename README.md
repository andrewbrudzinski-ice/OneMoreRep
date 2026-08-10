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
      seeding (11 muscle groups, 56 exercises, default settings, `local-user`),
      app shell (bottom tab bar / sidebar, 5 tabs, routing), PWA registration.
- [ ] Phase 1 — Exercises & Routines
- [ ] Phase 2 — Workout Mode + Beat Last Time
- [ ] Phase 3 — History, PRs, Workout Summary
- [ ] Phase 4 — Nutrition
- [ ] Phase 5 — Bodyweight, Dashboard, Analytics
- [ ] Phase 6 — Export/Import + polish
- [ ] Phase 7 — Should-haves (Readiness, heatmap, RPE auto-regulation)
