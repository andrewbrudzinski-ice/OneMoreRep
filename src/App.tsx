import { useEffect } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
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
import { WorkoutHistoryScreen } from './screens/WorkoutHistoryScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { DataScreen } from './screens/DataScreen';
import { MethodologyScreen } from './screens/MethodologyScreen';
// Analysis screens were previously code-split, but on an installed PWA a lazy
// chunk can 404 after a redeploy (its hashed filename changes), white-screening
// the tab with "Importing a module script failed". Importing them statically
// keeps the whole app in the precached bundle, so navigation never fetches an
// on-demand chunk that might be missing. (See vite:preloadError recovery in main.tsx.)
import { ProgressScreen } from './screens/ProgressScreen';
import { ExerciseHistoryScreen } from './screens/ExerciseHistoryScreen';
import { WorkoutSummaryScreen } from './screens/WorkoutSummaryScreen';
import { BodyweightScreen } from './screens/BodyweightScreen';

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
      { path: 'progress', element: <ProgressScreen /> },
      { path: 'more', element: <MoreScreen /> },
      { path: 'more/history', element: <WorkoutHistoryScreen /> },
      { path: 'more/exercises', element: <ExercisesScreen /> },
      { path: 'more/settings', element: <SettingsScreen /> },
      { path: 'more/data', element: <DataScreen /> },
      { path: 'more/methodology', element: <MethodologyScreen /> },
      { path: 'history/:exerciseId', element: <ExerciseHistoryScreen /> },
      { path: 'bodyweight', element: <BodyweightScreen /> },
    ],
  },
  // Workout Mode + summary are full-screen (no tab bar).
  { path: '/session/:workoutId', element: <WorkoutModeScreen /> },
  { path: '/summary/:workoutId', element: <WorkoutSummaryScreen /> },
], {
  // Honor the deploy base path (e.g. GitHub Project Pages subpath).
  basename: import.meta.env.BASE_URL,
});

/** Gate the app on the repository being seeded/ready. */
function Gate() {
  const { ready, error } = useRepositoryContext();

  // Dark-only: pin the palette once the app is ready.
  useEffect(() => {
    if (!ready) return;
    applyTheme();
  }, [ready]);

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
    <ErrorBoundary>
      <RepositoryProvider>
        <Gate />
      </RepositoryProvider>
    </ErrorBoundary>
  );
}
