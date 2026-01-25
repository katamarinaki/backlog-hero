import { useState, useEffect } from 'react';

import type {
  SteamGame,
  GameRating,
  GameStatus,
  GameStatusType,
  GameAchievements,
} from '../types/electron';

import styles from './GameCardModal.module.css';

interface GameCardModalProps {
  game: SteamGame;
  rating?: GameRating;
  note: string;
  status?: GameStatus;
  achievements?: GameAchievements;
  onClose: () => void;
  onSaveNote: (note: string) => void;
  onSaveStatus: (status: GameStatus | null) => void;
}

function GameCardModal({
  game,
  rating,
  note: initialNote,
  status: initialStatus,
  achievements,
  onClose,
  onSaveNote,
  onSaveStatus,
}: GameCardModalProps) {
  const [note, setNote] = useState(initialNote);
  const [saving, setSaving] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<GameStatusType | null>(
    initialStatus?.status ?? null,
  );
  const [completedDate, setCompletedDate] = useState(initialStatus?.completedDate ?? '');
  const [isEndless, setIsEndless] = useState(initialStatus?.isEndless ?? false);

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
    await onSaveNote(note);
    setSaving(false);
  };

  const handleStatusChange = async (newStatus: GameStatusType | null) => {
    setSelectedStatus(newStatus);

    if (newStatus === null) {
      setCompletedDate('');
      if (isEndless) {
        // Keep endless flag but clear status
        await onSaveStatus({
          isEndless: true,
        });
      } else {
        await onSaveStatus(null);
      }
    } else {
      const statusObj: GameStatus = {
        status: newStatus,
        statusDate: new Date().toISOString(),
        isEndless: isEndless || undefined,
      };

      if (newStatus === 'completed' && completedDate) {
        statusObj.completedDate = completedDate;
      }

      await onSaveStatus(statusObj);
    }
  };

  const handleEndlessToggle = async () => {
    const newIsEndless = !isEndless;
    setIsEndless(newIsEndless);

    // If marking as endless and currently completed, clear the status
    if (newIsEndless && selectedStatus === 'completed') {
      setSelectedStatus(null);
      setCompletedDate('');
      await onSaveStatus({
        isEndless: true,
      });
    } else if (newIsEndless) {
      // Just mark as endless, keep current status (or no status)
      await onSaveStatus({
        status: selectedStatus || undefined,
        statusDate: selectedStatus ? new Date().toISOString() : undefined,
        isEndless: true,
      });
    } else if (!newIsEndless && !selectedStatus) {
      // Unmarking endless with no status - clear everything
      await onSaveStatus(null);
    } else {
      // Unmarking endless but has a status - keep the status
      await onSaveStatus({
        status: selectedStatus!,
        statusDate: new Date().toISOString(),
        completedDate: selectedStatus === 'completed' ? completedDate || undefined : undefined,
      });
    }
  };

  const handleDateChange = async (date: string) => {
    setCompletedDate(date);
    if (selectedStatus === 'completed') {
      await onSaveStatus({
        status: 'completed',
        statusDate: new Date().toISOString(),
        completedDate: date || undefined,
      });
    }
  };

  const getStatusLabel = (status: GameStatusType): string => {
    const labels: Record<GameStatusType, string> = {
      completed: 'Completed',
      in_progress: 'In Progress',
      dropped: 'Dropped',
      backlog: 'Backlog',
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
      completed: styles.statusCompleted,
      in_progress: styles.statusInProgress,
      dropped: styles.statusDropped,
      backlog: styles.statusBacklog,
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
              {(['backlog', 'in_progress', 'completed', 'dropped'] as const).map((status) => {
                const isDisabled = status === 'completed' && isEndless;
                return (
                  <button
                    key={status}
                    className={`${styles.statusPill} ${selectedStatus === status ? `${styles.statusPillActive} ${getStatusPillClass(status)}` : ''} ${isDisabled ? styles.statusPillDisabled : ''}`}
                    onClick={() => !isDisabled && handleStatusChange(status)}
                    type="button"
                    disabled={isDisabled}
                    title={isDisabled ? 'Endless games cannot be completed' : undefined}
                  >
                    {getStatusLabel(status)}
                  </button>
                );
              })}
              <button
                className={`${styles.statusPill} ${selectedStatus === null ? `${styles.statusPillActive} ${styles.statusNone}` : ''}`}
                onClick={() => handleStatusChange(null)}
                type="button"
              >
                Clear
              </button>
            </div>
            <div className={styles.endlessToggle}>
              <label className={styles.endlessCheckbox}>
                <input type="checkbox" checked={isEndless} onChange={handleEndlessToggle} />
                <span className={styles.checkboxLabel}>Endless game (no campaign/story to complete)</span>
              </label>
            </div>
            {selectedStatus === 'completed' && !isEndless && (
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

            {achievements && (
              <div className={styles.statItem}>
                <span className={styles.statLabel}>Achievements</span>
                <span className={styles.statValue}>
                  {achievements.achieved} / {achievements.total}
                  {achievements.total > 0 && (
                    <span className={styles.achievementPercent}>
                      {' '}
                      ({Math.round((achievements.achieved / achievements.total) * 100)}%)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {rating && (
            <div className={styles.modalRating} style={{ borderColor: getRatingColor(rating.score) }}>
              <div className={styles.ratingHeader} style={{ color: getRatingColor(rating.score) }}>
                {rating.description}
              </div>
              <div className={styles.ratingDetails}>
                <span>{rating.score}% positive</span>
                <span className={styles.ratingSeparator}>|</span>
                <span>{rating.total.toLocaleString()} reviews</span>
              </div>
              <div className={styles.ratingBar}>
                <div
                  className={styles.ratingBarPositive}
                  style={{
                    width: `${rating.score}%`,
                    backgroundColor: getRatingColor(rating.score),
                  }}
                />
              </div>
            </div>
          )}

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
              disabled={saving || note === initialNote}
            >
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
}

export default GameCardModal;
