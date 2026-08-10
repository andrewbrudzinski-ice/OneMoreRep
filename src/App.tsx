import { lazy, Suspense, useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/ui';
import { RepositoryProvider } from './repository/RepositoryContext';
import { useRepositoryContext } from './repository/repositoryContext';
import { applyTheme } from './lib/theme';
import { HomeScreen } from './screens/HomeScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { RoutineEditorScreen } from './screens/RoutineEditorScreen';
import { WorkoutModeScreen } from './screens/WorkoutModeScreen';
import { NutritionScreen } from './screens/NutritionScreen';
import { FoodsScreen } from './screens/FoodsScreen';
import { MealsScreen } from './screens/MealsScreen';
import { MoreScreen } from './screens/MoreScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DataScreen } from './screens/DataScreen';

// Analysis screens pull in Recharts — load them on demand to keep the initial
// (training-mode) bundle lean.
const ProgressScreen = lazy(() =>
  import('./screens/ProgressScreen').then((m) => ({ default: m.ProgressScreen })),
);
const ExerciseHistoryScreen = lazy(() =>
  import('./screens/ExerciseHistoryScreen').then((m) => ({ default: m.ExerciseHistoryScreen })),
);
const WorkoutSummaryScreen = lazy(() =>
  import('./screens/WorkoutSummaryScreen').then((m) => ({ default: m.WorkoutSummaryScreen })),
);
const BodyweightScreen = lazy(() =>
  import('./screens/BodyweightScreen').then((m) => ({ default: m.BodyweightScreen })),
);

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <HomeScreen /> },
      { path: 'workout', element: <WorkoutScreen /> },
      { path: 'workout/routines/:routineId', element: <RoutineEditorScreen /> },
      { path: 'nutrition', element: <NutritionScreen /> },
      { path: 'nutrition/foods', element: <FoodsScreen /> },
      { path: 'nutrition/meals', element: <MealsScreen /> },
      {
        path: 'progress',
        element: (
          <Lazy>
            <ProgressScreen />
          </Lazy>
        ),
      },
      { path: 'more', element: <MoreScreen /> },
      { path: 'more/exercises', element: <ExercisesScreen /> },
      { path: 'more/settings', element: <SettingsScreen /> },
      { path: 'more/data', element: <DataScreen /> },
      {
        path: 'history/:exerciseId',
        element: (
          <Lazy>
            <ExerciseHistoryScreen />
          </Lazy>
        ),
      },
      {
        path: 'bodyweight',
        element: (
          <Lazy>
            <BodyweightScreen />
          </Lazy>
        ),
      },
    ],
  },
  // Workout Mode + summary are full-screen (no tab bar).
  { path: '/session/:workoutId', element: <WorkoutModeScreen /> },
  {
    path: '/summary/:workoutId',
    element: (
      <Lazy>
        <WorkoutSummaryScreen />
      </Lazy>
    ),
  },
], {
  // Honor the deploy base path (e.g. GitHub Project Pages subpath).
  basename: import.meta.env.BASE_URL,
});

/** Gate the app on the repository being seeded/ready. */
function Gate() {
  const { repository, ready, error } = useRepositoryContext();

  // Apply the saved theme once data is ready.
  useEffect(() => {
    if (!ready) return;
    void repository.getSettings().then((s) => applyTheme(s.theme));
  }, [ready, repository]);

  if (error) {
    return (
      <div className="flex min-h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <p className="text-lg font-semibold text-red-400">Couldn’t open your data</p>
        <p className="max-w-sm text-sm text-slate-400">{error.message}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="animate-pulse text-slate-500">Loading…</div>
      </div>
    );
  }

  return <RouterProvider router={router} />;
}

export function App() {
  return (
    <RepositoryProvider>
      <Gate />
    </RepositoryProvider>
  );
}
