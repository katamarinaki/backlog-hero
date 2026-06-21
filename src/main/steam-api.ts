import { net } from 'electron';

import type { GameAchievements, GameRating, SteamGame } from '../shared/types';

// --- Shared fetch helper ---

interface FetchResult<T> {
  data: T | null;
  statusCode: number;
  error?: string;
}

async function steamFetch<T = unknown>(url: string, timeoutMs = 10_000): Promise<FetchResult<T>> {
  return new Promise((resolve) => {
    const request = net.request(url);
    let data = '';
    let resolved = false;
    let statusCode = 0;

    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        request.abort();
        resolve({ data: null, statusCode, error: 'Request timed out' });
      }
    }, timeoutMs);

    request.on('response', (response) => {
      statusCode = response.statusCode;

      response.on('data', (chunk) => {
        data += chunk.toString();
      });

      response.on('end', () => {
        if (resolved) return;
        clearTimeout(timer);
        resolved = true;

        if (statusCode < 200 || statusCode >= 300) {
          resolve({ data: null, statusCode, error: `HTTP ${statusCode}` });
          return;
        }

        try {
          resolve({ data: JSON.parse(data) as T, statusCode });
        } catch {
          resolve({ data: null, statusCode, error: 'Invalid JSON' });
        }
      });
    });

    request.on('error', (err) => {
      if (resolved) return;
      clearTimeout(timer);
      resolved = true;
      resolve({ data: null, statusCode, error: err.message });
    });

    request.end();
  });
}

async function steamFetchWithRetry<T = unknown>(
  url: string,
  timeoutMs = 10_000,
  retries = 1,
): Promise<FetchResult<T>> {
  let lastResult: FetchResult<T> = { data: null, statusCode: 0 };

  for (let attempt = 0; attempt <= retries; attempt++) {
    const result = await steamFetch<T>(url, timeoutMs);

    // Success — return immediately
    if (result.data !== null) return result;

    lastResult = result;

    // 429 — rate limited, back off
    if (result.statusCode === 429) {
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      continue;
    }

    // 5xx — server error, retry after brief delay
    if (result.statusCode >= 500) {
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 200 * (attempt + 1)));
      }
      continue;
    }

    // 4xx (non-429) — don't retry
    break;
  }

  return lastResult;
}

// --- Rating description ---

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

// --- API calls ---

export interface OwnedGamesResponse {
  response?: { games?: SteamGame[] };
}

export interface AppReviewsResponse {
  success: number;
  query_summary?: {
    total_positive?: number;
    total_negative?: number;
  };
}

export interface PlayerAchievementsResponse {
  playerstats?: {
    achievements?: Array<{ achieved: number }>;
  };
}

export async function fetchOwnedGames(apiKey: string, steamId: string): Promise<SteamGame[]> {
  const url = `https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`;

  const result = await steamFetchWithRetry<OwnedGamesResponse>(url, 15_000, 1);
  if (!result.data) {
    throw new Error(result.error || 'Failed to fetch owned games');
  }

  if (result.data.response?.games) {
    return result.data.response.games;
  }

  throw new Error('Invalid response from Steam API');
}

export async function fetchGameRating(appid: number): Promise<GameRating | null> {
  const url = `https://store.steampowered.com/appreviews/${appid}?json=1&language=all&purchase_type=all`;

  const result = await steamFetchWithRetry<AppReviewsResponse>(url, 10_000, 1);
  if (!result.data) return null;

  const { success, query_summary: summary } = result.data;
  if (success !== 1 || !summary) return null;

  const positive = summary.total_positive || 0;
  const negative = summary.total_negative || 0;
  const total = positive + negative;
  const score = total > 0 ? Math.round((positive / total) * 100) : 0;

  return { positive, negative, total, score, description: getRatingDescription(score) };
}

export async function fetchGameAchievements(
  appid: number,
  apiKey: string,
  steamId: string,
): Promise<GameAchievements | null> {
  const url = `https://api.steampowered.com/ISteamUserStats/GetPlayerAchievements/v1/?appid=${appid}&key=${apiKey}&steamid=${steamId}`;

  const result = await steamFetchWithRetry<PlayerAchievementsResponse>(url, 10_000, 1);
  if (!result.data?.playerstats?.achievements) return null;

  const achievements = result.data.playerstats.achievements;
  const total = achievements.length;
  const achieved = achievements.filter((a) => a.achieved === 1).length;

  return { achieved, total };
}
