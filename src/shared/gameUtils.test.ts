import { describe, it, expect } from 'vitest';

import { formatPlaytime, isFetchStale, STALE_THRESHOLD_MS } from './gameUtils';

// ──────────────────────────────────────────────
// isFetchStale
// ──────────────────────────────────────────────

describe('isFetchStale', () => {
  it('returns false when timestamp is recent', () => {
    const justNow = Date.now() - 1000; // 1 second ago
    expect(isFetchStale(justNow, Date.now())).toBe(false);
  });

  it('returns false when timestamp is exactly at the threshold', () => {
    const now = Date.now();
    const atThreshold = now - STALE_THRESHOLD_MS;
    expect(isFetchStale(atThreshold, now)).toBe(false);
  });

  it('returns true when timestamp is older than threshold', () => {
    const now = Date.now();
    const old = now - STALE_THRESHOLD_MS - 1;
    expect(isFetchStale(old, now)).toBe(true);
  });

  it('returns true when timestamp is 0 (never fetched)', () => {
    expect(isFetchStale(0, Date.now())).toBe(true);
  });

  it('uses current time when now is not provided', () => {
    expect(isFetchStale(0)).toBe(true);
    expect(isFetchStale(Date.now())).toBe(false);
  });
});

// ──────────────────────────────────────────────
// formatPlaytime
// ──────────────────────────────────────────────

describe('formatPlaytime', () => {
  it('formats values under 60 minutes', () => {
    expect(formatPlaytime(0)).toBe('0 min');
    expect(formatPlaytime(30)).toBe('30 min');
    expect(formatPlaytime(59)).toBe('59 min');
  });

  it('formats whole hours', () => {
    expect(formatPlaytime(60)).toBe('1 hr');
    expect(formatPlaytime(120)).toBe('2 hrs');
    expect(formatPlaytime(600)).toBe('10 hrs');
    expect(formatPlaytime(6000)).toBe('100 hrs');
  });

  it('formats hours with remaining minutes', () => {
    expect(formatPlaytime(90)).toBe('1 hr 30 min');
    expect(formatPlaytime(125)).toBe('2 hrs 5 min');
  });
});
