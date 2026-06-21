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
