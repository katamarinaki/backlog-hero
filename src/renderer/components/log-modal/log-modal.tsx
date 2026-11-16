import { useEffect, useMemo, useRef, useState } from 'react';

import { useGameContext } from 'context/game-context';
import { useModalDialog } from 'components/use-modal-dialog';
import type { GameSession, GameStatusType, SteamGame } from 'types';

import { getSuggestedSessionMinutes, computeSharedRating } from '../../../shared/logUtils';
import { formatPlaytime } from '../../../shared/gameUtils';

import styles from './log-modal.module.css';

type Props = {
  game: SteamGame;
  onClose: () => void;
  /** Opens the form editing this session instead of creating a new one. */
  initialSessionId?: string;
  onShowDetails?: () => void;
};

const STATUS_OPTIONS: GameStatusType[] = ['backlog', 'completed', 'retired', 'dropped'];
const STATUS_LABELS: Record<GameStatusType, string> = {
  backlog: 'Backlog',
  completed: 'Completed',
  retired: 'Retired',
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

export const LogModal = ({ game, onClose, initialSessionId, onShowDetails }: Props) => {
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
  const currentStatus = statuses[game.appid]?.status ?? null;

  // Edit mode — when set, the form edits this session instead of creating a new one
  const [editingSession, setEditingSession] = useState<GameSession | null>(
    () => gameSessions.find((s) => s.id === initialSessionId) ?? null,
  );

  // Form state
  const initialMinutes = editingSession?.minutes ?? suggested;
  const [date, setDate] = useState(editingSession?.date ?? todayISO());
  const [hours, setHours] = useState(Math.floor(initialMinutes / 60));
  const [minutes, setMinutes] = useState(initialMinutes % 60);
  const [rating, setRating] = useState(editingSession?.rating ?? currentRating ?? 50);
  const [notes, setNotes] = useState(editingSession?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const confirmDeleteRef = useRef<HTMLButtonElement>(null);
  const [headerFailed, setHeaderFailed] = useState(false);

  // Keep the length fields in sync with the suggestion (e.g. if sessions
  // finish loading after the modal mounts). Only updates when not editing.
  useEffect(() => {
    if (!editingSession) {
      setHours(Math.floor(suggested / 60));
      setMinutes(suggested % 60);
    }
  }, [suggested, editingSession]);

  const modalRef = useModalDialog(onClose);

  // Focus the armed button so that moving focus anywhere else disarms it.
  useEffect(() => {
    confirmDeleteRef.current?.focus();
  }, [confirmDeleteId]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  const totalMinutes = Math.max(0, hours) * 60 + Math.max(0, minutes);

  const resetForm = () => {
    setDate(todayISO());
    setHours(Math.floor(suggested / 60));
    setMinutes(suggested % 60);
    setRating(currentRating ?? 50);
    setNotes('');
    setEditingSession(null);
  };

  const startEdit = (s: GameSession) => {
    setEditingSession(s);
    setDate(s.date);
    setHours(Math.floor(s.minutes / 60));
    setMinutes(s.minutes % 60);
    setRating(s.rating ?? currentRating ?? 50);
    setNotes(s.notes ?? '');
    modalRef.current?.scrollTo(0, 0);
  };

  const handleSave = async () => {
    if (totalMinutes <= 0 || saving) return;
    setSaving(true);
    try {
      if (editingSession) {
        // Update existing session — no rating recalculation (just correcting data)
        await saveSession(game.appid, {
          ...editingSession,
          date,
          minutes: totalMinutes,
          rating,
          notes: notes.trim() || undefined,
        });
      } else {
        // New session
        await saveSession(game.appid, {
          id: crypto.randomUUID(),
          appid: game.appid,
          date,
          minutes: totalMinutes,
          rating,
          notes: notes.trim() || undefined,
        });
        // Fold into shared game rating
        const newRating = computeSharedRating(currentRating ?? null, rating);
        await saveUserRating(game.appid, newRating);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleStatus = async (status: GameStatusType) => {
    const next = currentStatus === status ? null : status;
    if (next === null) {
      await saveStatus(game.appid, null);
      return;
    }
    await saveStatus(game.appid, {
      status: next,
      statusDate: new Date().toISOString(),
      completedDate: next === 'completed' ? date : undefined,
    });
  };

  return (
    <div className={styles.backdrop} onClick={handleBackdropClick}>
      <div
        className={styles.modal}
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="log-modal-title"
        tabIndex={-1}
      >
        <button className={styles.close} onClick={onClose} aria-label="Close">
          ✕
        </button>

        {!headerFailed && (
          <div className={styles.headerImage}>
            <img
              src={getHeaderImageUrl(game.appid)}
              alt={game.name}
              onError={() => setHeaderFailed(true)}
            />
          </div>
        )}

        <div className={styles.body}>
          <h2 id="log-modal-title" className={styles.title}>
            {game.name}
          </h2>
          <p className={styles.subtitle}>
            {formatPlaytime(game.playtime_forever)} total
            {game.playtime_2weeks ? ` · ${formatPlaytime(game.playtime_2weeks)} last 2 weeks` : ''}
            {onShowDetails && (
              <>
                {' · '}
                <button type="button" className={styles.detailsLink} onClick={onShowDetails}>
                  Game details
                </button>
              </>
            )}
          </p>

          {/* Form heading changes in edit mode */}
          {editingSession && (
            <div className={styles.editBanner}>
              <span>Editing session from {formatSessionDate(editingSession.date)}</span>
              <button type="button" className={styles.editCancel} onClick={resetForm}>
                Cancel
              </button>
            </div>
          )}

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
            {!editingSession && (
              <p className={styles.hint}>
                Suggested: {formatPlaytime(suggested)} (unlogged Steam time, last 2 weeks)
              </p>
            )}
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
            {!editingSession && (
              <p className={styles.hint}>
                {currentRating == null
                  ? 'Sets the game rating'
                  : `Averages into the game rating (currently ${currentRating})`}
              </p>
            )}
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
            <label className={styles.fieldLabel}>
              Status <span className={styles.optional}>(optional)</span>
            </label>
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
              {saving ? 'Saving…' : editingSession ? 'Update session' : 'Log session'}
            </button>
            {totalMinutes <= 0 && <p className={styles.hint}>Enter a session length to log it.</p>}
          </div>

          {/* Existing sessions */}
          {gameSessions.length > 0 && (
            <section className={styles.history}>
              <h3 className={styles.historyTitle}>Logged sessions</h3>
              <ul className={styles.sessionList}>
                {[...gameSessions]
                  .sort((a, b) => b.date.localeCompare(a.date))
                  .map((s) => (
                    <li
                      key={s.id}
                      className={`${styles.sessionRow} ${editingSession?.id === s.id ? styles.sessionRowEditing : ''}`}
                    >
                      <div className={styles.sessionMain}>
                        <span className={styles.sessionDate}>{formatSessionDate(s.date)}</span>
                        <span className={styles.sessionLength}>{formatPlaytime(s.minutes)}</span>
                        {typeof s.rating === 'number' && (
                          <span className={styles.sessionRating}>{s.rating}/100</span>
                        )}
                      </div>
                      {s.notes && <p className={styles.sessionNotes}>{s.notes}</p>}
                      <div className={styles.sessionActions}>
                        {confirmDeleteId === s.id ? (
                          <button
                            className={styles.sessionDeleteConfirm}
                            ref={confirmDeleteRef}
                            // WebKit blurs a button on mousedown, which would disarm before the click.
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => deleteSession(game.appid, s.id)}
                            onBlur={() => setConfirmDeleteId(null)}
                          >
                            Delete?
                          </button>
                        ) : (
                          <>
                            <button
                              className={styles.sessionEdit}
                              onClick={() => startEdit(s)}
                              aria-label="Edit session"
                              title="Edit session"
                            >
                              ✎
                            </button>
                            <button
                              className={styles.sessionDelete}
                              onClick={() => setConfirmDeleteId(s.id)}
                              aria-label="Delete session"
                              title="Delete session"
                            >
                              ✕
                            </button>
                          </>
                        )}
                      </div>
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
