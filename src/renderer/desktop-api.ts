import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import { openUrl } from '@tauri-apps/plugin-opener';

import type {
  DesktopAPI,
  Settings,
  SteamGame,
  GameRating,
  GameCompletion,
  GameStatus,
  GameSession,
  GameAchievements,
  FilterPreferences,
  FetchProgress,
} from './types';

const request = <T>(operation: string, payload: unknown = null): Promise<T> =>
  invoke<T>('request', { operation, payload });

// Register before initial data loading. Cleanup also handles React StrictMode
// unmounting while Tauri's asynchronous listener registration is in flight.
function subscribe<T>(event: string, callback: (payload: T) => void): () => void {
  let disposed = false;
  let unlisten: (() => void) | undefined;
  void listen<T>(event, ({ payload }) => callback(payload))
    .then((stop) => {
      if (disposed) stop();
      else unlisten = stop;
    })
    .catch(console.error);
  return () => {
    disposed = true;
    unlisten?.();
  };
}

export const desktopAPI: DesktopAPI = {
  onRatingsProgress: (callback) => subscribe<FetchProgress>('fetch-ratings-progress', callback),
  onAchievementsProgress: (callback) =>
    subscribe<FetchProgress>('fetch-achievements-progress', callback),
  getSettings: (): Promise<Settings> => request('get-settings'),
  saveSettings: (settings: Settings): Promise<boolean> => request('save-settings', settings),
  fetchGames: (): Promise<SteamGame[]> => request('fetch-games'),
  getGames: (): Promise<SteamGame[]> => request('get-games'),
  resolveCovers: (appids: number[]): Promise<Record<number, string>> =>
    request('resolve-covers', appids),
  getLastFetchTimestamp: (): Promise<number> => request('get-last-fetch-timestamp'),
  fetchRatings: (appids: number[]): Promise<Record<number, GameRating>> =>
    request('fetch-ratings', appids),
  fetchRating: (appid: number): Promise<GameRating | null> => request('fetch-rating', appid),
  getRatings: (): Promise<Record<number, GameRating>> => request('get-ratings'),
  getNotes: (): Promise<Record<number, string>> => request('get-notes'),
  saveNote: (appid: number, note: string): Promise<boolean> =>
    request('save-note', { appid, note }),
  getUserRatings: (): Promise<Record<number, number>> => request('get-user-ratings'),
  saveUserRating: (appid: number, rating: number): Promise<boolean> =>
    request('save-user-rating', { appid, rating }),
  getCompletions: (): Promise<Record<number, GameCompletion>> => request('get-completions'),
  saveCompletion: (appid: number, completion: GameCompletion | null): Promise<boolean> =>
    request('save-completion', { appid, completion }),
  getSessions: (): Promise<Record<number, GameSession[]>> => request('get-sessions'),
  saveSession: (appid: number, session: GameSession): Promise<GameSession[]> =>
    request('save-session', { appid, session }),
  deleteSession: (appid: number, id: string): Promise<GameSession[]> =>
    request('delete-session', { appid, id }),
  getStatuses: (): Promise<Record<number, GameStatus>> => request('get-statuses'),
  saveStatus: (appid: number, status: GameStatus | null): Promise<boolean> =>
    request('save-status', { appid, status }),
  getAchievements: (): Promise<Record<number, GameAchievements>> => request('get-achievements'),
  fetchAchievements: (appids: number[]): Promise<Record<number, GameAchievements>> =>
    request('fetch-achievements', appids),
  fetchAchievement: (appid: number): Promise<GameAchievements | null> =>
    request('fetch-achievement', appid),
  getRatingTimestamp: (appid: number): Promise<number | null> =>
    request('get-rating-timestamp', appid),
  getAchievementTimestamp: (appid: number): Promise<number | null> =>
    request('get-achievement-timestamp', appid),
  getFilterPreferences: (): Promise<FilterPreferences> => request('get-filter-preferences'),
  saveFilterPreferences: (preferences: FilterPreferences): Promise<boolean> =>
    request('save-filter-preferences', preferences),
  exportData: (): Promise<boolean> => request('export-data'),
  importData: (): Promise<boolean> => request('import-data'),
  getBetaUpdates: (): Promise<boolean> => request('get-beta-updates'),
  saveBetaUpdates: (useBeta: boolean): Promise<boolean> => request('save-beta-updates', useBeta),
  getIsPackaged: (): Promise<boolean> => request('get-is-packaged'),
  getAppVersion: (): Promise<string> => request('get-app-version'),
  installUpdate: (): Promise<boolean> => request('install-update'),
  onUpdaterStatus: (callback) => {
    const stop = subscribe<Parameters<typeof callback>[0]>('updater-status', callback);
    void request<Parameters<typeof callback>[0]>('get-updater-status')
      .then(callback)
      .catch(console.error);
    return stop;
  },
};

window.desktopAPI = desktopAPI;

// Route links through the scoped OS opener instead of creating webview windows.
document.addEventListener('click', (event) => {
  const anchor = (event.target as Element | null)?.closest('a[href]');
  if (!(anchor instanceof HTMLAnchorElement) || !/^https?:/.test(anchor.href)) return;
  if (event.defaultPrevented || anchor.origin === location.origin) return;
  event.preventDefault();
  void openUrl(anchor.href).catch(console.error);
});
