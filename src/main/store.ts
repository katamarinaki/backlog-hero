import Store from 'electron-store';

import type {
  FilterPreferences,
  GameAchievements,
  GameCompletion,
  GameRating,
  GameSession,
  GameStatus,
  SteamGame,
} from '../shared/types';

export interface StoreSchema {
  apiKey: string;
  steamId: string;
  games: SteamGame[];
  ratings: Record<number, GameRating>;
  ratingTimestamps: Record<number, number>;
  userRatings: Record<number, number>;
  notes: Record<number, string>;
  completions: Record<number, GameCompletion>;
  statuses: Record<number, GameStatus>;
  achievements: Record<number, GameAchievements>;
  achievementTimestamps: Record<number, number>;
  coverUrls: Record<number, string>;
  sessions: Record<number, GameSession[]>;
  filterPreferences: FilterPreferences;
  useBetaUpdates: boolean;
  lastFetchTimestamp: number;
}

export const STORE_DEFAULTS: StoreSchema = {
  apiKey: '',
  steamId: '',
  games: [],
  ratings: {},
  ratingTimestamps: {},
  userRatings: {},
  notes: {},
  completions: {},
  statuses: {},
  achievements: {},
  achievementTimestamps: {},
  coverUrls: {},
  sessions: {},
  filterPreferences: {
    statusFilter: 'all',
    sortBy: 'playtime',
    sortAsc: false,
  },
  useBetaUpdates: false,
  lastFetchTimestamp: 0,
};

export const store = new Store<StoreSchema>({ defaults: STORE_DEFAULTS });
