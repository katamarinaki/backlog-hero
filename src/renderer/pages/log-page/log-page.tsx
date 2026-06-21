import { useMemo } from 'react';
import { Link } from 'react-router-dom';

import { GameCardModal } from 'components/game-card-modal';
import { useGameContext } from 'context/game-context';

import { getRecentActivity } from '../../../shared/logUtils';
import { formatPlaytime } from '../../../shared/gameUtils';

import styles from './log-page.module.css';
import { getVerticalCoverUrl, getHeaderImageUrl } from './utils';

export const LogPage = () => {
  const { games, hasSettings, selectedGame, setSelectedGame } = useGameContext();

  const recentActivity = useMemo(() => getRecentActivity(games), [games]);

  if (!hasSettings) {
    return (
      <div className={styles.logPage}>
        <div className={styles.emptyState}>
          <h2>Your Log</h2>
          <p>Configure your Steam API credentials to start tracking your activity.</p>
          <Link to="/settings" className={styles.btnPrimary}>
            Go to Settings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.logPage}>
      <div className={styles.pageHeader}>
        <h1>Your Log</h1>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Recent Activity</h2>
          <span className={styles.sectionHint}>Last 2 weeks</span>
        </div>

        {recentActivity.length === 0 ? (
          <p className={styles.emptyHint}>No games played in the last two weeks.</p>
        ) : (
          <div className={styles.recentRow}>
            {recentActivity.map((game) => (
              <button
                key={game.appid}
                type="button"
                className={styles.recentCard}
                onClick={() => setSelectedGame(game)}
                title={game.name}
              >
                <div className={styles.recentCover}>
                  <img
                    src={getVerticalCoverUrl(game.appid)}
                    alt={game.name}
                    loading="lazy"
                    onError={(e) => {
                      const img = e.currentTarget;
                      if (img.dataset.fallback) return;
                      img.dataset.fallback = 'true';
                      img.src = getHeaderImageUrl(game.appid);
                    }}
                  />
                </div>
                <div className={styles.recentName}>{game.name}</div>
                {game.playtime_2weeks ? (
                  <div className={styles.recentPlaytime}>
                    {formatPlaytime(game.playtime_2weeks)}
                  </div>
                ) : null}
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedGame && <GameCardModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
    </div>
  );
};
