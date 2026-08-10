import { IndexedDBRepository } from './IndexedDBRepository';
import type { Repository } from './Repository';

/**
 * Single place the app resolves its Repository implementation. To migrate to
 * multi-user in the future, swap the constructed class here (e.g. to a
 * `SupabaseRepository`) — this is the "flip one config line" seam. No UI
 * changes required.
 */
let instance: Repository | null = null;

export function getRepository(): Repository {
  if (!instance) {
    instance = new IndexedDBRepository();
  }
  return instance;
}

/** Test hook: inject a repository (e.g. one bound to an isolated DB). */
export function setRepository(repo: Repository | null): void {
  instance = repo;
}

export type { Repository } from './Repository';
export { IndexedDBRepository } from './IndexedDBRepository';
