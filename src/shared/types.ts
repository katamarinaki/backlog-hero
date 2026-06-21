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
}

export interface GameRating {
  positive: number;
  negative: number;
  score: number;
  total: number;
  description: string;
}

export interface GameCompletion {
  completed: boolean;
  completedDate?: string;
}

export type GameStatusType = 'completed' | 'in_progress' | 'dropped' | 'backlog';

export interface GameStatus {
  status?: GameStatusType;
  statusDate?: string;
  completedDate?: string;
  isEndless?: boolean;
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

export interface GameSession {
  id: string;
  appid: number;
  /** ISO date the session took place (yyyy-mm-dd). */
  date: string;
  /** Session length in minutes. */
  minutes: number;
  /** Optional 0-100 rating for this specific session. */
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
