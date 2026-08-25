import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ScreenHeader, PageBody } from '../components/ScreenHeader';
import { Button } from '../components/ui';
import { Panel } from '../components/primitives';

/**
 * Plain-language explanations of how every number in the app is calculated.
 * Kept in sync with the actual engines (lib/readiness, lib/beatLastTime,
 * lib/muscleVolume, lib/autoRegulation, lib/rollingAverage, repository stats).
 */
export function MethodologyScreen() {
  const navigate = useNavigate();
  return (
    <>
      <ScreenHeader
        kicker="Methodology"
        title="How it's calculated"
        action={
          <Button variant="ghost" onClick={() => navigate('/more')}>
            Done
          </Button>
        }
      />

      <PageBody>
        <p className="px-0.5 text-[12.5px] leading-relaxed text-ink2">
          Every number here comes from your own logged data with transparent, non-medical rules.
          Here’s exactly how each one is worked out.
        </p>

        <Method title="Training readiness" formula="index = 100 − fatigue penalties">
          A 0–100 read on how recovered you are, from three signals in your log. Starting at 100, it
          subtracts penalties for a longer <B>training streak</B> (steeper as it grows — a 2-day
          streak −14, 3-day −26, 4-day −36, and up from there), for <B>muscle groups trained two
          days running</B> (−8 each), and for <B>rising working volume</B> vs your prior sessions
          (−8; easing off adds a little back). The result is clamped to 5–100:{' '}
          <B>85+ Primed</B>, <B>55–84 Moderate</B>, under <B>55 Fatigued</B>. It’s a rough read from
          your training log — not medical or recovery-science advice.
        </Method>

        <Method title="Estimated 1-rep max (e1RM)" formula="weight × (1 + reps ÷ 30)">
          The Epley formula estimates the most you could lift once, from a set you actually did. A
          set of <B>185 × 8</B> estimates about <B>234 lb</B>. It lets you compare hard sets at
          different weights and rep ranges on one scale.
        </Method>

        <Method title="Beat Last Time" formula="this set vs the same set # last time">
          While logging, each set is compared to the <B>same set number</B> from the last time you
          did that exercise (set 1 vs set 1, set 2 vs set 2). Heavier weight for at least one rep
          reads <span className="text-accent">green</span>; so do more reps at the same-or-heavier
          weight, or a clearly higher e1RM (“stronger”). Within about <B>±2%</B> e1RM it reads
          “Matched”; below that it’s “Down” — shown in neutral grey, never as a failure (and
          suppressed entirely on light/deload days). If your last session was longer ago than your
          chosen window, it starts fresh with no comparison.
        </Method>

        <Method title="Working volume" formula="Σ (weight × reps) of completed working sets">
          Total tonnage moved. It sums <B>weight × reps</B> across every completed set, excluding
          warm-ups. This drives your weekly volume, the 7-day chart, and per-session totals.
        </Method>

        <Method title="Muscle volume map" formula="primary 100% · each secondary 50%">
          Each set’s volume is credited fully to the exercise’s <B>primary muscle</B> and half to
          each <B>secondary muscle</B>, then summed per group over the week. The body map shades from
          resting graphite toward lime for the muscles you worked hardest.
        </Method>

        <Method title="Personal records">
          Tracked per exercise and refreshed after every session: <B>heaviest weight</B>,{' '}
          <B>best estimated 1RM</B>, <B>most reps at a given weight</B>, <B>best single-set volume</B>,
          and <B>best whole-session volume</B>. Editing a past workout replays your history so PRs
          stay correct.
        </Method>

        <Method title="Bodyweight trend" formula="7-day & 30-day rolling averages">
          Your raw weigh-ins are noisy day to day, so the trend lines smooth them with a{' '}
          <B>7-day</B> and a <B>30-day</B> rolling average — the 7-day shows the near-term direction,
          the 30-day the underlying trend.
        </Method>

        <Method title="Progression suggestion" formula="2 easy sessions → +5 lb / +2.5 kg">
          Light auto-regulation: when you hit your <B>target reps</B> at an easy effort (RPE ≤ 7,
          i.e. roughly 3+ reps left in the tank) for <B>two sessions in a row</B>, it suggests adding
          the standard increment next time — <B>+5 lb</B> or <B>+2.5 kg</B>.
        </Method>

        <Method title="Streaks & consistency">
          Your <B>day streak</B> counts consecutive calendar days with a completed workout;{' '}
          <B>this week</B> counts sessions since Monday. The 14-day grid marks each day you trained.
        </Method>

        <Method title="Nutrition">
          Foods store macros <B>per serving</B>. Logging a food <B>snapshots</B> those macros, so
          editing a food later never changes what you already logged. Daily totals sum every entry ×
          its servings. Database search pulls per-100 g values from <B>USDA</B> and{' '}
          <B>Open Food Facts</B> and saves a snapshot to your library.
        </Method>

        <p className="px-0.5 pt-1 text-[11.5px] leading-relaxed text-ink3">
          These are heuristics meant to be useful and honest, not clinical measurements. Readiness in
          particular is a training-log signal, not a recovery or medical score.
        </p>
      </PageBody>
    </>
  );
}

function Method({
  title,
  formula,
  children,
}: {
  title: string;
  formula?: string;
  children: ReactNode;
}) {
  return (
    <Panel className="p-4">
      <h2 className="text-[15px] font-extrabold tracking-[-0.01em] text-ink">{title}</h2>
      {formula && (
        <div className="mt-2 inline-block rounded-control border border-hairline bg-surface2 px-2.5 py-1 text-[11.5px] tabular-nums text-accent">
          {formula}
        </div>
      )}
      <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink2">{children}</p>
    </Panel>
  );
}

function B({ children }: { children: ReactNode }) {
  return <span className="font-semibold text-ink">{children}</span>;
}
