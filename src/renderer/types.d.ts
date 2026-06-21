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

export type GameStatusType = 'backlog' | 'completed' | 'retired' | 'dropped';

export interface GameStatus {
  status?: GameStatusType;
  statusDate?: string;
  completedDate?: string;
}

export type StatusFilter =
  | 'all'
  | 'backlog'
  | 'completed'
  | 'retired'
  | 'dropped'
  | 'in_progress'
  | 'untracked';

export interface GameAchievements {
  achieved: number;
  total: number;
}

export interface GameSession {
  id: string;
  appid: number;
  date: string;
  minutes: number;
  rating?: number;
  notes?: string;
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
  resolveCovers: (appids: number[]) => Promise<Record<number, string>>;
  getLastFetchTimestamp: () => Promise<number>;
  fetchRatings: (appids: number[]) => Promise<Record<number, GameRating>>;
  fetchRating: (appid: number) => Promise<GameRating | null>;
  getRatings: () => Promise<Record<number, GameRating>>;
  getNotes: () => Promise<Record<number, string>>;
  saveNote: (appid: number, note: string) => Promise<boolean>;
  getUserRatings: () => Promise<Record<number, number>>;
  saveUserRating: (appid: number, rating: number) => Promise<boolean>;
  getCompletions: () => Promise<Record<number, GameCompletion>>;
  saveCompletion: (appid: number, completion: GameCompletion | null) => Promise<boolean>;
  getStatuses: () => Promise<Record<number, GameStatus>>;
  saveStatus: (appid: number, status: GameStatus | null) => Promise<boolean>;
  getSessions: () => Promise<Record<number, GameSession[]>>;
  saveSession: (appid: number, session: GameSession) => Promise<GameSession[]>;
  deleteSession: (appid: number, id: string) => Promise<GameSession[]>;
  getAchievements: () => Promise<Record<number, GameAchievements>>;
  fetchAchievements: (appids: number[]) => Promise<Record<number, GameAchievements>>;
  fetchAchievement: (appid: number) => Promise<GameAchievements | null>;
  getRatingTimestamp: (appid: number) => Promise<number | null>;
  getAchievementTimestamp: (appid: number) => Promise<number | null>;
  getFilterPreferences: () => Promise<FilterPreferences>;
  saveFilterPreferences: (preferences: FilterPreferences) => Promise<boolean>;
  exportData: () => Promise<boolean>;
  importData: () => Promise<boolean>;
  getBetaUpdates: () => Promise<boolean>;
  saveBetaUpdates: (useBeta: boolean) => Promise<boolean>;
  getIsPackaged: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  installUpdate: () => Promise<boolean>;
  onUpdaterLog: (callback: (msg: string) => void) => () => void;
  onUpdaterStatus: (
    callback: (status: {
      type: string;
      version?: string;
      message?: string;
      percent?: number;
    }) => void,
  ) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
