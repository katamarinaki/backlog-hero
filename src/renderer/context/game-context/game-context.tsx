import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  useRef,
} from 'react';
import type { ReactNode } from 'react';

import { isFetchStale } from '@shared/gameUtils';
import type {
  GameAchievements,
  GameRating,
  GameSession,
  GameStatus,
  StatusFilter,
  SteamGame,
} from 'types';

type SortOption = 'playtime' | 'name' | 'rating' | 'last_played' | 'status_date';

interface GameContextValue {
  // Data
  games: SteamGame[];
  ratings: Record<number, GameRating>;
  userRatings: Record<number, number>;
  notes: Record<number, string>;
  statuses: Record<number, GameStatus | undefined>;
  achievements: Record<number, GameAchievements>;
  sessions: Record<number, GameSession[]>;
  hasSettings: boolean;

  // Error state
  error: string | null;
  clearError: () => void;

  // Filters & sorting
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  sortBy: SortOption;
  sortAsc: boolean;
  handleSortChange: (sort: SortOption) => void;
  statusFilter: StatusFilter;
  handleStatusFilterChange: (filter: StatusFilter) => void;

  // Selected game
  selectedGame: SteamGame | null;
  setSelectedGame: (game: SteamGame | null) => void;

  // Computed
  filteredAndSortedGames: SteamGame[];
  statusCounts: Record<string, number>;

  // Actions
  saveNote: (note: string) => Promise<void>;
  saveStatus: (status: GameStatus | null) => Promise<void>;
  saveUserRating: (appid: number, rating: number) => Promise<void>;
  saveSession: (appid: number, session: GameSession) => Promise<void>;
  deleteSession: (appid: number, id: string) => Promise<void>;
  refreshLibrary: () => Promise<void>;
  fetchRatings: () => Promise<void>;
  fetchAchievements: () => Promise<void>;

  // Loading states
  syncLoading: string | null;
}

const GameContext = createContext<GameContextValue | null>(null);

export const useGameContext = () => {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};

interface GameProviderProps {
  children: ReactNode;
}

