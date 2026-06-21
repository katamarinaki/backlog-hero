import * as path from 'path';
import * as fs from 'fs/promises';

import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';

import type {
  FilterPreferences,
  GameAchievements,
  GameCompletion,
  GameRating,
  GameSession,
  GameStatus,
} from '../shared/types';

import { store, STORE_DEFAULTS, type StoreSchema } from './store';
import { migrateCompletionsToStatuses } from './migration';
import { initAutoUpdater, toggleBetaFeed, installUpdate } from './updater';
import {
  fetchOwnedGames,
  fetchGameRating,
  fetchGameAchievements,
  fetchCoverUrls,
} from './steam-api';

// --- Debug IPC ---

ipcMain.handle('get-is-packaged', () => app.isPackaged);
ipcMain.handle('get-app-version', () => app.getVersion());
ipcMain.handle('install-update', () => installUpdate());

// --- Startup migration ---

migrateCompletionsToStatuses();

// --- Window management ---

let mainWindow: BrowserWindow | null = null;

app.setName('Backlog Hero');
app.setAboutPanelOptions({
  applicationName: 'Backlog Hero',
  applicationVersion: app.getVersion(),
  credits: 'Backlog Hero',
});

const ALLOWED_EXTERNAL_HOSTS = [
  'store.steampowered.com',
  'steamcommunity.com',
  'github.com',
  'steamid.io',
];

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Route external links to the system browser (security)
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      try {
        if (ALLOWED_EXTERNAL_HOSTS.includes(new URL(url).hostname)) {
          shell.openExternal(url);
        } else {
          console.log('Blocked external link (host not in allowlist):', url);
        }
      } catch {
        console.log('Blocked external link (malformed URL):', url);
      }
    }
    return { action: 'deny' };
  });

  // Prevent in-app navigation away from the app (allow dev server)
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const allowed =
      process.env.NODE_ENV === 'development'
        ? url.startsWith('http://localhost:5173')
        : url.startsWith('file://');
    if (!allowed) {
      event.preventDefault();
    }
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// --- App lifecycle ---

