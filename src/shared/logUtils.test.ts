import { describe, it, expect } from 'vitest';

import { getRecentActivity, getLogEntries, getLogDate } from './logUtils';
import type { GameStatus, SteamGame } from './types';

function game(partial: Partial<SteamGame> & { appid: number }): SteamGame {
  return {
    name: `Game ${partial.appid}`,
    playtime_forever: 0,
    img_icon_url: '',
    img_logo_url: '',
    ...partial,
  };
}

describe('getRecentActivity', () => {
  it('keeps only games played in the last 2 weeks', () => {
    const games = [
      game({ appid: 1, playtime_2weeks: 120 }),
      game({ appid: 2 }), // no recent playtime
      game({ appid: 3, playtime_2weeks: 0 }), // zero recent playtime
    ];
    expect(getRecentActivity(games).map((g) => g.appid)).toEqual([1]);
  });

  it('sorts by most recently played, then by recent playtime', () => {
    const games = [
      game({ appid: 1, playtime_2weeks: 60, rtime_last_played: 100 }),
      game({ appid: 2, playtime_2weeks: 60, rtime_last_played: 300 }),
      game({ appid: 3, playtime_2weeks: 200, rtime_last_played: 300 }), // ties on last_played -> more playtime first
    ];
    expect(getRecentActivity(games).map((g) => g.appid)).toEqual([3, 2, 1]);
  });

  it('does not mutate the input array', () => {
    const games = [
      game({ appid: 1, playtime_2weeks: 10, rtime_last_played: 1 }),
      game({ appid: 2, playtime_2weeks: 10, rtime_last_played: 2 }),
    ];
    const copy = [...games];
    getRecentActivity(games);
    expect(games).toEqual(copy);
  });
});

describe('getLogDate', () => {
  it('prefers completedDate over statusDate', () => {
    const status: GameStatus = {
      status: 'completed',
      statusDate: '2024-01-01',
      completedDate: '2024-06-01',
    };
    expect(getLogDate(status)).toBe(new Date('2024-06-01').getTime());
  });

  it('returns 0 for undefined or dateless status', () => {
    expect(getLogDate(undefined)).toBe(0);
    expect(getLogDate({ status: 'backlog' })).toBe(0);
  });
});

describe('getLogEntries', () => {
  it('includes games with a tracked status, endless flag, or a note', () => {
    const statuses: Record<number, GameStatus | undefined> = {
      1: { status: 'completed', completedDate: '2024-03-01' },
      2: { isEndless: true },
      4: undefined,
    };
    const notes = { 3: 'great game', 5: '   ' };

    const entries = getLogEntries(statuses, notes);
    expect(entries.map((e) => e.appid).sort((a, b) => a - b)).toEqual([1, 2, 3]);
  });

  it('orders entries newest first, dateless entries last', () => {
    const statuses: Record<number, GameStatus | undefined> = {
      1: { status: 'completed', completedDate: '2024-01-01' },
      2: { status: 'completed', completedDate: '2024-12-01' },
      3: { status: 'backlog' }, // no date
    };
    expect(getLogEntries(statuses, {}).map((e) => e.appid)).toEqual([2, 1, 3]);
  });

  it('returns an empty array when nothing is logged', () => {
    expect(getLogEntries({}, {})).toEqual([]);
  });
});
