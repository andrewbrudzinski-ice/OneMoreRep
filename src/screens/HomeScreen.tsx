import { useEffect, useState } from 'react';
import { ScreenHeader } from '../components/ScreenHeader';
import { useRepository } from '../repository/repositoryContext';
import type { User } from '../types';

/**
 * Home / Dashboard placeholder. Reads a couple of values through the
 * Repository to prove the data layer is wired end-to-end. The real
 * dashboard cards land in Phase 5.
 */
export function HomeScreen() {
  const repository = useRepository();
  const [user, setUser] = useState<User | null>(null);
  const [exerciseCount, setExerciseCount] = useState<number | null>(null);
  const [muscleCount, setMuscleCount] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [u, exercises, groups] = await Promise.all([
        repository.getCurrentUser(),
        repository.getExercises(),
        repository.getMuscleGroups(),
      ]);
      if (!active) return;
      setUser(u);
      setExerciseCount(exercises.length);
      setMuscleCount(groups.length);
    })();
    return () => {
      active = false;
    };
  }, [repository]);

  return (
    <>
      <ScreenHeader title={user ? `Welcome, ${user.name}` : 'Home'} subtitle="Chase green." />
      <div className="grid gap-4 p-4 sm:grid-cols-2">
        <Card label="Exercises seeded" value={exerciseCount} />
        <Card label="Muscle groups" value={muscleCount} />
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 sm:col-span-2">
          <p className="text-sm text-slate-400">
            Foundation is live. Workout Mode, Beat Last Time, nutrition, and the dashboard arrive
            in the next phases.
          </p>
        </div>
      </div>
    </>
  );
}

function Card({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="text-3xl font-bold tabular-nums">{value ?? '—'}</div>
      <div className="mt-1 text-sm text-slate-400">{label}</div>
    </div>
  );
}
