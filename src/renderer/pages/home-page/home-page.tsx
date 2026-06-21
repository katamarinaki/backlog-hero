import { Link } from 'react-router-dom';
import { useMemo } from 'react';

import { GameCardModal } from 'components/game-card-modal';
import { useGameContext } from 'context/game-context';
import type { StatusFilter } from 'types';

import { formatPlaytime } from '../../../shared/gameUtils';

import styles from './home-page.module.css';
import { getGameCover, getRatingColor } from './utils';

export const HomePage = () => {
  const {
    games,
    ratings,
    notes,
    statuses,
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
    error,
    clearError,
  } = useGameContext();

  const totalGamesCount = useMemo(() => {
    if (statusFilter === 'completed') {
      return (
        games.length - (statuses ? Object.values(statuses).filter((s) => s?.isEndless).length : 0)
      );
    }
    return games.length;
  }, [games.length, statusFilter, statuses]);

  const getStatusCardClass = (status?: string) => {
    if (!status) return '';
    const statusMap: Record<string, string> = {
      completed: styles.statusCompleted,
      in_progress: styles.statusInProgress,
      dropped: styles.statusDropped,
      backlog: styles.statusBacklog,
    };
    return statusMap[status] || '';
  };

  const getStatusBadgeClass = (status: string) => {
    const statusMap: Record<string, string> = {
      completed: styles.statusBadgeCompleted,
      in_progress: styles.statusBadgeInProgress,
      dropped: styles.statusBadgeDropped,
      backlog: styles.statusBadgeBacklog,
    };
    return statusMap[status] || '';
  };

  if (!hasSettings) {
    return (
      <div className={styles.homePage}>
        <div className={styles.emptyState}>
          <h2>Welcome to Backlog Hero</h2>
          <p>To get started, configure your Steam API credentials in the settings.</p>
          <Link to="/settings" className={styles.btnPrimary}>
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.homePage}>
      {error && (
        <div className={styles.errorBanner}>
          <span>{error}</span>
          <button onClick={clearError} className={styles.errorDismiss} aria-label="Dismiss error">
            ✕
          </button>
        </div>
      )}
      <div className={styles.pageHeader}>
        <h1>Your Library</h1>
        <span className={styles.gameCount}>
          {filteredAndSortedGames.length} {statusFilter !== 'all' && `/ ${totalGamesCount}`} games
        </span>
      </div>

      <div className={styles.filtersBar}>
        <div className={styles.searchBox}>
          <input
            type="text"
            placeholder="Search games..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className={styles.filterOptions}>
          <select
            value={statusFilter}
            onChange={(e) => handleStatusFilterChange(e.target.value as StatusFilter)}
            className={styles.filterSelect}
          >
            <option value="all">All Games</option>
            <option value="completed">Completed</option>
            <option value="in_progress">In Progress</option>
            <option value="backlog">Backlog</option>
            <option value="dropped">Dropped</option>
            <option value="endless">Endless</option>
            <option value="untracked">Untracked</option>
          </select>
        </div>
        <div className={styles.sortOptions}>
          <span className={styles.sortLabel}>Sort by:</span>
          <button
            className={`${styles.sortBtn} ${sortBy === 'playtime' ? styles.sortBtnActive : ''}`}
            onClick={() => handleSortChange('playtime')}
          >
            Playtime {sortBy === 'playtime' && (sortAsc ? '↑' : '↓')}
          </button>
          <button
            className={`${styles.sortBtn} ${sortBy === 'name' ? styles.sortBtnActive : ''}`}
            onClick={() => handleSortChange('name')}
          >
            Name {sortBy === 'name' && (sortAsc ? '↑' : '↓')}
          </button>
          <button
            className={`${styles.sortBtn} ${sortBy === 'rating' ? styles.sortBtnActive : ''}`}
            onClick={() => handleSortChange('rating')}
          >
            Rating {sortBy === 'rating' && (sortAsc ? '↑' : '↓')}
          </button>
          <button
            className={`${styles.sortBtn} ${sortBy === 'last_played' ? styles.sortBtnActive : ''}`}
            onClick={() => handleSortChange('last_played')}
          >
            Last Played {sortBy === 'last_played' && (sortAsc ? '↑' : '↓')}
          </button>
        </div>
      </div>

      {games.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No games loaded yet. Go to Settings to refresh your library.</p>
        </div>
      ) : filteredAndSortedGames.length === 0 ? (
        <div className={styles.emptyState}>
          <p>No games match your filters.</p>
        </div>
      ) : (
        <div className={styles.gamesGrid}>
          {filteredAndSortedGames.map((game) => {
            const rating = ratings[game.appid];
            const hasNote = !!notes[game.appid];
            const gameStatus = statuses[game.appid]?.status;
            const isEndless = statuses[game.appid]?.isEndless;
            return (
              <div
                key={game.appid}
                className={`${styles.gameCard} ${getStatusCardClass(gameStatus)}`}
                onClick={() => setSelectedGame(game)}
              >
                {gameStatus && (
                  <div className={`${styles.statusBadge} ${getStatusBadgeClass(gameStatus)}`}>
                    {gameStatus === 'in_progress'
                      ? 'In Progress'
                      : gameStatus.charAt(0).toUpperCase() + gameStatus.slice(1)}
                  </div>
                )}
                {isEndless && <div className={styles.endlessBadge}>Endless</div>}
                <div className={styles.gameImage}>
                  {game.img_icon_url ? (
                    <img src={getGameCover(game.appid, game.img_icon_url)} alt={game.name} />
                  ) : (
                    <div className={styles.noImage}>No Image</div>
                  )}
                </div>
                <div className={styles.gameInfo}>
                  <h3 className={styles.gameTitle}>
                    {game.name}
                    {hasNote && (
                      <span className={styles.hasNote} title="Has notes">
                        *
                      </span>
                    )}
                  </h3>
                  <p className={styles.gamePlaytime}>
                    {formatPlaytime(game.playtime_forever)}
                    {game.playtime_2weeks && (
                      <span className={styles.recentPlaytime}>
                        {' '}
                        ({formatPlaytime(game.playtime_2weeks)} last 2 weeks)
                      </span>
                    )}
                  </p>
                  {rating && (
                    <p
                      className={styles.gameRating}
                      style={{ color: getRatingColor(rating.score) }}
                    >
                      {rating.description} ({rating.score}% of {rating.total.toLocaleString()})
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedGame && <GameCardModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
    </div>
  );
};
