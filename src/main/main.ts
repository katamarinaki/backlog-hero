import * as path from 'path';
import * as fs from 'fs/promises';

import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow, dialog, ipcMain, net } from 'electron';

interface GameRating {
  positive: number;
  negative: number;
  score: number;
  total: number;
  description: string;
}

interface GameCompletion {
  completed: boolean;
  completedDate?: string; // ISO date string, optional
}

type GameStatusType = 'completed' | 'in_progress' | 'dropped' | 'backlog';

interface GameStatus {
  status?: GameStatusType;
  statusDate?: string;
  completedDate?: string;
  isEndless?: boolean;
}

type StatusFilter =
  | 'all'
  | 'completed'
  | 'in_progress'
  | 'dropped'
  | 'backlog'
  | 'untracked'
  | 'endless';

interface GameAchievements {
  achieved: number;
  total: number;
}

interface FilterPreferences {
  statusFilter: StatusFilter;
  sortBy: 'playtime' | 'name' | 'rating' | 'last_played' | 'status_date';
  sortAsc: boolean;
}

interface StoreSchema {
  apiKey: string;
  steamId: string;
  games: SteamGame[];
  ratings: Record<number, GameRating>;
  notes: Record<number, string>;
  completions: Record<number, GameCompletion>;
  statuses: Record<number, GameStatus>;
  achievements: Record<number, GameAchievements>;
  filterPreferences: FilterPreferences;
  useBetaUpdates: boolean;
}

interface SteamGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  img_logo_url: string;
  playtime_2weeks?: number;
  rtime_last_played?: number;
}

const defaultStoreData: StoreSchema = {
  apiKey: '',
  steamId: '',
  games: [],
  ratings: {},
  notes: {},
  completions: {},
  statuses: {},
  achievements: {},
  filterPreferences: {
    statusFilter: 'all',
    sortBy: 'playtime',
    sortAsc: false,
  },
  useBetaUpdates: false,
};

const store = new Store<StoreSchema>({
  defaults: defaultStoreData,
});

// Migrate old completions to new statuses format
function migrateCompletionsToStatuses() {
  const statuses = store.get('statuses') || {};
  const completions = store.get('completions') || {};

  // Only migrate if statuses is empty but completions has data
  if (Object.keys(statuses).length === 0 && Object.keys(completions).length > 0) {
    const migratedStatuses: Record<number, GameStatus> = {};

    for (const [appidStr, completion] of Object.entries(completions)) {
      if (completion.completed) {
        const appid = parseInt(appidStr, 10);
        migratedStatuses[appid] = {
          status: 'completed',
          statusDate: completion.completedDate || new Date().toISOString(),
          completedDate: completion.completedDate,
        };
      }
    }

    if (Object.keys(migratedStatuses).length > 0) {
      store.set('statuses', migratedStatuses);
    }
  }
}

// Run migration
migrateCompletionsToStatuses();

let mainWindow: BrowserWindow | null = null;

app.setName('Backlog Hero');
app.setAboutPanelOptions({
  applicationName: 'Backlog Hero',
  applicationVersion: app.getVersion(),
  credits: 'Backlog Hero',
});

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
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

function initAutoUpdater() {
  if (!app.isPackaged) return;

  const useBeta = store.get('useBetaUpdates', false);
  if (useBeta) {
    autoUpdater.setFeedURL({
      provider: 'generic',
      url: 'https://github.com/katamarinaki/backlog-hero/releases/download/beta/',
    });
  } else {
    autoUpdater.setFeedURL({
      provider: 'github',
      owner: 'katamarinaki',
      repo: 'backlog-hero',
    });
  }

  autoUpdater.on('error', (error) => {
    console.error('Auto update error:', error);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('Auto update check failed:', error);
  });

  const intervalMs = 4 * 60 * 60 * 1000;
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error('Auto update check failed:', error);
    });
  }, intervalMs);
}

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

// IPC Handlers for settings
ipcMain.handle('get-settings', () => {
  return {
    apiKey: store.get('apiKey'),
    steamId: store.get('steamId'),
  };
});

ipcMain.handle('save-settings', (_, settings: { apiKey: string; steamId: string }) => {
  store.set('apiKey', settings.apiKey);
  store.set('steamId', settings.steamId);
  return true;
});

