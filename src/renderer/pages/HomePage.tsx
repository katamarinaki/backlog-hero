import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import type { SteamGame, GameRating, GameCompletion, GameAchievements } from "../types/electron";
import GameCardModal from "../components/GameCardModal";

type SortOption = "playtime" | "name" | "rating" | "last_played";
type CompletionFilter = "all" | "completed" | "not_completed";

function HomePage() {
  const [games, setGames] = useState<SteamGame[]>([]);
  const [ratings, setRatings] = useState<Record<number, GameRating>>({});
  const [notes, setNotes] = useState<Record<number, string>>({});
  const [completions, setCompletions] = useState<
    Record<number, GameCompletion>
  >({});
  const [achievements, setAchievements] = useState<
    Record<number, GameAchievements>
  >({});
  const [loading, setLoading] = useState(false);
  const [loadingRatings, setLoadingRatings] = useState(false);
  const [loadingAchievements, setLoadingAchievements] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasSettings, setHasSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("playtime");
  const [sortAsc, setSortAsc] = useState(false);
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>("all");
  const [selectedGame, setSelectedGame] = useState<SteamGame | null>(null);

  useEffect(() => {
    checkSettingsAndLoadGames();
  }, []);

  const checkSettingsAndLoadGames = async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      setHasSettings(!!settings.apiKey && !!settings.steamId);

      const [cachedGames, cachedRatings, cachedNotes, cachedCompletions, cachedAchievements, filterPrefs] =
        await Promise.all([
          window.electronAPI.getGames(),
          window.electronAPI.getRatings(),
          window.electronAPI.getNotes(),
          window.electronAPI.getCompletions(),
          window.electronAPI.getAchievements(),
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
      if (cachedCompletions) {
        setCompletions(cachedCompletions);
      }
      if (cachedAchievements) {
        setAchievements(cachedAchievements);
      }
      if (filterPrefs) {
        setCompletionFilter(filterPrefs.completionFilter);
        setSortBy(filterPrefs.sortBy);
        setSortAsc(filterPrefs.sortAsc);
      }
    } catch (err) {
      console.error("Failed to load games:", err);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedGames = await window.electronAPI.fetchGames();
      setGames(fetchedGames);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch games");
    } finally {
      setLoading(false);
    }
  };

  const handleFetchRatings = async () => {
    if (games.length === 0) return;

    setLoadingRatings(true);
    try {
      const appids = games.map((g) => g.appid);
      const fetchedRatings = await window.electronAPI.fetchRatings(appids);
      setRatings(fetchedRatings);
    } catch (err) {
      console.error("Failed to fetch ratings:", err);
    } finally {
      setLoadingRatings(false);
    }
  };

  const handleFetchAchievements = async () => {
    if (games.length === 0) return;

    setLoadingAchievements(true);
    try {
      const appids = games.map((g) => g.appid);
      const fetchedAchievements = await window.electronAPI.fetchAchievements(appids);
      setAchievements(fetchedAchievements);
    } catch (err) {
      console.error("Failed to fetch achievements:", err);
    } finally {
      setLoadingAchievements(false);
    }
  };

  const handleSaveNote = async (note: string) => {
    if (!selectedGame) return;
    await window.electronAPI.saveNote(selectedGame.appid, note);
    setNotes((prev) => ({ ...prev, [selectedGame.appid]: note }));
  };

  const handleSaveCompletion = async (completion: GameCompletion | null) => {
    if (!selectedGame) return;
    await window.electronAPI.saveCompletion(selectedGame.appid, completion);
    setCompletions((prev) => {
      const updated = { ...prev };
      if (completion === null) {
        delete updated[selectedGame.appid];
      } else {
        updated[selectedGame.appid] = completion;
      }
      return updated;
    });
  };

  const formatPlaytime = (minutes: number): string => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    return `${hours.toLocaleString()} hrs`;
  };

  const getGameImageUrl = (appid: number, hash: string): string => {
    if (!hash) return "";
    return `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg`;
  };

  const getRatingColor = (score: number): string => {
    if (score >= 70) return "#66c0f4";
    if (score >= 40) return "#b9a074";
    return "#a34c4c";
  };

  const completedCount = useMemo(() => {
    return Object.values(completions).filter((c) => c.completed).length;
  }, [completions]);

  const filteredAndSortedGames = useMemo(() => {
    let result = [...games];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((game) => game.name.toLowerCase().includes(query));
    }

    // Filter by completion status
    if (completionFilter === "completed") {
      result = result.filter((game) => completions[game.appid]?.completed);
    } else if (completionFilter === "not_completed") {
      result = result.filter((game) => !completions[game.appid]?.completed);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "playtime":
          comparison = b.playtime_forever - a.playtime_forever;
          break;
        case "name":
          comparison = a.name.localeCompare(b.name);
          break;
        case "rating":
          const ratingA = ratings[a.appid]?.score ?? -1;
          const ratingB = ratings[b.appid]?.score ?? -1;
          comparison = ratingB - ratingA;
          break;
        case "last_played":
          const lastA = a.rtime_last_played ?? 0;
          const lastB = b.rtime_last_played ?? 0;
          comparison = lastB - lastA;
          break;
      }

      return sortAsc ? -comparison : comparison;
    });

    return result;
  }, [
    games,
    ratings,
    completions,
    searchQuery,
    sortBy,
    sortAsc,
    completionFilter,
  ]);

  const handleSortChange = (newSort: SortOption) => {
    const newSortAsc = sortBy === newSort ? !sortAsc : false;
    setSortBy(newSort);
    setSortAsc(newSortAsc);
    window.electronAPI.saveFilterPreferences({
      completionFilter,
      sortBy: newSort,
      sortAsc: newSortAsc,
    });
  };

  const handleCompletionFilterChange = (newFilter: CompletionFilter) => {
    setCompletionFilter(newFilter);
    window.electronAPI.saveFilterPreferences({
      completionFilter: newFilter,
      sortBy,
      sortAsc,
    });
  };

  if (!hasSettings) {
    return (
      <div className="home-page">
        <div className="empty-state">
          <h2>Welcome to Steam Tracker</h2>
          <p>
            To get started, configure your Steam API credentials in the
            settings.
          </p>
          <Link to="/settings" className="btn-primary">
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="page-header">
        <h1>Your Library</h1>
        <div className="header-actions">
          <span className="game-count">
            {filteredAndSortedGames.length} / {games.length} games
            <span className="completed-count">
              {" "}
              ({completedCount} completed)
            </span>
          </span>
          <button
            onClick={handleRefresh}
            className="btn-primary"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh Library"}
          </button>
          <button
            onClick={handleFetchRatings}
            className="btn-secondary"
            disabled={loadingRatings || games.length === 0}
          >
            {loadingRatings ? "Loading Ratings..." : "Fetch Ratings"}
          </button>
          <button
            onClick={handleFetchAchievements}
            className="btn-secondary"
            disabled={loadingAchievements || games.length === 0}
          >
            {loadingAchievements ? "Loading Achievements..." : "Fetch Achievements"}
          </button>
        </div>
      </div>

      <div className="filters-bar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-options">
          <select
            value={completionFilter}
            onChange={(e) =>
              handleCompletionFilterChange(e.target.value as CompletionFilter)
            }
            className="filter-select"
          >
            <option value="all">All Games</option>
            <option value="completed">Completed</option>
            <option value="not_completed">Not Completed</option>
          </select>
        </div>
        <div className="sort-options">
          <span className="sort-label">Sort by:</span>
          <button
            className={`sort-btn ${sortBy === "playtime" ? "active" : ""}`}
            onClick={() => handleSortChange("playtime")}
          >
            Playtime {sortBy === "playtime" && (sortAsc ? "↑" : "↓")}
          </button>
          <button
            className={`sort-btn ${sortBy === "name" ? "active" : ""}`}
            onClick={() => handleSortChange("name")}
          >
            Name {sortBy === "name" && (sortAsc ? "↑" : "↓")}
          </button>
          <button
            className={`sort-btn ${sortBy === "rating" ? "active" : ""}`}
            onClick={() => handleSortChange("rating")}
          >
            Rating {sortBy === "rating" && (sortAsc ? "↑" : "↓")}
          </button>
          <button
            className={`sort-btn ${sortBy === "last_played" ? "active" : ""}`}
            onClick={() => handleSortChange("last_played")}
          >
            Last Played {sortBy === "last_played" && (sortAsc ? "↑" : "↓")}
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {games.length === 0 && !loading ? (
        <div className="empty-state">
          <p>
            No games loaded yet. Click "Refresh Library" to fetch your games.
          </p>
        </div>
      ) : filteredAndSortedGames.length === 0 ? (
        <div className="empty-state">
          <p>No games match your filters.</p>
        </div>
      ) : (
        <div className="games-grid">
          {filteredAndSortedGames.map((game) => {
            const rating = ratings[game.appid];
            const hasNote = !!notes[game.appid];
            const isCompleted = completions[game.appid]?.completed;
            const gameAchievements = achievements[game.appid];
            return (
              <div
                key={game.appid}
                className={`game-card ${isCompleted ? "completed" : ""}`}
                onClick={() => setSelectedGame(game)}
              >
                {isCompleted && (
                  <div className="completed-badge">Completed</div>
                )}
                <div className="game-image">
                  {game.img_icon_url ? (
                    <img
                      src={getGameImageUrl(game.appid, game.img_icon_url)}
                      alt={game.name}
                    />
                  ) : (
                    <div className="no-image">No Image</div>
                  )}
                </div>
                <div className="game-info">
                  <h3 className="game-title">
                    {game.name}
                    {hasNote && (
                      <span className="has-note" title="Has notes">
                        *
                      </span>
                    )}
                  </h3>
                  <p className="game-playtime">
                    {formatPlaytime(game.playtime_forever)}
                    {game.playtime_2weeks && (
                      <span className="recent-playtime">
                        {" "}
                        ({formatPlaytime(game.playtime_2weeks)} last 2 weeks)
                      </span>
                    )}
                  </p>
                  {rating && (
                    <p
                      className="game-rating"
                      style={{ color: getRatingColor(rating.score) }}
                    >
                      {rating.description} ({rating.score}% of{" "}
                      {rating.total.toLocaleString()})
                    </p>
                  )}
                  {gameAchievements && (
                    <p className="game-achievements">
                      Achievements: {gameAchievements.achieved}/{gameAchievements.total}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedGame && (
        <GameCardModal
          game={selectedGame}
          rating={ratings[selectedGame.appid]}
          note={notes[selectedGame.appid] || ""}
          completion={completions[selectedGame.appid]}
          achievements={achievements[selectedGame.appid]}
          onClose={() => setSelectedGame(null)}
          onSaveNote={handleSaveNote}
          onSaveCompletion={handleSaveCompletion}
        />
      )}
    </div>
  );
}

export default HomePage;
