import { useState, useEffect, useRef } from 'react';

import type { SteamGame, GameStatus, GameStatusType } from 'types';
import { useGameContext } from 'context/game-context';
import { useModalDialog } from 'components/use-modal-dialog';

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
    userRatings,
    saveNote,
    saveStatus,
    saveUserRating,
  } = useGameContext();

  const gameStatus = statuses[game.appid];
  const achievements = allAchievements?.[game.appid];
  const rating = ratings[game.appid];

  const savedNote = notes[game.appid] ?? '';
  const [note, setNote] = useState(savedNote);
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<GameStatusType | null>(
    gameStatus?.status ?? null,
  );
  const [completedDate, setCompletedDate] = useState(gameStatus?.completedDate ?? '');
  const [userRating, setUserRating] = useState<number | null>(userRatings[game.appid] ?? null);
  const [headerFailed, setHeaderFailed] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRatingChange = (val: number) => {
    setUserRating(val);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveUserRating(game.appid, val);
    }, 400);
  };

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
          const r = await window.desktopAPI.fetchRating(appid);
          if (!cancelled && r) setLazyRating(r);
        }
        if (!achievements) {
          const a = await window.desktopAPI.fetchAchievement(appid);
          if (!cancelled && a) setLazyAchievements(a);
        }
        const rt = await window.desktopAPI.getRatingTimestamp(appid);
        if (!cancelled) setRatingTs(rt);
        const at = await window.desktopAPI.getAchievementTimestamp(appid);
        if (!cancelled) setAchieveTs(at);
      } catch (err) {
        console.error('Failed to fetch game data:', err);
      }
    };
    load();

    return () => {
      cancelled = true;
    };
  }, [game.appid, rating, achievements]);

  const fetchedRating = rating || lazyRating;
  const displayRating = fetchedRating?.total ? fetchedRating : undefined;
  const displayAchievements = achievements || lazyAchievements;

  const handleClose = async () => {
    try {
      if (note !== savedNote) await saveNote(note);
    } catch (err) {
      console.error('Failed to save note on close:', err);
    }
    onClose();
  };
  const modalRef = useModalDialog(handleClose);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) handleClose();
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
    return '#e07a7a';
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
      <div
        className={styles.modalContent}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="game-modal-title"
        tabIndex={-1}
      >
        <button className={styles.modalClose} onClick={handleClose} aria-label="Close">
          ✕
        </button>

        {!headerFailed && (
          <div className={styles.modalHeaderImage}>
            <img
              src={getHeaderImageUrl(game.appid)}
              alt={game.name}
              onError={() => setHeaderFailed(true)}
            />
          </div>
        )}

        <div className={styles.modalBody}>
          <h2 id="game-modal-title" className={styles.modalTitle}>
            {game.name}
          </h2>

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
                  style={displayRating ? { color: getRatingColor(displayRating.score) } : undefined}
                >
                  {displayRating ? `${displayRating.score}%` : '—'}
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
              className={`${styles.ratingSlider} ${userRating === null ? styles.ratingSliderUnset : ''}`}
            />
            <div className={styles.ratingRange}>
              <span>0</span>
              <span>100</span>
            </div>
            {userRating === null && (
              <p className={styles.ratingHint}>Not rated yet. Drag the slider to rate.</p>
            )}
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
            <button
              className={styles.btnPrimary}
              onClick={handleSaveNote}
              disabled={saving || note === savedNote}
            >
              {saving ? 'Saving...' : note === savedNote && savedNote ? 'Saved' : 'Save Note'}
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
