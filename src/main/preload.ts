import { contextBridge, ipcRenderer } from 'electron';

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

export interface GameAchievements {
  achieved: number;
  total: number;
}

export interface FilterPreferences {
  completionFilter: 'all' | 'completed' | 'not_completed';
  sortBy: 'playtime' | 'name' | 'rating' | 'last_played';
  sortAsc: boolean;
}

contextBridge.exposeInMainWorld('electronAPI', {
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings): Promise<boolean> =>
    ipcRenderer.invoke('save-settings', settings),
  fetchGames: (): Promise<SteamGame[]> => ipcRenderer.invoke('fetch-games'),
  getGames: (): Promise<SteamGame[]> => ipcRenderer.invoke('get-games'),
  fetchRatings: (appids: number[]): Promise<Record<number, GameRating>> =>
    ipcRenderer.invoke('fetch-ratings', appids),
  getRatings: (): Promise<Record<number, GameRating>> => ipcRenderer.invoke('get-ratings'),
  getNotes: (): Promise<Record<number, string>> => ipcRenderer.invoke('get-notes'),
  saveNote: (appid: number, note: string): Promise<boolean> =>
    ipcRenderer.invoke('save-note', { appid, note }),
  getCompletions: (): Promise<Record<number, GameCompletion>> =>
    ipcRenderer.invoke('get-completions'),
  saveCompletion: (appid: number, completion: GameCompletion | null): Promise<boolean> =>
    ipcRenderer.invoke('save-completion', { appid, completion }),
  getAchievements: (): Promise<Record<number, GameAchievements>> =>
    ipcRenderer.invoke('get-achievements'),
  fetchAchievements: (appids: number[]): Promise<Record<number, GameAchievements>> =>
    ipcRenderer.invoke('fetch-achievements', appids),
  getFilterPreferences: (): Promise<FilterPreferences> =>
    ipcRenderer.invoke('get-filter-preferences'),
  saveFilterPreferences: (preferences: FilterPreferences): Promise<boolean> =>
    ipcRenderer.invoke('save-filter-preferences', preferences),
  exportData: (): Promise<boolean> => ipcRenderer.invoke('export-data'),
  importData: (): Promise<boolean> => ipcRenderer.invoke('import-data'),
});
