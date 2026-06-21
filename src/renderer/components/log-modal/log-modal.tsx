import { useEffect, useMemo, useState } from 'react';

import { useGameContext } from 'context/game-context';
import type { GameSession, GameStatusType, SteamGame } from 'types';

import { getSuggestedSessionMinutes, computeSharedRating } from '../../../shared/logUtils';
import { formatPlaytime } from '../../../shared/gameUtils';

import styles from './log-modal.module.css';

type Props = {
  game: SteamGame;
  onClose: () => void;
};

const STATUS_OPTIONS: GameStatusType[] = ['backlog', 'in_progress', 'completed', 'dropped'];
const STATUS_LABELS: Record<GameStatusType, string> = {
  backlog: 'Backlog',
  in_progress: 'In Progress',
  completed: 'Completed',
  dropped: 'Dropped',
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const getHeaderImageUrl = (appid: number) =>
  `https://steamcdn-a.akamaihd.net/steam/apps/${appid}/header.jpg`;

const formatSessionDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

export const LogModal = ({ game, onClose }: Props) => {
  const {
    sessions,
    saveSession,
    deleteSession,
    statuses,
    saveStatus,
    userRatings,
    saveUserRating,
  } = useGameContext();

  const gameSessions = useMemo(() => sessions[game.appid] ?? [], [sessions, game.appid]);
  const suggested = useMemo(
    () => getSuggestedSessionMinutes(game.playtime_2weeks ?? 0, gameSessions),
    [game.playtime_2weeks, gameSessions],
  );

  const currentRating = userRatings[game.appid];

  const [date, setDate] = useState(todayISO());
  const [hours, setHours] = useState(Math.floor(suggested / 60));
  const [minutes, setMinutes] = useState(suggested % 60);
  // The rating slider defaults to the game's current shared rating.
  const [rating, setRating] = useState(currentRating ?? 50);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const currentStatus = statuses[game.appid]?.status ?? null;

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const totalMinutes = Math.max(0, hours) * 60 + Math.max(0, minutes);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const handleSave = async () => {
    if (totalMinutes <= 0 || saving) return;
    setSaving(true);
    try {
      const session: GameSession = {
        id: crypto.randomUUID(),
        appid: game.appid,
        date,
        minutes: totalMinutes,
        rating,
        notes: notes.trim() || undefined,
      };
      await saveSession(game.appid, session);

      // Fold the session rating into the shared game rating (existing rating
      // counts as one session).
      const newRating = computeSharedRating(currentRating ?? null, rating);
      await saveUserRating(game.appid, newRating);

      // Reset the form: length -> remaining unlogged time, rating -> new shared.
      const remaining = Math.max(0, suggested - totalMinutes);
      setHours(Math.floor(remaining / 60));
      setMinutes(remaining % 60);
      setRating(newRating);
      setNotes('');
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (status: GameStatusType) => {
    const next = currentStatus === status ? null : status;
    if (next === null) {
      await saveStatus(statuses[game.appid]?.isEndless ? { isEndless: true } : null);
      return;
    }
    await saveStatus({
      status: next,
      statusDate: new Date().toISOString(),
      isEndless: statuses[game.appid]?.isEndless || undefined,
      completedDate: next === 'completed' ? date : undefined,
    });
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div className={styles.modal}>
        <button className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className={styles.headerImage}>
          <img
            src={getHeaderImageUrl(game.appid)}
            alt={game.name}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>

        <div className={styles.body}>
          <h2 className={styles.title}>{game.name}</h2>
          <p className={styles.subtitle}>
            {formatPlaytime(game.playtime_forever)} total
            {game.playtime_2weeks ? ` · ${formatPlaytime(game.playtime_2weeks)} last 2 weeks` : ''}
          </p>

          {/* Session length */}
          <section className={styles.field}>
            <label className={styles.fieldLabel}>Session length</label>
            <div className={styles.lengthInputs}>
              <div className={styles.numberField}>
                <input
                  type="number"
                  min="0"
                  value={hours}
                  onChange={(e) => setHours(parseInt(e.target.value, 10) || 0)}
                />
                <span>h</span>
              </div>
              <div className={styles.numberField}>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={minutes}
                  onChange={(e) => setMinutes(parseInt(e.target.value, 10) || 0)}
                />
                <span>m</span>
              </div>
            </div>
            <p className={styles.hint}>
              Suggested: {formatPlaytime(suggested)} (unlogged Steam time, last 2 weeks)
            </p>
          </section>

          {/* Date */}
          <section className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="session-date">
              Date
            </label>
            <input
              id="session-date"
              type="date"
              value={date}
              max={todayISO()}
              onChange={(e) => setDate(e.target.value)}
            />
          </section>

          {/* Rating */}
          <section className={styles.field}>
            <div className={styles.ratingHeader}>
              <label className={styles.fieldLabel} htmlFor="session-rating">
                Session rating
              </label>
              <span className={styles.ratingValue}>{rating}</span>
            </div>
            <input
              id="session-rating"
              type="range"
              min="0"
              max="100"
              value={rating}
              onChange={(e) => setRating(parseInt(e.target.value, 10))}
              className={styles.ratingSlider}
              aria-valuetext={`${rating} out of 100`}
            />
            <div className={styles.ratingRange}>
              <span>0</span>
              <span>100</span>
            </div>
            <p className={styles.hint}>
              {currentRating == null
                ? 'Sets the game rating'
                : `Averages into the game rating (currently ${currentRating})`}
            </p>
          </section>

          {/* Notes */}
          <section className={styles.field}>
            <label className={styles.fieldLabel} htmlFor="session-notes">
              Notes <span className={styles.optional}>(optional)</span>
            </label>
            <textarea
              id="session-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="What happened this session?"
              rows={3}
            />
          </section>

          {/* Status */}
          <section className={styles.field}>
            <label className={styles.fieldLabel}>Status</label>
            <div className={styles.statusPills}>
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  className={`${styles.statusPill} ${
                    currentStatus === status ? styles.statusPillActive : ''
                  } ${styles[status] ?? ''}`}
                  onClick={() => handleStatus(status)}
                >
                  {STATUS_LABELS[status]}
                </button>
              ))}
            </div>
          </section>

          <div className={styles.actions}>
            <button
              className={styles.btnPrimary}
              onClick={handleSave}
              disabled={totalMinutes <= 0 || saving}
            >
              {saving ? 'Logging…' : 'Log session'}
            </button>
          </div>

          {/* Existing sessions */}
          {gameSessions.length > 0 && (
            <section className={styles.history}>
              <h3 className={styles.historyTitle}>Logged sessions</h3>
              <ul className={styles.sessionList}>
                {[...gameSessions]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((s) => (
                    <li key={s.id} className={styles.sessionRow}>
                      <div className={styles.sessionMain}>
                        <span className={styles.sessionDate}>{formatSessionDate(s.date)}</span>
                        <span className={styles.sessionLength}>{formatPlaytime(s.minutes)}</span>
                        {typeof s.rating === 'number' && (
                          <span className={styles.sessionRating}>{s.rating}/100</span>
                        )}
                      </div>
                      {s.notes && <p className={styles.sessionNotes}>{s.notes}</p>}
                      <button
                        className={styles.sessionDelete}
                        onClick={() => deleteSession(game.appid, s.id)}
                        aria-label="Delete session"
                        title="Delete session"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
};
