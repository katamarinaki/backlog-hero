import type { GameStatus, SteamGame } from './types';

/**
 * Games played in the last 2 weeks (Steam's `playtime_2weeks`), most recently
 * played first. Falls back to recent playtime when last-played timestamps tie.
 */
export function getRecentActivity(games: SteamGame[]): SteamGame[] {
  return games
    .filter((g) => (g.playtime_2weeks ?? 0) > 0)
    .sort((a, b) => {
      const lastDiff = (b.rtime_last_played ?? 0) - (a.rtime_last_played ?? 0);
      if (lastDiff !== 0) return lastDiff;
      return (b.playtime_2weeks ?? 0) - (a.playtime_2weeks ?? 0);
    });
}

export interface LogEntry {
  appid: number;
  /** Millisecond timestamp used for ordering; 0 when no date is known. */
  date: number;
}

/** The most relevant log date for a status: completion date, else status date. */
export function getLogDate(status?: GameStatus): number {
  if (!status) return 0;
  const raw = status.completedDate || status.statusDate;
  if (!raw) return 0;
  const t = new Date(raw).getTime();
  return Number.isNaN(t) ? 0 : t;
}

/**
 * Games the user has "logged" — anything with a tracked status (or marked
 * endless) or a non-empty note — newest first. Entries without a date sort last.
 */
export function getLogEntries(
  statuses: Record<number, GameStatus | undefined>,
  notes: Record<number, string>,
): LogEntry[] {
  const appids = new Set<number>();

  for (const [id, status] of Object.entries(statuses)) {
    if (status && (status.status || status.isEndless)) appids.add(Number(id));
  }
  for (const [id, note] of Object.entries(notes)) {
    if (note && note.trim()) appids.add(Number(id));
  }

  return [...appids]
    .map((appid) => ({ appid, date: getLogDate(statuses[appid]) }))
    .sort((a, b) => b.date - a.date);
}
