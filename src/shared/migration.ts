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