app.whenReady().then(() => {
  createWindow();
  initAutoUpdater();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// --- IPC: Settings ---

ipcMain.handle('get-settings', () => ({
  apiKey: store.get('apiKey'),
  steamId: store.get('steamId'),
}));

ipcMain.handle('save-settings', (_, settings: unknown) => {
  if (
    !settings ||
    typeof settings !== 'object' ||
    typeof (settings as Record<string, unknown>).apiKey !== 'string' ||
    typeof (settings as Record<string, unknown>).steamId !== 'string'
  ) {
    throw new Error('Invalid settings: apiKey and steamId must be strings');
  }
  const apiKey = (settings as { apiKey: string }).apiKey.trim();
  const steamId = (settings as { steamId: string }).steamId.trim();
  if (!apiKey || !steamId) {
    throw new Error('API key and Steam ID must not be empty');
  }
  store.set('apiKey', apiKey);
  store.set('steamId', steamId);
  return true;
});

// --- IPC: Beta updates ---

ipcMain.handle('get-beta-updates', () => store.get('useBetaUpdates', false));

ipcMain.handle('save-beta-updates', (_, useBeta: unknown) => {
  if (typeof useBeta !== 'boolean') {
    throw new Error('useBeta must be a boolean');
  }
  store.set('useBetaUpdates', useBeta);

  if (app.isPackaged) {
    toggleBetaFeed(useBeta);
  }
  return true;
});

// --- IPC: Games ---

ipcMain.handle('fetch-games', async () => {
  const apiKey = store.get('apiKey');
  const steamId = store.get('steamId');

  if (!apiKey || !steamId) {
    throw new Error('API key and Steam ID are required');
  }

  const games = await fetchOwnedGames(apiKey, steamId);
  store.set('games', games);
  store.set('lastFetchTimestamp', Date.now());
  return games;
});

ipcMain.handle('get-games', () => store.get('games'));

// Resolves vertical cover URLs (cached), fetching only the appids we don't know yet.
ipcMain.handle('resolve-covers', async (_, appids: unknown) => {
  if (!Array.isArray(appids)) {
    throw new Error('appids must be an array');
  }
  const ids = appids.filter((id): id is number => typeof id === 'number');
  const cached = store.get('coverUrls', {});
  const missing = ids.filter((id) => !(id in cached));

  if (missing.length === 0) return cached;

  try {
    const fetched = await fetchCoverUrls(missing);
    const merged = { ...cached, ...fetched };
    store.set('coverUrls', merged);
    return merged;
  } catch (err) {
    console.error('Failed to resolve cover URLs:', err);
    return cached;
  }
});

ipcMain.handle('get-last-fetch-timestamp', () => store.get('lastFetchTimestamp', 0));

// --- IPC: Ratings ---

ipcMain.handle('fetch-ratings', async (event, appids: number[]) => {
  const cachedRatings = store.get('ratings') || {};
  const newRatings: Record<number, GameRating> = { ...cachedRatings };
  const toFetch = appids.filter((id) => !cachedRatings[id]);
  const total = toFetch.length;
  let fetched = 0;

  const batchSize = 5;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (appid) => {
        const rating = await fetchGameRating(appid);
        fetched++;
        event.sender.send('fetch-ratings-progress', { fetched, total });
        return { appid, rating };
      }),
    );
    for (const { appid, rating } of results) {
      if (rating) newRatings[appid] = rating;
    }
    if (i + batchSize < toFetch.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  store.set('ratings', newRatings);
  return newRatings;
});

ipcMain.handle('fetch-rating', async (_, appid: number) => {
  const apiKey = store.get('apiKey');
  const steamId = store.get('steamId');
  if (!apiKey || !steamId) throw new Error('API key and Steam ID are required');

  const cached = (store.get('ratings') || {}) as Record<number, GameRating>;
  if (cached[appid]) return cached[appid];

  const rating = await fetchGameRating(appid);
  if (rating) {
    const ratings = store.get('ratings') || {};
    ratings[appid] = rating;
    store.set('ratings', ratings);

    const timestamps = store.get('ratingTimestamps') || {};
    timestamps[appid] = Date.now();
    store.set('ratingTimestamps', timestamps);
  }
  return rating;
});

ipcMain.handle('get-ratings', () => store.get('ratings') || {});

ipcMain.handle('get-rating-timestamp', (_, appid: number) => {
  const timestamps = store.get('ratingTimestamps') || {};
  return timestamps[appid] || null;
});

// --- IPC: Notes ---

ipcMain.handle('get-notes', () => store.get('notes') || {});

ipcMain.handle('save-note', (_, { appid, note }: { appid: number; note: string }) => {
  const notes = store.get('notes') || {};
  notes[appid] = note;
  store.set('notes', notes);
  return true;
});

// --- IPC: User ratings ---

ipcMain.handle('get-user-ratings', () => store.get('userRatings') || {});

ipcMain.handle('save-user-rating', (_, { appid, rating }: { appid: number; rating: number }) => {
  if (rating < 0 || rating > 100 || !Number.isInteger(rating)) {
    throw new Error('Rating must be an integer between 0 and 100');
  }
  const userRatings = store.get('userRatings') || {};
  userRatings[appid] = rating;
  store.set('userRatings', userRatings);
  return true;
});

// --- IPC: Completions (legacy) ---

ipcMain.handle('get-completions', () => store.get('completions') || {});

ipcMain.handle(
  'save-completion',
  (_, { appid, completion }: { appid: number; completion: GameCompletion | null }) => {
    const completions = store.get('completions') || {};
    if (completion === null) {
      delete completions[appid];
    } else {
      completions[appid] = completion;
    }
    store.set('completions', completions);
    return true;
  },
);

// --- IPC: Statuses ---

ipcMain.handle('get-statuses', () => store.get('statuses') || {});

ipcMain.handle(
  'save-status',
  (_, { appid, status }: { appid: number; status: GameStatus | null }) => {
    const statuses = store.get('statuses') || {};
    if (status === null) {
      delete statuses[appid];
    } else {
      statuses[appid] = status;
    }
    store.set('statuses', statuses);
    return true;
  },
);

// --- IPC: Sessions (gaming-session log) ---

ipcMain.handle('get-sessions', () => store.get('sessions') || {});

ipcMain.handle('save-session', (_, { appid, session }: { appid: number; session: GameSession }) => {
  if (typeof appid !== 'number' || !session || typeof session.id !== 'string') {
    throw new Error('Invalid session payload');
  }
  const sessions = store.get('sessions') || {};
  const list = sessions[appid] ? [...sessions[appid]] : [];
  const existingIndex = list.findIndex((s) => s.id === session.id);
  if (existingIndex >= 0) {
    list[existingIndex] = session;
  } else {
    list.push(session);
  }
  sessions[appid] = list;
  store.set('sessions', sessions);
  return list;
});

ipcMain.handle('delete-session', (_, { appid, id }: { appid: number; id: string }) => {
  const sessions = store.get('sessions') || {};
  const list = (sessions[appid] || []).filter((s) => s.id !== id);
  if (list.length > 0) {
    sessions[appid] = list;
  } else {
    delete sessions[appid];
  }
  store.set('sessions', sessions);
  return list;
});

// --- IPC: Achievements ---

ipcMain.handle('fetch-achievements', async (event, appids: number[]) => {
  const apiKey = store.get('apiKey');
  const steamId = store.get('steamId');
  if (!apiKey || !steamId) throw new Error('API key and Steam ID are required');

  const cachedAchievements = store.get('achievements') || {};
  const newAchievements: Record<number, GameAchievements> = { ...cachedAchievements };
  const toFetch = appids.filter((id) => !cachedAchievements[id]);
  const total = toFetch.length;
  let fetched = 0;

  const batchSize = 5;
  for (let i = 0; i < toFetch.length; i += batchSize) {
    const batch = toFetch.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async (appid) => {
        const achievements = await fetchGameAchievements(appid, apiKey, steamId);
        fetched++;
        event.sender.send('fetch-achievements-progress', { fetched, total });
        return { appid, achievements };
      }),
    );
    for (const { appid, achievements } of results) {
      if (achievements) newAchievements[appid] = achievements;
    }
    if (i + batchSize < toFetch.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  store.set('achievements', newAchievements);
  return newAchievements;
});

ipcMain.handle('fetch-achievement', async (_, appid: number) => {
  const apiKey = store.get('apiKey');
  const steamId = store.get('steamId');
  if (!apiKey || !steamId) throw new Error('API key and Steam ID are required');

  const cached = (store.get('achievements') || {}) as Record<number, GameAchievements>;
  if (cached[appid]) return cached[appid];

  const achievement = await fetchGameAchievements(appid, apiKey, steamId);
  if (achievement) {
    const achievements = store.get('achievements') || {};
    achievements[appid] = achievement;
    store.set('achievements', achievements);

    const timestamps = store.get('achievementTimestamps') || {};
    timestamps[appid] = Date.now();
    store.set('achievementTimestamps', timestamps);
  }
  return achievement;
});

ipcMain.handle('get-achievements', () => store.get('achievements') || {});

ipcMain.handle('get-achievement-timestamp', (_, appid: number) => {
  const timestamps = store.get('achievementTimestamps') || {};
  return timestamps[appid] || null;
});

// --- IPC: Filter preferences ---

ipcMain.handle('get-filter-preferences', () => store.get('filterPreferences'));

ipcMain.handle('save-filter-preferences', (_, preferences: FilterPreferences) => {
  store.set('filterPreferences', preferences);
  return true;
});

// --- IPC: Backup / Restore ---

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeFilterPreferences(value: unknown): FilterPreferences | null {
  if (!isObject(value)) return null;

  const statusFilterValues = [
    'all',
    'completed',
    'in_progress',
    'dropped',
    'backlog',
    'untracked',
    'endless',
  ] as const;
  const sortByValues = ['playtime', 'name', 'rating', 'last_played', 'status_date'] as const;

  const { statusFilter, sortBy, sortAsc } = value;
  if (
    !statusFilterValues.includes(statusFilter as FilterPreferences['statusFilter']) ||
    !sortByValues.includes(sortBy as FilterPreferences['sortBy']) ||
    typeof sortAsc !== 'boolean'
  ) {
    return null;
  }

  return {
    statusFilter: statusFilter as FilterPreferences['statusFilter'],
    sortBy: sortBy as FilterPreferences['sortBy'],
    sortAsc,
  };
}

function getBackupData(): StoreSchema {
  return {
    apiKey: store.get('apiKey'),
    steamId: store.get('steamId'),
    games: store.get('games'),
    ratings: store.get('ratings'),
    ratingTimestamps: store.get('ratingTimestamps'),
    userRatings: store.get('userRatings'),
    notes: store.get('notes'),
    completions: store.get('completions'),
    statuses: store.get('statuses'),
    achievements: store.get('achievements'),
    achievementTimestamps: store.get('achievementTimestamps'),
    coverUrls: store.get('coverUrls'),
    sessions: store.get('sessions'),
    filterPreferences: store.get('filterPreferences'),
    useBetaUpdates: store.get('useBetaUpdates', false),
    lastFetchTimestamp: store.get('lastFetchTimestamp', 0),
  };
}

ipcMain.handle('export-data', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Backlog Hero Data',
    defaultPath: path.join(app.getPath('documents'), 'backlog-hero-backup.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (canceled || !filePath) return false;

  const data = getBackupData();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
  return true;
});

ipcMain.handle('import-data', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import Backlog Hero Data',
    properties: ['openFile'],
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (canceled || filePaths.length === 0) return false;

  const raw = await fs.readFile(filePaths[0], 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!isObject(parsed)) {
    throw new Error('Invalid backup file.');
  }

  const backup = parsed as Partial<StoreSchema>;
  const filterPreferences =
    sanitizeFilterPreferences(backup.filterPreferences) ?? STORE_DEFAULTS.filterPreferences;

  store.set({
    apiKey: typeof backup.apiKey === 'string' ? backup.apiKey : STORE_DEFAULTS.apiKey,
    steamId: typeof backup.steamId === 'string' ? backup.steamId : STORE_DEFAULTS.steamId,
    games: Array.isArray(backup.games) ? backup.games : STORE_DEFAULTS.games,
    ratings: isObject(backup.ratings) ? backup.ratings : STORE_DEFAULTS.ratings,
    ratingTimestamps: isObject(backup.ratingTimestamps)
      ? backup.ratingTimestamps
      : STORE_DEFAULTS.ratingTimestamps,
    userRatings: isObject(backup.userRatings) ? backup.userRatings : STORE_DEFAULTS.userRatings,
    notes: isObject(backup.notes) ? backup.notes : STORE_DEFAULTS.notes,
    completions: isObject(backup.completions) ? backup.completions : STORE_DEFAULTS.completions,
    statuses: isObject(backup.statuses) ? backup.statuses : STORE_DEFAULTS.statuses,
    achievements: isObject(backup.achievements) ? backup.achievements : STORE_DEFAULTS.achievements,
    achievementTimestamps: isObject(backup.achievementTimestamps)
      ? backup.achievementTimestamps
      : STORE_DEFAULTS.achievementTimestamps,
    filterPreferences,
    useBetaUpdates:
      typeof backup.useBetaUpdates === 'boolean'
        ? backup.useBetaUpdates
        : STORE_DEFAULTS.useBetaUpdates,
    lastFetchTimestamp:
      typeof backup.lastFetchTimestamp === 'number'
        ? backup.lastFetchTimestamp
        : STORE_DEFAULTS.lastFetchTimestamp,
  });

  return true;
});
