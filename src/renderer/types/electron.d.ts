export interface Settings {
  apiKey: string;
  steamId: string;
}

export interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  img_logo_url: string;
  playtime_2weeks?: number;
  rtime_last_played?: number;
  rating?: GameRating;
}

export interface GameRating {
  positive: number;
  negative: number;
  score: number; // percentage positive
  total: number;
  description: string; // "Very Positive", "Mixed", etc.
}

export interface GameCompletion {
  completed: boolean;
  completedDate?: string; // ISO date string
}

export interface GameAchievements {
  achieved: number;
  total: number;
}

export interface FilterPreferences {
  completionFilter: 'all' | 'completed' | 'not_completed';
  sortBy: 'playtime' | 'name' | 'rating' | 'last_played';
  sortAsc: boolean;
}

export interface ElectronAPI {
  getSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<boolean>;
  fetchGames: () => Promise<SteamGame[]>;
  getGames: () => Promise<SteamGame[]>;
  fetchRatings: (appids: number[]) => Promise<Record<number, GameRating>>;
  getRatings: () => Promise<Record<number, GameRating>>;
  getNotes: () => Promise<Record<number, string>>;
  saveNote: (appid: number, note: string) => Promise<boolean>;
  getCompletions: () => Promise<Record<number, GameCompletion>>;
  saveCompletion: (appid: number, completion: GameCompletion | null) => Promise<boolean>;
  getAchievements: () => Promise<Record<number, GameAchievements>>;
  fetchAchievements: (appids: number[]) => Promise<Record<number, GameAchievements>>;
  getFilterPreferences: () => Promise<FilterPreferences>;
  saveFilterPreferences: (preferences: FilterPreferences) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
