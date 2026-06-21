import { useState, useEffect, useRef } from 'react';

import type { SteamGame, GameStatus, GameStatusType } from 'types';
import { useGameContext } from 'context/game-context';

import styles from './game-card-modal.module.css';

type Props = {
  game: SteamGame;
  onClose: () => void;
};

export const GameCardModal = ({ game, onClose }: Props) => {
  const {
    notes,
    statuses,
    achievements: allAchievements,
    ratings,
    saveNote,
    saveStatus,
  } = useGameContext();

  const gameStatus = statuses[game.appid];
  const achievements = allAchievements?.[game.appid];
  const rating = ratings[game.appid];

  const [note, setNote] = useState(notes[game.appid] ?? '');
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<GameStatusType | null>(
    gameStatus?.status ?? null,
  );
  const [completedDate, setCompletedDate] = useState(gameStatus?.completedDate ?? '');
  const [userRating, setUserRating] = useState<number | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRatingChange = (val: number) => {
    setUserRating(val);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      window.electronAPI.saveUserRating(game.appid, val);
    }, 400);
  };

  useEffect(() => {
    window.electronAPI.getUserRatings().then((ur) => {
      setUserRating(ur[game.appid] ?? null);
    });
  }, [game.appid]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Lazy fetch rating + achievements for this game
  const [lazyRating, setLazyRating] = useState<typeof rating | undefined>(undefined);
  const [lazyAchievements, setLazyAchievements] = useState<typeof achievements | undefined>(
    undefined,
  );
  const [ratingTs, setRatingTs] = useState<number | null>(null);
  const [achieveTs, setAchieveTs] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const appid = game.appid;

    const load = async () => {
      try {
        if (!rating) {
          const r = await window.electronAPI.fetchRating(appid);
          if (!cancelled && r) setLazyRating(r);
        }
        if (!achievements) {
          const a = await window.electronAPI.fetchAchievement(appid);
          if (!cancelled && a) setLazyAchievements(a);
        }
        const rt = await window.electronAPI.getRatingTimestamp(appid);
        if (!cancelled) setRatingTs(rt ?? (rating ? Date.now() : null));
        const at = await window.electronAPI.getAchievementTimestamp(appid);
        if (!cancelled) setAchieveTs(at ?? (achievements ? Date.now() : null));
      } catch (err) {
        console.error('Failed to fetch game data:', err);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [game.appid, rating, achievements]);

  const displayRating = rating || lazyRating;
  const displayAchievements = achievements || lazyAchievements;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSaveNote = async () => {
    setSaving(true);
    await saveNote(note);
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: GameStatusType | null) => {
    setSelectedStatus(newStatus);
    if (newStatus === null) {
      setCompletedDate('');
      await saveStatus(game.appid, null);
    } else {
      const statusObj: GameStatus = {
        status: newStatus,
        statusDate: new Date().toISOString(),
      };
      if (newStatus === 'completed' && completedDate) {
        statusObj.completedDate = completedDate;
      }
      await saveStatus(game.appid, statusObj);
    }
  };

  const handleDateChange = async (date: string) => {
    setCompletedDate(date);
    if (selectedStatus === 'completed') {
      await saveStatus(game.appid, {
        status: 'completed',
        statusDate: new Date().toISOString(),
        completedDate: date || undefined,
      });
    }
  };

  const getStatusLabel = (status: GameStatusType): string => {
    const labels: Record<GameStatusType, string> = {
      backlog: 'Backlog',
      completed: 'Completed',
      retired: 'Retired',
      dropped: 'Dropped',
    };
    return labels[status];
  };

  const formatPlaytime = (minutes: number): string => {
    if (minutes < 60) return `${minutes} minutes`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours.toLocaleString()} hours`;
    return `${hours.toLocaleString()} hours ${mins} min`;
  };

  const formatLastPlayed = (timestamp?: number): string => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getHeaderImageUrl = (appid: number): string => {
    return `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`;
  };

  const getRatingColor = (score: number): string => {
    if (score >= 70) return '#66c0f4';
    if (score >= 40) return '#b9a074';
    return '#a34c4c';
  };

  const getStatusPillClass = (status: GameStatusType) => {
    const statusMap: Record<GameStatusType, string> = {
      backlog: styles.statusBacklog,
      completed: styles.statusCompleted,
      retired: styles.statusRetired,
      dropped: styles.statusDropped,
    };
    return statusMap[status];
  };

  return (
    <div className={styles.modalBackdrop} onClick={handleBackdropClick}>
      <div className={styles.modalContent}>
        <button className={styles.modalClose} onClick={onClose}>
          &times;
        </button>

        <div className={styles.modalHeaderImage}>
          <img
            src={getHeaderImageUrl(game.appid)}
            alt={game.name}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        <div className={styles.modalBody}>
          <h2 className={styles.modalTitle}>{game.name}</h2>

          <div className={styles.statusSection}>
            <label className={styles.sectionLabel}>Game Status</label>
            <div className={styles.statusPills}>
              {(['backlog', 'completed', 'retired', 'dropped'] as const).map((status) => (
                <button
                  key={status}
                  className={`${styles.statusPill} ${selectedStatus === status ? `${styles.statusPillActive} ${getStatusPillClass(status)}` : ''}`}
                  onClick={() => handleStatusChange(status)}
                  type="button"
                >
                  {getStatusLabel(status)}
                </button>
              ))}
              <button
                className={`${styles.statusPill} ${selectedStatus === null ? `${styles.statusPillActive} ${styles.statusNone}` : ''}`}
                onClick={() => handleStatusChange(null)}
                type="button"
              >
                Clear
              </button>
            </div>
            {selectedStatus === 'completed' && (
              <div className={styles.completionDate}>
                <label htmlFor="completed-date">Completion date (optional)</label>
                <input
                  type="date"
                  id="completed-date"
                  value={completedDate}
                  onChange={(e) => handleDateChange(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className={styles.modalStats}>
            <div className={styles.statItem}>
              <span className={styles.statLabel}>Total Playtime</span>
              <span className={styles.statValue}>{formatPlaytime(game.playtime_forever)}</span>
            </div>

            {game.playtime_2weeks && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Last 2 Weeks</span>
                <span className={styles.statValue}>{formatPlaytime(game.playtime_2weeks)}</span>
              </div>
            )}

            <div className={styles.statItem}>
              <span className={styles.statLabel}>Last Played</span>
              <span className={styles.statValue}>{formatLastPlayed(game.rtime_last_played)}</span>
            </div>

            <div className={styles.statItem}>
              <span className={styles.statLabel}>App ID</span>
              <span className={styles.statValue}>{game.appid}</span>
            </div>

            {displayAchievements && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Achievements</span>
                <span className={styles.statValue}>
                  {displayAchievements.achieved} / {displayAchievements.total}
                  {displayAchievements.total > 0 && (
                    <span className={styles.achievementPercent}>
                      {' '}
                      (
                      {Math.round((displayAchievements.achieved / displayAchievements.total) * 100)}
                      %)
                    </span>
                  )}
                </span>
                {achieveTs && (
                  <span className={styles.lastUpdated}>
                    Updated {new Date(achieveTs).toLocaleDateString()}
                  </span>
                )}
              </div>
            )}
          </div>

          {displayRating && (
            <div
              className={styles.modalRating}
              style={{ borderColor: getRatingColor(displayRating.score) }}
            >
              <div
                className={styles.ratingHeader}
                style={{ color: getRatingColor(displayRating.score) }}
              >
                {displayRating.description}
              </div>
              <div className={styles.ratingDetails}>
                <span>{displayRating.score}% positive</span>
                <span className={styles.ratingSeparator}>|</span>
                <span>{displayRating.total.toLocaleString()} reviews</span>
              </div>
              <div className={styles.ratingBar}>
                <div
                  className={styles.ratingBarPositive}
                  style={{
                    width: `${displayRating.score}%`,
                    backgroundColor: getRatingColor(displayRating.score),
                  }}
                />
              </div>
              {ratingTs && (
                <div className={styles.lastUpdated}>
                  Updated {new Date(ratingTs).toLocaleDateString()}
                </div>
              )}
            </div>
          )}

          <div className={styles.userRatingSection}>
            <label>Your Rating</label>
            <div className={styles.ratingComparison}>
              <div className={styles.yourRating}>
                <span className={styles.ratingValue}>{userRating ?? '—'}</span>
                <span className={styles.ratingLabel}>You</span>
              </div>
              <span className={styles.ratingVs}>vs</span>
              <div className={styles.steamRating}>
                <span
                  className={styles.ratingValue}
                  style={rating ? { color: getRatingColor(rating.score) } : undefined}
                >
                  {rating ? `${rating.score}%` : '—'}
                </span>
                <span className={styles.ratingLabel}>Steam</span>
              </div>
            </div>
            <input
              id="user-rating"
              type="range"
              min="0"
              max="100"
              value={userRating ?? 0}
              aria-label="Your personal rating"
              aria-valuetext={`${userRating ?? 0} out of 100`}
              onChange={(e) => {
                handleRatingChange(parseInt(e.target.value, 10));
              }}
              className={styles.ratingSlider}
            />
            <div className={styles.ratingRange}>
              <span>0</span>
              <span>100</span>
            </div>
          </div>

          <div className={styles.modalNotes}>
            <label htmlFor="game-notes">Your Notes</label>
            <textarea
              id="game-notes"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write your impressions, thoughts, or notes about this game..."
              rows={5}
            />
            <button className={styles.btnPrimary} onClick={handleSaveNote} disabled={saving}>
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </div>

          <div className={styles.modalActions}>
            <a
              href={`https://store.steampowered.com/app/${game.appid}`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.btnSecondary}
            >
              View on Steam
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
