import type { GameCompletion, GameStatus } from '../shared/types';
import { transformCompletionsToStatuses, migrateStatusSchema } from '../shared/migration';

import type { StoreSchema } from './store';
import { store } from './store';

/** Runs all startup migrations, mutating the store if needed. */
export function migrateCompletionsToStatuses(): void {
  // 1. Legacy completions → statuses
  const statuses = (store.get('statuses') || {}) as Record<number, GameStatus>;
  const completions = (store.get('completions') || {}) as Record<number, GameCompletion>;
  const migrated = transformCompletionsToStatuses(completions, statuses);
  if (migrated) {
    store.set('statuses', migrated as StoreSchema['statuses']);
  }

  // 2. Remove in_progress + isEndless from stored statuses
  const currentStatuses = (store.get('statuses') || {}) as Record<number, GameStatus>;
  const cleaned = migrateStatusSchema(currentStatuses);
  if (cleaned) {
    store.set('statuses', cleaned as StoreSchema['statuses']);
  }

  // 3. Reset saved filter if it references a removed value
  const prefs = store.get('filterPreferences');
  const removed = ['in_progress', 'endless'] as const;
  if (prefs && removed.includes(prefs.statusFilter as (typeof removed)[number])) {
    store.set('filterPreferences', { ...prefs, statusFilter: 'all' });
  }
}
