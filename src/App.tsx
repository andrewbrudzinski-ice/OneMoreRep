import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Spinner } from './components/ui';
import { RepositoryProvider } from './repository/RepositoryContext';
import { useRepositoryContext } from './repository/repositoryContext';
import { HomeScreen } from './screens/HomeScreen';
import { WorkoutScreen } from './screens/WorkoutScreen';
import { RoutineEditorScreen } from './screens/RoutineEditorScreen';
import { WorkoutModeScreen } from './screens/WorkoutModeScreen';
import { NutritionScreen } from './screens/NutritionScreen';
import { MoreScreen } from './screens/MoreScreen';
import { ExercisesScreen } from './screens/ExercisesScreen';

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
      {
        path: 'history/:exerciseId',
        element: (
          <Lazy>
            <ExerciseHistoryScreen />
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
]);

/** Gate the app on the repository being seeded/ready. */
function Gate() {
  const { ready, error } = useRepositoryContext();

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
