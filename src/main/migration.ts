import type { GameCompletion, GameStatus } from '../shared/types';
import { transformCompletionsToStatuses } from '../shared/migration';
import type { StoreSchema } from './store';
import { store } from './store';

/** Runs migration on startup, mutating the store if needed. */
export function migrateCompletionsToStatuses(): void {
  const statuses = (store.get('statuses') || {}) as Record<number, GameStatus>;
  const completions = (store.get('completions') || {}) as Record<number, GameCompletion>;

  const migrated = transformCompletionsToStatuses(completions, statuses);
  if (migrated) {
    store.set('statuses', migrated as StoreSchema['statuses']);
  }
}
