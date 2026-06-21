import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

import { LogModal } from 'components/log-modal';
import { useGameContext } from 'context/game-context';
import type { SteamGame } from 'types';

import { getRecentActivity } from '../../../shared/logUtils';
import { formatPlaytime } from '../../../shared/gameUtils';

import styles from './log-page.module.css';
import { CoverImage } from './cover-image';
import { getHeaderImageUrl, formatLogDate } from './utils';

const PAGE_SIZE = 20;

const STATUS_LABELS: Record<string, string> = {
  backlog: 'Backlog',
  completed: 'Completed',
  retired: 'Retired',
  dropped: 'Dropped',
};

export const LogPage = () => {
  const { games, sessions, statuses, hasSettings, selectedGame, setSelectedGame } =
    useGameContext();

  const recentActivity = useMemo(() => getRecentActivity(games), [games]);

  // Flat timeline: every logged session across all games, newest first.
  const gamesById = useMemo(() => {
    const map = new Map<number, SteamGame>();
    for (const g of games) map.set(g.appid, g);
    return map;
  }, [games]);

  const timeline = useMemo(() => {
    const flat = Object.entries(sessions).flatMap(([appidStr, list]) =>
      (list ?? []).map((s) => ({ ...s, appid: Number(appidStr) })),
    );
    flat.sort((a, b) => {
      const diff = b.date.localeCompare(a.date);
      return diff !== 0 ? diff : b.id.localeCompare(a.id);
    });
    return flat;
  }, [sessions]);

  // Infinite scroll — { count, forLength } resets to PAGE_SIZE when timeline grows.
  const [page, setPage] = useState({ count: PAGE_SIZE, forLength: 0 });
  const displayCount =
    page.forLength === timeline.length ? page.count : Math.min(PAGE_SIZE, timeline.length);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const loadMore = useCallback(() => {
    setPage((p) => ({
      forLength: timeline.length,
      count: Math.min(p.count + PAGE_SIZE, timeline.length),
    }));
  }, [timeline.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  const visibleEntries = timeline.slice(0, displayCount);

  // Resolve accurate vertical cover URLs (handles newer hash-pathed assets).
  const [coverUrls, setCoverUrls] = useState<Record<number, string>>({});
  useEffect(() => {
    if (recentActivity.length === 0) return;
    const appids = recentActivity.map((g) => g.appid);
    window.electronAPI
      .resolveCovers(appids)
      .then(setCoverUrls)
      .catch((err) => console.error('Failed to resolve covers:', err));
  }, [recentActivity]);

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
                  <CoverImage
                    appid={game.appid}
                    name={game.name}
                    resolvedUrl={coverUrls[game.appid]}
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

      {/* --- Timeline --- */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Timeline</h2>
          <span className={styles.sectionHint}>
            {timeline.length} {timeline.length === 1 ? 'session' : 'sessions'}
          </span>
        </div>

        {timeline.length === 0 ? (
          <p className={styles.emptyHint}>No sessions logged yet. Click a recent game to start.</p>
        ) : (
          <>
            <ul className={styles.timeline}>
              {visibleEntries.map((session) => {
                const game = gamesById.get(session.appid);
                if (!game) return null;
                const status = statuses[session.appid]?.status;
                return (
                  <li key={session.id} className={styles.timelineRow}>
                    <button
                      type="button"
                      className={styles.timelineBtn}
                      onClick={() => setSelectedGame(game)}
                    >
                      <div className={styles.timelineThumb}>
                        <img
                          src={getHeaderImageUrl(game.appid)}
                          alt={game.name}
                          loading="lazy"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.visibility = 'hidden';
                          }}
                        />
                      </div>
                      <div className={styles.timelineInfo}>
                        <div className={styles.timelineTitle}>{game.name}</div>
                        <div className={styles.timelineMeta}>
                          <span className={styles.timelineDate}>
                            {formatLogDate(new Date(session.date).getTime())}
                          </span>
                          <span className={styles.timelineLength}>
                            {formatPlaytime(session.minutes)}
                          </span>
                          {typeof session.rating === 'number' && (
                            <span className={styles.timelineRating}>{session.rating}/100</span>
                          )}
                          {status && (
                            <span className={`${styles.statusBadge} ${styles[status]}`}>
                              {STATUS_LABELS[status]}
                            </span>
                          )}
                        </div>
                        {session.notes && <p className={styles.timelineNotes}>{session.notes}</p>}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {/* Sentinel — observed by IntersectionObserver to trigger next page */}
            {displayCount < timeline.length && (
              <div ref={sentinelRef} className={styles.sentinel} aria-hidden />
            )}
          </>
        )}
      </section>

      {selectedGame && <LogModal game={selectedGame} onClose={() => setSelectedGame(null)} />}
    </div>
  );
};
