import { describe, it, expect } from 'vitest';

import { formatPlaytime } from './gameUtils';

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