// IPC Handler for fetching games from Steam API
ipcMain.handle('fetch-games', async () => {
  const apiKey = store.get('apiKey');
  const steamId = store.get('steamId');

  if (!apiKey || !steamId) {
    throw new Error('API key and Steam ID are required');
  }

  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`;

  return new Promise((resolve, reject) => {
    const request = net.request(url);
    let data = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk.toString();
      });

      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.response && parsed.response.games) {
            const games = parsed.response.games as SteamGame[];
            store.set('games', games);
            resolve(games);
          } else {
            reject(new Error('Invalid response from Steam API'));
          }
        } catch {
          reject(new Error('Failed to parse Steam API response'));
        }
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });
});

// IPC Handler for fetching recent activity
ipcMain.handle('fetch-recent-activity', async () => {
  const apiKey = store.get('apiKey');
  const steamId = store.get('steamId');

  if (!apiKey || !steamId) {
    throw new Error('API key and Steam ID are required');
  }

  const url = `https://api.steampowered.com/IPlayerService/GetRecentlyPlayedGames/v1/?key=${apiKey}&steamid=${steamId}&format=json`;

  return new Promise((resolve, reject) => {
    const request = net.request(url);
    let data = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk.toString();
      });

      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.response && parsed.response.games) {
            const recentGames = parsed.response.games as {
              appid: number;
              name: string;
              playtime_forever: number;
              playtime_2weeks: number;
              img_icon_url: string;
              img_logo_url: string;
            }[];

            // Merge playtime_2weeks into stored games
            const games = store.get('games') || [];
            const gamesById = new Map(games.map((g) => [g.appid, g]));
            for (const recent of recentGames) {
              const existing = gamesById.get(recent.appid);
              if (existing) {
                existing.playtime_2weeks = recent.playtime_2weeks || undefined;
                existing.playtime_forever = recent.playtime_forever;
                existing.rtime_last_played = Math.floor(Date.now() / 1000);
              }
            }
            store.set('games', games);
            resolve(recentGames);
          } else {
            reject(new Error('Invalid response from Steam API'));
          }
        } catch {
          reject(new Error('Failed to parse Steam API response'));
        }
      });
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.end();
  });
});

// IPC Handler for getting cached games
ipcMain.handle('get-games', () => {
  return store.get('games');
});

// Helper to get rating description based on score
function getRatingDescription(score: number): string {
  if (score >= 95) return 'Overwhelmingly Positive';
  if (score >= 85) return 'Very Positive';
  if (score >= 80) return 'Positive';
  if (score >= 70) return 'Mostly Positive';
  if (score >= 40) return 'Mixed';
  if (score >= 20) return 'Mostly Negative';
  if (score >= 15) return 'Negative';
  if (score >= 5) return 'Very Negative';
  return 'Overwhelmingly Negative';
}

// Fetch rating for a single game
async function fetchGameRating(appid: number): Promise<GameRating | null> {
  const url = `https://store.steampowered.com/appreviews/${appid}?json=1&language=all&purchase_type=all`;

  return new Promise((resolve) => {
    const request = net.request(url);
    let data = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk.toString();
      });

      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.success && parsed.query_summary) {
            const summary = parsed.query_summary;
            const positive = summary.total_positive || 0;
            const negative = summary.total_negative || 0;
            const total = positive + negative;
            const score = total > 0 ? Math.round((positive / total) * 100) : 0;

            resolve({
              positive,
              negative,
              total,
              score,
              description: getRatingDescription(score),
            });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    request.on('error', () => {
      resolve(null);
    });

    request.end();
  });
}

