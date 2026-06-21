/** Don't auto-fetch library more than once every 6 hours */
export const STALE_THRESHOLD_MS = 6 * 60 * 60 * 1000;

export function isFetchStale(lastFetchTimestamp: number, now?: number): boolean {
  return (now ?? Date.now()) - lastFetchTimestamp >= STALE_THRESHOLD_MS;
}

export function formatPlaytime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  const hourLabel = hours === 1 ? 'hr' : 'hrs';
  if (remaining === 0) {
    return `${hours.toLocaleString()} ${hourLabel}`;
  }
  return `${hours.toLocaleString()} ${hourLabel} ${remaining} min`;
}
