import type { GameCompletion, GameStatus } from './types';

/**
 * Pure transform: converts legacy completions to new statuses format.
 * Returns the merged statuses, or null if migration isn't needed.
 */
export function transformCompletionsToStatuses(
  completions: Record<number, GameCompletion>,
  existingStatuses: Record<number, GameStatus>,
): Record<number, GameStatus> | null {
  if (Object.keys(existingStatuses).length > 0) return null;
  if (Object.keys(completions).length === 0) return null;

  const migrated: Record<number, GameStatus> = {};
  for (const [appidStr, completion] of Object.entries(completions)) {
    if (completion.completed) {
      const appid = parseInt(appidStr, 10);
      migrated[appid] = {
        status: 'completed',
        statusDate: completion.completedDate || new Date().toISOString(),
        completedDate: completion.completedDate,
      };
    }
  }

  if (Object.keys(migrated).length === 0) return null;
  return migrated;
}

/**
 * Removes the deprecated `in_progress` status and `isEndless` flag from stored
 * statuses. `in_progress` becomes no status (derived from sessions instead).
 * `isEndless` is dropped — use the `retired` status for endless games instead.
 * Returns the cleaned statuses, or null when nothing needed changing.
 */
export function migrateStatusSchema(
  statuses: Record<number, GameStatus & { isEndless?: boolean }>,
): Record<number, GameStatus> | null {
  let changed = false;
  const result: Record<number, GameStatus> = {};

  for (const [key, status] of Object.entries(statuses)) {
    const appid = Number(key);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = status as any;

    // in_progress is now derived — remove the stored status
    if (raw.status === 'in_progress') {
      changed = true;
      const { status: _s, isEndless: _e, ...rest } = raw;
      void _s;
      void _e;
      if (Object.keys(rest).length > 0) result[appid] = rest;
      continue;
    }

    // Strip isEndless flag
    if ('isEndless' in raw) {
      changed = true;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { isEndless: _, ...rest } = raw;
      if (Object.keys(rest).length > 0) result[appid] = rest;
      continue;
    }

    result[appid] = status;
  }

  return changed ? result : null;
}