export const GameProvider = ({ children }: GameProviderProps) => {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [ratings, setRatings] = useState<Record<number, GameRating>>({});
  const [userRatings, setUserRatings] = useState<Record<number, number>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [statuses, setStatuses] = useState<Record<number, GameStatus>>({});
  const [achievements, setAchievements] = useState<Record<number, GameAchievements>>({});
  const [sessions, setSessions] = useState<Record<number, GameSession[]>>({});
  const [hasSettings, setHasSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('playtime');
  const [sortAsc, setSortAsc] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);
  const [syncLoading, setSyncLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasLoadedRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    if (hasLoadedRef.current) return;
    hasLoadedRef.current = true;

    const loadData = async () => {
      try {
        const settings = await window.electronAPI.getSettings();
        setHasSettings(!!settings.apiKey && !!settings.steamId);

        const [
          cachedGames,
          cachedRatings,
          cachedNotes,
          cachedStatuses,
          cachedAchievements,
          cachedSessions,
          cachedUserRatings,
          filterPrefs,
        ] = await Promise.all([
          window.electronAPI.getGames(),
          window.electronAPI.getRatings(),
          window.electronAPI.getNotes(),
          window.electronAPI.getStatuses(),
          window.electronAPI.getAchievements(),
          window.electronAPI.getSessions(),
          window.electronAPI.getUserRatings(),
          window.electronAPI.getFilterPreferences(),
        ]);

        if (cachedGames && cachedGames.length > 0) {
          setGames(cachedGames);
        }
        if (cachedRatings) {
          setRatings(cachedRatings);
        }
        if (cachedNotes) {
          setNotes(cachedNotes);
        }
        if (cachedStatuses) {
          setStatuses(cachedStatuses);
        }
        if (cachedAchievements) {
          setAchievements(cachedAchievements);
        }
        if (cachedSessions) {
          setSessions(cachedSessions);
        }
        if (cachedUserRatings) {
          setUserRatings(cachedUserRatings);
        }
        if (filterPrefs) {
          setStatusFilter(filterPrefs.statusFilter);
          setSortBy(filterPrefs.sortBy);
          setSortAsc(filterPrefs.sortAsc);
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load saved data. Try restarting the app.');
      }
    };
    loadData();
  }, []);

  // Auto-refresh library if last fetch was more than 6 hours ago
  useEffect(() => {
    if (!hasSettings) return;

    const checkAndFetch = async () => {
      try {
        const lastFetch = await window.electronAPI.getLastFetchTimestamp();
        if (isFetchStale(lastFetch)) {
          const freshGames = await window.electronAPI.fetchGames();
          setGames(freshGames);
        }
      } catch (err) {
        console.error('Failed to auto-refresh library:', err);
        setError('Failed to auto-refresh library. Check your API key and internet connection.');
      }
    };
    checkAndFetch();
  }, [hasSettings, games.length]);

  const saveNote = useCallback(
    async (note: string) => {
      if (!selectedGame) return;
      await window.electronAPI.saveNote(selectedGame.appid, note);
      setNotes((prev) => ({ ...prev, [selectedGame.appid]: note }));
    },
    [selectedGame],
  );

  const saveStatus = useCallback(
    async (status: GameStatus | null) => {
      if (!selectedGame) return;
      await window.electronAPI.saveStatus(selectedGame.appid, status);
      setStatuses((prev) => {
        const updated = { ...prev };
        if (status === null) {
          delete updated[selectedGame.appid];
        } else {
          updated[selectedGame.appid] = status;
        }
        return updated;
      });
    },
    [selectedGame],
  );

  const saveUserRating = useCallback(async (appid: number, rating: number) => {
    await window.electronAPI.saveUserRating(appid, rating);
    setUserRatings((prev) => ({ ...prev, [appid]: rating }));
  }, []);

  const saveSession = useCallback(async (appid: number, sessionToSave: GameSession) => {
    const updated = await window.electronAPI.saveSession(appid, sessionToSave);
    setSessions((prev) => ({ ...prev, [appid]: updated }));
  }, []);

  const deleteSession = useCallback(async (appid: number, id: string) => {
    const updated = await window.electronAPI.deleteSession(appid, id);
    setSessions((prev) => {
      const next = { ...prev };
      if (updated.length > 0) {
        next[appid] = updated;
      } else {
        delete next[appid];
      }
      return next;
    });
  }, []);

  const handleSortChange = useCallback(
    (newSort: SortOption) => {
      const newSortAsc = sortBy === newSort ? !sortAsc : false;
      setSortBy(newSort);
      setSortAsc(newSortAsc);
      window.electronAPI.saveFilterPreferences({
        statusFilter,
        sortBy: newSort,
        sortAsc: newSortAsc,
      });
    },
    [sortBy, sortAsc, statusFilter],
  );

  const handleStatusFilterChange = useCallback(
    (newFilter: StatusFilter) => {
      setStatusFilter(newFilter);
      window.electronAPI.saveFilterPreferences({
        statusFilter: newFilter,
        sortBy,
        sortAsc,
      });
    },
    [sortBy, sortAsc],
  );

  const refreshLibrary = useCallback(async () => {
    setSyncLoading('library');
    try {
      const fetchedGames = await window.electronAPI.fetchGames();
      setGames(fetchedGames);
    } catch (err) {
      console.error('Failed to refresh library:', err);
      setError('Failed to fetch games from Steam. Check your API key and internet connection.');
    } finally {
      setSyncLoading(null);
    }
  }, []);

  const fetchRatingsAction = useCallback(async () => {
    if (games.length === 0) return;
    setSyncLoading('ratings');
    try {
      const appids = games.map((g) => g.appid);
      const fetchedRatings = await window.electronAPI.fetchRatings(appids);
      setRatings(fetchedRatings);
    } catch (err) {
      console.error('Failed to fetch ratings:', err);
      setError('Failed to fetch Steam ratings.');
    } finally {
      setSyncLoading(null);
    }
  }, [games]);

  const fetchAchievementsAction = useCallback(async () => {
    if (games.length === 0) return;
    setSyncLoading('achievements');
    try {
      const appids = games.map((g) => g.appid);
      const fetchedAchievements = await window.electronAPI.fetchAchievements(appids);
      setAchievements(fetchedAchievements);
    } catch (err) {
      console.error('Failed to fetch achievements:', err);
      setError('Failed to fetch Steam achievements.');
    } finally {
      setSyncLoading(null);
    }
  }, [games]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {
      completed: 0,
      in_progress: 0,
      dropped: 0,
      backlog: 0,
      endless: 0,
    };
    Object.values(statuses).forEach((s) => {
      if (s.isEndless) {
        counts.endless++;
      }
      if (s.status && s.status in counts) {
        counts[s.status]++;
      }
    });
    return counts;
  }, [statuses]);

  const filteredAndSortedGames = useMemo(() => {
    let result = [...games];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((game) => game.name.toLowerCase().includes(query));
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'untracked') {
        result = result.filter((game) => !statuses[game.appid]);
      } else if (statusFilter === 'endless') {
        result = result.filter((game) => statuses[game.appid]?.isEndless);
      } else {
        result = result.filter((game) => statuses[game.appid]?.status === statusFilter);
      }
    }

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
        case 'status_date': {
          const dateA = statuses[a.appid]?.statusDate
            ? new Date(statuses[a.appid].statusDate!).getTime()
            : 0;
          const dateB = statuses[b.appid]?.statusDate
            ? new Date(statuses[b.appid].statusDate!).getTime()
            : 0;
          comparison = dateB - dateA;
          break;
        }
      }

      return sortAsc ? -comparison : comparison;
    });

    return result;
  }, [games, ratings, statuses, searchQuery, sortBy, sortAsc, statusFilter]);

  const value: GameContextValue = {
    games,
    ratings,
    userRatings,
    notes,
    statuses,
    achievements,
    sessions,
    hasSettings,
    searchQuery,
    setSearchQuery,
    sortBy,
    sortAsc,
    handleSortChange,
    statusFilter,
    handleStatusFilterChange,
    selectedGame,
    setSelectedGame,
    filteredAndSortedGames,
    statusCounts,
    saveNote,
    saveStatus,
    saveUserRating,
    saveSession,
    deleteSession,
    refreshLibrary,
    fetchRatings: fetchRatingsAction,
    fetchAchievements: fetchAchievementsAction,
    error,
    clearError,
    syncLoading,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
};
