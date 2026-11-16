import { useGameContext } from 'context/game-context';

import styles from './error-banner.module.css';

export const ErrorBanner = () => {
  const { error, clearError } = useGameContext();

  if (!error) return null;

  return (
    <div className={styles.errorBanner} role="alert">
      <span>{error}</span>
      <button onClick={clearError} className={styles.errorDismiss} aria-label="Dismiss error">
        ✕
      </button>
    </div>
  );
};
