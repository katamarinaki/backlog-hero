import { describe, it, expect } from 'vitest';

import {
  getRecentActivity,
  getLogEntries,
  getLogDate,
  buildLibraryCapsuleUrl,
  STORE_ASSET_BASE,
  getSuggestedSessionMinutes,
  computeSharedRating,
} from './logUtils';
import type { GameSession, GameStatus, SteamGame } from './types';

function session(partial: Partial<GameSession> & { minutes: number; date: string }): GameSession {
  return { id: 'x', appid: 1, ...partial };
}

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

describe('buildLibraryCapsuleUrl', () => {
  it('substitutes the filename into the asset url format (new hashed assets)', () => {
    expect(
      buildLibraryCapsuleUrl(
        'steam/apps/2215200/${FILENAME}?t=1780591479',
        'f40c725261e949ef758d80bb067d09794635927e/library_capsule.jpg',
      ),
    ).toBe(
      STORE_ASSET_BASE +
        'steam/apps/2215200/f40c725261e949ef758d80bb067d09794635927e/library_capsule.jpg?t=1780591479',
    );
  });

  it('works for older plain library_600x900 assets', () => {
    expect(buildLibraryCapsuleUrl('steam/apps/730/${FILENAME}?t=1', 'library_600x900.jpg')).toBe(
      STORE_ASSET_BASE + 'steam/apps/730/library_600x900.jpg?t=1',
    );
  });

  it('returns null when either field is missing', () => {
    expect(buildLibraryCapsuleUrl(undefined, 'x.jpg')).toBeNull();
    expect(buildLibraryCapsuleUrl('steam/apps/1/${FILENAME}', undefined)).toBeNull();
  });
});

describe('getSuggestedSessionMinutes', () => {
  const now = new Date('2024-06-20T12:00:00Z').getTime();

  it('subtracts recently-logged sessions from the 2-week playtime', () => {
    const sessions = [
      session({ minutes: 90, date: '2024-06-19' }),
      session({ minutes: 30, date: '2024-06-15' }),
    ];
    expect(getSuggestedSessionMinutes(300, sessions, now)).toBe(180);
  });

  it('ignores sessions older than two weeks', () => {
    const sessions = [session({ minutes: 120, date: '2024-05-01' })];
    expect(getSuggestedSessionMinutes(300, sessions, now)).toBe(300);
  });

  it('never goes negative and handles missing playtime', () => {
    const sessions = [session({ minutes: 500, date: '2024-06-19' })];
    expect(getSuggestedSessionMinutes(300, sessions, now)).toBe(0);
    expect(getSuggestedSessionMinutes(0, [], now)).toBe(0);
  });
});

describe('computeSharedRating', () => {
  it('uses the session rating when there is no current rating', () => {
    expect(computeSharedRating(null, 80)).toBe(80);
    expect(computeSharedRating(undefined, 0)).toBe(0);
  });

  it('averages the current rating (as one session) with the new session', () => {
    expect(computeSharedRating(80, 100)).toBe(90);
    expect(computeSharedRating(0, 50)).toBe(25);
  });

  it('rounds to the nearest integer', () => {
    expect(computeSharedRating(81, 100)).toBe(91); // 90.5 -> 91
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
