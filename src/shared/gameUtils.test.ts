import { describe, it, expect } from 'vitest';

import { filterAndSortGames, formatPlaytime } from './gameUtils';
import type { SteamGame, GameRating, GameCompletion } from './types';

function makeGame(overrides: Partial<SteamGame> & { appid: number; name: string }): SteamGame {
  return {
    playtime_forever: 0,
    img_icon_url: '',
    img_logo_url: '',
    ...overrides,
  };
}

function makeRating(score: number): GameRating {
  return {
    positive: score,
    negative: 100 - score,
    score,
    total: 100,
    description: score >= 70 ? 'Very Positive' : 'Mixed',
  };
}

function makeCompletion(completed: boolean, date?: string): GameCompletion {
  return { completed, completedDate: date };
}

const games: SteamGame[] = [
  makeGame({ appid: 1, name: 'Zelda', playtime_forever: 120, rtime_last_played: 1000 }),
  makeGame({ appid: 2, name: 'Apex Legends', playtime_forever: 500, rtime_last_played: 3000 }),
  makeGame({ appid: 3, name: 'Balatro', playtime_forever: 60, rtime_last_played: 2000 }),
  makeGame({ appid: 4, name: 'Dark Souls', playtime_forever: 200, rtime_last_played: undefined }),
];

const ratings: Record<number, GameRating> = {
  1: makeRating(95),
  2: makeRating(70),
  3: makeRating(80),
  // 4 (Dark Souls) has no rating
};

const completions: Record<number, GameCompletion> = {
  1: makeCompletion(true, '2024-01-01'),
  2: makeCompletion(false),
  // 3 (Balatro) and 4 (Dark Souls) have no completion entry
};

const defaults = {
  ratings,
  completions,
  searchQuery: '',
  completionFilter: 'all' as const,
  sortBy: 'playtime' as const,
  sortAsc: false,
};

// ──────────────────────────────────────────────
// Filters
// ──────────────────────────────────────────────

describe('filterAndSortGames — filters', () => {
  it('returns all games when no filter applied', () => {
    const result = filterAndSortGames({ games, ...defaults });
    expect(result).toHaveLength(4);
  });

  it('filters by search query (case-insensitive)', () => {
    const result = filterAndSortGames({ games, ...defaults, searchQuery: 'apex' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Apex Legends');
  });

  it('ignores whitespace-only search queries', () => {
    const result = filterAndSortGames({ games, ...defaults, searchQuery: '   ' });
    expect(result).toHaveLength(4);
  });

  it('filters by completed status', () => {
    const result = filterAndSortGames({ games, ...defaults, completionFilter: 'completed' });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Zelda');
  });

  it('filters by not-completed status', () => {
    const result = filterAndSortGames({ games, ...defaults, completionFilter: 'not_completed' });
    // Dark Souls and Balatro have no entry → treated as not-completed
    // Apex Legends is explicitly not completed
    expect(result.map((g) => g.appid).sort()).toEqual([2, 3, 4]);
  });

  it('combines search query with completion filter', () => {
    const result = filterAndSortGames({
      games,
      ...defaults,
      searchQuery: 'bal',
      completionFilter: 'not_completed',
    });
    // 'bal' matches only Balatro, which has no completion entry → not completed
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Balatro');
  });
});

// ──────────────────────────────────────────────
// Sorting
// ──────────────────────────────────────────────

describe('filterAndSortGames — sorting', () => {
  it('sorts by playtime descending (default)', () => {
    const result = filterAndSortGames({ games, ...defaults });
    expect(result.map((g) => g.name)).toEqual([
      'Apex Legends',
      'Dark Souls',
      'Zelda',
      'Balatro',
    ]);
  });

  it('sorts by playtime ascending', () => {
    const result = filterAndSortGames({ games, ...defaults, sortAsc: true });
    expect(result.map((g) => g.name)).toEqual([
      'Balatro',
      'Zelda',
      'Dark Souls',
      'Apex Legends',
    ]);
  });

  it('sorts by name ascending', () => {
    const result = filterAndSortGames({ games, ...defaults, sortBy: 'name', sortAsc: false });
    expect(result.map((g) => g.name)).toEqual([
      'Apex Legends',
      'Balatro',
      'Dark Souls',
      'Zelda',
    ]);
  });

  it('sorts by name descending', () => {
    const result = filterAndSortGames({ games, ...defaults, sortBy: 'name', sortAsc: true });
    expect(result.map((g) => g.name)).toEqual([
      'Zelda',
      'Dark Souls',
      'Balatro',
      'Apex Legends',
    ]);
  });

  it('sorts by rating descending', () => {
    const result = filterAndSortGames({
      games,
      ...defaults,
      sortBy: 'rating',
      sortAsc: false,
    });
    // Zelda(95), Balatro(80), Apex(70), Dark Souls (no rating → score -1)
    expect(result.map((g) => g.name)).toEqual([
      'Zelda',
      'Balatro',
      'Apex Legends',
      'Dark Souls',
    ]);
  });

  it('sorts by rating ascending', () => {
    const result = filterAndSortGames({
      games,
      ...defaults,
      sortBy: 'rating',
      sortAsc: true,
    });
    expect(result.map((g) => g.name)).toEqual([
      'Dark Souls',
      'Apex Legends',
      'Balatro',
      'Zelda',
    ]);
  });

  it('sorts by last_played descending', () => {
    const result = filterAndSortGames({
      games,
      ...defaults,
      sortBy: 'last_played',
      sortAsc: false,
    });
    // Apex(3000), Balatro(2000), Zelda(1000), Dark Souls(undefined → 0)
    expect(result.map((g) => g.name)).toEqual([
      'Apex Legends',
      'Balatro',
      'Zelda',
      'Dark Souls',
    ]);
  });

  it('sorts by last_played ascending', () => {
    const result = filterAndSortGames({
      games,
      ...defaults,
      sortBy: 'last_played',
      sortAsc: true,
    });
    expect(result.map((g) => g.name)).toEqual([
      'Dark Souls',
      'Zelda',
      'Balatro',
      'Apex Legends',
    ]);
  });

  it('pushes games without rating to the end on rating sort', () => {
    // Dark Souls has no rating → score -1, should be last
    const result = filterAndSortGames({
      games,
      ...defaults,
      sortBy: 'rating',
      sortAsc: false,
    });
    expect(result[result.length - 1].name).toBe('Dark Souls');
  });

  it('pushes games without last_played to the end on last_played sort', () => {
    const result = filterAndSortGames({
      games,
      ...defaults,
      sortBy: 'last_played',
      sortAsc: false,
    });
    expect(result[result.length - 1].name).toBe('Dark Souls');
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