// IPC Handler for fetching ratings (batch)
ipcMain.handle('fetch-ratings', async (event, appids: number[]) => {
  const cachedRatings = store.get('ratings') || {};
  const newRatings: Record<number, GameRating> = { ...cachedRatings };
  const totalToFetch = appids.filter((id) => !cachedRatings[id]).length;
  let fetched = 0;

  // Fetch ratings in batches to avoid overwhelming the API
  const batchSize = 5;
  for (let i = 0; i < appids.length; i += batchSize) {
    const batch = appids.slice(i, i + batchSize);
    const promises = batch.map(async (appid) => {
      if (!cachedRatings[appid]) {
        const rating = await fetchGameRating(appid);
        fetched++;
        event.sender.send('fetch-ratings-progress', { fetched, total: totalToFetch });
        if (rating) {
          newRatings[appid] = rating;
        }
      }
    });
    await Promise.all(promises);
    // Small delay between batches to be nice to Steam's API
    if (i + batchSize < appids.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  store.set('ratings', newRatings);
  return newRatings;
});

// IPC Handler for getting cached ratings
ipcMain.handle('get-ratings', () => {
  return store.get('ratings') || {};
});

// IPC Handlers for notes
ipcMain.handle('get-notes', () => {
  return store.get('notes') || {};
});

ipcMain.handle('save-note', (_, { appid, note }: { appid: number; note: string }) => {
  const notes = store.get('notes') || {};
  notes[appid] = note;
  store.set('notes', notes);
  return true;
});

// IPC Handlers for completions
ipcMain.handle('get-completions', () => {
  return store.get('completions') || {};
});

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

// IPC Handlers for game statuses
ipcMain.handle('get-statuses', () => {
  return store.get('statuses') || {};
});

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

// Fetch achievements for a single game
async function fetchGameAchievements(
  appid: number,
  apiKey: string,
  steamId: string,
): Promise<GameAchievements | null> {
  const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid=${appid}&key=${apiKey}&steamid=${steamId}`;

  return new Promise((resolve) => {
    const request = net.request(url);
    let data = '';

    request.on('response', (response) => {
      response.on('data', (chunk) => {
        data += chunk.toString();
      });

      response.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.playerstats && parsed.playerstats.achievements) {
            const achievements = parsed.playerstats.achievements;
            const total = achievements.length;
            const achieved = achievements.filter(
              (a: { achieved: number }) => a.achieved === 1,
            ).length;
            resolve({ achieved, total });
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });

    request.on('error', () => {
      resolve(null);
    });

    request.end();
  });
}

// IPC Handler for fetching achievements (batch)
ipcMain.handle('fetch-achievements', async (event, appids: number[]) => {
  const apiKey = store.get('apiKey');
  const steamId = store.get('steamId');

  if (!apiKey || !steamId) {
    throw new Error('API key and Steam ID are required');
  }

  const cachedAchievements = store.get('achievements') || {};
  const newAchievements: Record<number, GameAchievements> = { ...cachedAchievements };
  const totalToFetch = appids.filter((id) => !cachedAchievements[id]).length;
  let fetched = 0;

  // Fetch achievements in batches
  const batchSize = 5;
  for (let i = 0; i < appids.length; i += batchSize) {
    const batch = appids.slice(i, i + batchSize);
    const promises = batch.map(async (appid) => {
      if (!cachedAchievements[appid]) {
        const achievements = await fetchGameAchievements(appid, apiKey, steamId);
        fetched++;
        event.sender.send('fetch-achievements-progress', { fetched, total: totalToFetch });
        if (achievements) {
          newAchievements[appid] = achievements;
        }
      }
    });
    await Promise.all(promises);
    if (i + batchSize < appids.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  store.set('achievements', newAchievements);
  return newAchievements;
});

// IPC Handler for getting cached achievements
ipcMain.handle('get-achievements', () => {
  return store.get('achievements') || {};
});

// IPC Handlers for filter preferences
ipcMain.handle('get-filter-preferences', () => {
  return store.get('filterPreferences');
});

ipcMain.handle('save-filter-preferences', (_, preferences: FilterPreferences) => {
  store.set('filterPreferences', preferences);
  return true;
});

// IPC Handlers for beta updates preference
ipcMain.handle('get-beta-updates', () => {
  return store.get('useBetaUpdates', false);
});

ipcMain.handle('save-beta-updates', (_, useBeta: boolean) => {
  store.set('useBetaUpdates', useBeta);

  if (app.isPackaged) {
    if (useBeta) {
      autoUpdater.setFeedURL({
        provider: 'generic',
        url: 'https://github.com/katamarinaki/backlog-hero/releases/download/beta/',
      });
    } else {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'katamarinaki',
        repo: 'backlog-hero',
      });
    }
  }

  return true;
});

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeFilterPreferences(value: unknown): FilterPreferences | null {
  if (!isObject(value)) return null;
  const statusFilter = value.statusFilter;
  const sortBy = value.sortBy;
  const sortAsc = value.sortAsc;

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
    notes: store.get('notes'),
    completions: store.get('completions'),
    statuses: store.get('statuses'),
    achievements: store.get('achievements'),
    filterPreferences: store.get('filterPreferences'),
    useBetaUpdates: store.get('useBetaUpdates', false),
  };
}

ipcMain.handle('export-data', async () => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export Backlog Hero Data',
    defaultPath: path.join(app.getPath('documents'), 'backlog-hero-backup.json'),
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });

  if (canceled || !filePath) {
    return false;
  }

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

  if (canceled || filePaths.length === 0) {
    return false;
  }

  const raw = await fs.readFile(filePaths[0], 'utf8');
  const parsed: unknown = JSON.parse(raw);

  if (!isObject(parsed)) {
    throw new Error('Invalid backup file.');
  }

  const backup = parsed as Partial<StoreSchema>;
  const filterPreferences =
    sanitizeFilterPreferences(backup.filterPreferences) ?? defaultStoreData.filterPreferences;

  store.set({
    apiKey: typeof backup.apiKey === 'string' ? backup.apiKey : defaultStoreData.apiKey,
    steamId: typeof backup.steamId === 'string' ? backup.steamId : defaultStoreData.steamId,
    games: Array.isArray(backup.games) ? backup.games : defaultStoreData.games,
    ratings: isObject(backup.ratings) ? backup.ratings : defaultStoreData.ratings,
    notes: isObject(backup.notes) ? backup.notes : defaultStoreData.notes,
    completions: isObject(backup.completions) ? backup.completions : defaultStoreData.completions,
    statuses: isObject(backup.statuses) ? backup.statuses : defaultStoreData.statuses,
    achievements: isObject(backup.achievements)
      ? backup.achievements
      : defaultStoreData.achievements,
    filterPreferences,
  });

  return true;
});
