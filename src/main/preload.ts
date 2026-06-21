import { contextBridge, ipcRenderer } from 'electron';

import type {
  Settings,
  SteamGame,
  GameRating,
  GameCompletion,
  GameStatusType,
  GameStatus,
  StatusFilter,
  GameAchievements,
  FilterPreferences,
} from '../shared/types';

export type {
  Settings,
  SteamGame,
  GameRating,
  GameCompletion,
  GameStatusType,
  GameStatus,
  StatusFilter,
  GameAchievements,
  FilterPreferences,
};

contextBridge.exposeInMainWorld('electronAPI', {
  onRatingsProgress: (callback: (progress: { fetched: number; total: number }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: { fetched: number; total: number },
    ) => callback(progress);
    ipcRenderer.on('fetch-ratings-progress', handler);
    return () => ipcRenderer.removeListener('fetch-ratings-progress', handler);
  },
  onAchievementsProgress: (callback: (progress: { fetched: number; total: number }) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: { fetched: number; total: number },
    ) => callback(progress);
    ipcRenderer.on('fetch-achievements-progress', handler);
    return () => ipcRenderer.removeListener('fetch-achievements-progress', handler);
  },
  getSettings: (): Promise<Settings> => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: Settings): Promise<boolean> =>
    ipcRenderer.invoke('save-settings', settings),
  fetchGames: (): Promise<SteamGame[]> => ipcRenderer.invoke('fetch-games'),
  getGames: (): Promise<SteamGame[]> => ipcRenderer.invoke('get-games'),
  resolveCovers: (appids: number[]): Promise<Record<number, string>> =>
    ipcRenderer.invoke('resolve-covers', appids),
  getLastFetchTimestamp: (): Promise<number> => ipcRenderer.invoke('get-last-fetch-timestamp'),
  fetchRatings: (appids: number[]): Promise<Record<number, GameRating>> =>
    ipcRenderer.invoke('fetch-ratings', appids),
  fetchRating: (appid: number): Promise<GameRating | null> =>
    ipcRenderer.invoke('fetch-rating', appid),
  getRatings: (): Promise<Record<number, GameRating>> => ipcRenderer.invoke('get-ratings'),
  getNotes: (): Promise<Record<number, string>> => ipcRenderer.invoke('get-notes'),
  saveNote: (appid: number, note: string): Promise<boolean> =>
    ipcRenderer.invoke('save-note', { appid, note }),
  getUserRatings: (): Promise<Record<number, number>> => ipcRenderer.invoke('get-user-ratings'),
  saveUserRating: (appid: number, rating: number): Promise<boolean> =>
    ipcRenderer.invoke('save-user-rating', { appid, rating }),
  getCompletions: (): Promise<Record<number, GameCompletion>> =>
    ipcRenderer.invoke('get-completions'),
  saveCompletion: (appid: number, completion: GameCompletion | null): Promise<boolean> =>
    ipcRenderer.invoke('save-completion', { appid, completion }),
  getStatuses: (): Promise<Record<number, GameStatus>> => ipcRenderer.invoke('get-statuses'),
  saveStatus: (appid: number, status: GameStatus | null): Promise<boolean> =>
    ipcRenderer.invoke('save-status', { appid, status }),
  getAchievements: (): Promise<Record<number, GameAchievements>> =>
    ipcRenderer.invoke('get-achievements'),
  fetchAchievements: (appids: number[]): Promise<Record<number, GameAchievements>> =>
    ipcRenderer.invoke('fetch-achievements', appids),
  fetchAchievement: (appid: number): Promise<GameAchievements | null> =>
    ipcRenderer.invoke('fetch-achievement', appid),
  getRatingTimestamp: (appid: number): Promise<number | null> =>
    ipcRenderer.invoke('get-rating-timestamp', appid),
  getAchievementTimestamp: (appid: number): Promise<number | null> =>
    ipcRenderer.invoke('get-achievement-timestamp', appid),
  getFilterPreferences: (): Promise<FilterPreferences> =>
    ipcRenderer.invoke('get-filter-preferences'),
  saveFilterPreferences: (preferences: FilterPreferences): Promise<boolean> =>
    ipcRenderer.invoke('save-filter-preferences', preferences),
  exportData: (): Promise<boolean> => ipcRenderer.invoke('export-data'),
  importData: (): Promise<boolean> => ipcRenderer.invoke('import-data'),
  getBetaUpdates: (): Promise<boolean> => ipcRenderer.invoke('get-beta-updates'),
  saveBetaUpdates: (useBeta: boolean): Promise<boolean> =>
    ipcRenderer.invoke('save-beta-updates', useBeta),
  getIsPackaged: (): Promise<boolean> => ipcRenderer.invoke('get-is-packaged'),
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),
  installUpdate: (): Promise<boolean> => ipcRenderer.invoke('install-update'),
  onUpdaterLog: (callback: (msg: string) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, msg: string) => callback(msg);
    ipcRenderer.on('updater-log', handler);
    return () => ipcRenderer.removeListener('updater-log', handler);
  },
  onUpdaterStatus: (
    callback: (status: {
      type: string;
      version?: string;
      message?: string;
      percent?: number;
    }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      status: { type: string; version?: string; message?: string; percent?: number },
    ) => callback(status);
    ipcRenderer.on('updater-status', handler);
    return () => ipcRenderer.removeListener('updater-status', handler);
  },
});
