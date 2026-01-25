import { useState, useEffect } from 'react';

import type {
  SteamGame,
  GameRating,
  GameStatus,
  GameStatusType,
  GameAchievements,
} from '../types/electron';

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
      await onSaveStatus(null);
    } else {
      const statusObj: GameStatus = {
        status: newStatus,
        statusDate: new Date().toISOString(),
      };

      if (newStatus === 'completed' && completedDate) {
        statusObj.completedDate = completedDate;
      }

      await onSaveStatus(statusObj);
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

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <button className="modal-close" onClick={onClose}>
          &times;
        </button>

        <div className="modal-header-image">
          <img
            src={getHeaderImageUrl(game.appid)}
            alt={game.name}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        <div className="modal-body">
          <h2 className="modal-title">{game.name}</h2>

          <div className="status-section">
            <label className="section-label">Game Status</label>
            <div className="status-pills">
              {(['backlog', 'in_progress', 'completed', 'dropped'] as const).map((status) => (
                <button
                  key={status}
                  className={`status-pill ${selectedStatus === status ? 'active' : ''} status-${status}`}
                  onClick={() => handleStatusChange(status)}
                  type="button"
                >
                  {getStatusLabel(status)}
                </button>
              ))}
              <button
                className={`status-pill ${selectedStatus === null ? 'active' : ''} status-none`}
                onClick={() => handleStatusChange(null)}
                type="button"
              >
                Clear
              </button>
            </div>
            {selectedStatus === 'completed' && (
              <div className="completion-date">
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

          <div className="modal-stats">
            <div className="stat-item">
              <span className="stat-label">Total Playtime</span>
              <span className="stat-value">{formatPlaytime(game.playtime_forever)}</span>
            </div>

            {game.playtime_2weeks && (
              <div className="stat-item">
                <span className="stat-label">Last 2 Weeks</span>
                <span className="stat-value">{formatPlaytime(game.playtime_2weeks)}</span>
              </div>
            )}

            <div className="stat-item">
              <span className="stat-label">Last Played</span>
              <span className="stat-value">{formatLastPlayed(game.rtime_last_played)}</span>
            </div>

            <div className="stat-item">
              <span className="stat-label">App ID</span>
              <span className="stat-value">{game.appid}</span>
            </div>

            {achievements && (
              <div className="stat-item">
                <span className="stat-label">Achievements</span>
                <span className="stat-value">
                  {achievements.achieved} / {achievements.total}
                  {achievements.total > 0 && (
                    <span className="achievement-percent">
                      {' '}
                      ({Math.round((achievements.achieved / achievements.total) * 100)}%)
                    </span>
                  )}
                </span>
              </div>
            )}
          </div>

          {rating && (
            <div className="modal-rating" style={{ borderColor: getRatingColor(rating.score) }}>
              <div className="rating-header" style={{ color: getRatingColor(rating.score) }}>
                {rating.description}
              </div>
              <div className="rating-details">
                <span>{rating.score}% positive</span>
                <span className="rating-separator">|</span>
                <span>{rating.total.toLocaleString()} reviews</span>
              </div>
              <div className="rating-bar">
                <div
                  className="rating-bar-positive"
                  style={{
                    width: `${rating.score}%`,
                    backgroundColor: getRatingColor(rating.score),
                  }}
                />
              </div>
            </div>
          )}

          <div className="modal-notes">
            <label htmlFor="game-notes">Your Notes</label>
            <textarea
              id="game-notes"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Write your impressions, thoughts, or notes about this game..."
              rows={5}
            />
            <button
              className="btn-primary"
              onClick={handleSaveNote}
              disabled={saving || note === initialNote}
            >
              {saving ? 'Saving...' : 'Save Note'}
            </button>
          </div>

          <div className="modal-actions">
            <a
              href={`https://store.steampowered.com/app/${game.appid}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
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
