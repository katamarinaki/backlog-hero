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

export type GameStatusType = 'completed' | 'in_progress' | 'dropped' | 'backlog';

export interface GameStatus {
  status?: GameStatusType; // Optional - endless games may have no status
  statusDate?: string; // When status was last changed
  completedDate?: string; // Specific to 'completed' status
  isEndless?: boolean; // Games without campaigns that can't be completed
}

export type StatusFilter =
  | 'all'
  | 'completed'
  | 'in_progress'
  | 'dropped'
  | 'backlog'
  | 'untracked'
  | 'endless';

export interface GameAchievements {
  achieved: number;
  total: number;
}

export interface FilterPreferences {
  statusFilter: StatusFilter;
  sortBy: 'playtime' | 'name' | 'rating' | 'last_played' | 'status_date';
  sortAsc: boolean;
}

export interface FetchProgress {
  fetched: number;
  total: number;
}

export interface ElectronAPI {
  onRatingsProgress: (callback: (progress: FetchProgress) => void) => () => void;
  onAchievementsProgress: (callback: (progress: FetchProgress) => void) => () => void;
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
  getStatuses: () => Promise<Record<number, GameStatus>>;
  saveStatus: (appid: number, status: GameStatus | null) => Promise<boolean>;
  getAchievements: () => Promise<Record<number, GameAchievements>>;
  fetchAchievements: (appids: number[]) => Promise<Record<number, GameAchievements>>;
  getFilterPreferences: () => Promise<FilterPreferences>;
  saveFilterPreferences: (preferences: FilterPreferences) => Promise<boolean>;
  exportData: () => Promise<boolean>;
  importData: () => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
