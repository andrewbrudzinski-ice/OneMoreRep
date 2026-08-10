import { createContext, useContext } from 'react';
import type { Repository } from './index';

export interface RepositoryContextValue {
  repository: Repository;
  /** True once seed() has completed on first launch. */
  ready: boolean;
  error: Error | null;
}

export const RepositoryContext = createContext<RepositoryContextValue | null>(null);

export function useRepositoryContext(): RepositoryContextValue {
  const ctx = useContext(RepositoryContext);
  if (!ctx) {
    throw new Error('useRepositoryContext must be used within a RepositoryProvider');
  }
  return ctx;
}

/** Convenience hook for the repository itself. */
export function useRepository(): Repository {
  return useRepositoryContext().repository;
}
