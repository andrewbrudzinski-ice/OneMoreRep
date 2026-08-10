import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { getRepository } from './index';
import { RepositoryContext } from './repositoryContext';

/**
 * Provides the app's Repository and runs the idempotent seed exactly once on
 * launch. Children render only after the DB is ready.
 */
export function RepositoryProvider({ children }: { children: ReactNode }) {
  const repository = useMemo(() => getRepository(), []);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    repository
      .seed()
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
    };
  }, [repository]);

  const value = useMemo(() => ({ repository, ready, error }), [repository, ready, error]);

  return <RepositoryContext.Provider value={value}>{children}</RepositoryContext.Provider>;
}
