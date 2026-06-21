import type { SteamGame, GameRating, GameCompletion } from './types';

export type SortOption = 'playtime' | 'name' | 'rating' | 'last_played';
export type CompletionFilter = 'all' | 'completed' | 'not_completed';

export interface FilterSortInput {
  games: SteamGame[];
  ratings: Record<number, GameRating>;
  completions: Record<number, GameCompletion>;
  searchQuery: string;
  completionFilter: CompletionFilter;
  sortBy: SortOption;
  sortAsc: boolean;
}

export function filterAndSortGames(input: FilterSortInput): SteamGame[] {
  const { games, ratings, completions, searchQuery, completionFilter, sortBy, sortAsc } = input;
  let result = [...games];

  // Filter by search query
  if (searchQuery.trim()) {
    const query = searchQuery.toLowerCase();
    result = result.filter((game) => game.name.toLowerCase().includes(query));
  }

  // Filter by completion status
  if (completionFilter === 'completed') {
    result = result.filter((game) => completions[game.appid]?.completed);
  } else if (completionFilter === 'not_completed') {
    result = result.filter((game) => !completions[game.appid]?.completed);
  }

  // Sort
  result.sort((a, b) => {
    let comparison = 0;

    switch (sortBy) {
      case 'playtime':
        comparison = b.playtime_forever - a.playtime_forever;
        break;
      case 'name':
        comparison = a.name.localeCompare(b.name);
        break;
      case 'rating': {
        const ratingA = ratings[a.appid]?.score ?? -1;
        const ratingB = ratings[b.appid]?.score ?? -1;
        comparison = ratingB - ratingA;
        break;
      }
      case 'last_played': {
        const lastA = a.rtime_last_played ?? 0;
        const lastB = b.rtime_last_played ?? 0;
        comparison = lastB - lastA;
        break;
      }
    }

    return sortAsc ? -comparison : comparison;
  });

  return result;
}

export function formatPlaytime(minutes: number): string {
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours.toLocaleString()} hrs`;
}
