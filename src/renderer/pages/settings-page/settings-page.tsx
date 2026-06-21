import { useState, useEffect } from 'react';

import { useGameContext } from 'context/game-context';

import styles from './settings-page.module.css';

export const SettingsPage = () => {
  const { games, refreshLibrary, fetchRatings, fetchAchievements, syncLoading } = useGameContext();

  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [betaUpdates, setBetaUpdates] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      setApiKey(settings.apiKey || '');
      setSteamId(settings.steamId || '');
      const beta = await window.electronAPI.getBetaUpdates();
      setBetaUpdates(beta);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleRefreshLibrary = async () => {
    setStatus(null);
    try {
      await refreshLibrary();
      setStatus({ type: 'success', message: `Library refreshed! ${games.length} games loaded.` });
    } catch {
      setStatus({ type: 'error', message: 'Failed to refresh library.' });
    }
  };

  const handleFetchRatings = async () => {
    setStatus(null);
    try {
      await fetchRatings();
      setStatus({ type: 'success', message: 'Ratings fetched successfully!' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to fetch ratings.' });
    }
  };

  const handleFetchAchievements = async () => {
    setStatus(null);
    try {
      await fetchAchievements();
      setStatus({ type: 'success', message: 'Achievements fetched successfully!' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to fetch achievements.' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    try {
      await window.electronAPI.saveSettings({ apiKey, steamId });
      setStatus({ type: 'success', message: 'Settings saved successfully!' });
    } catch {
      setStatus({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setDataLoading(true);
    setStatus(null);

    try {
      const exported = await window.electronAPI.exportData();
      if (exported) {
        setStatus({ type: 'success', message: 'Data exported successfully.' });
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      setStatus({ type: 'error', message: 'Failed to export data.' });
    } finally {
      setDataLoading(false);
    }
  };

  const handleImport = async () => {
    setDataLoading(true);
    setStatus(null);

    try {
      const imported = await window.electronAPI.importData();
      if (imported) {
        setStatus({
          type: 'success',
          message: 'Data imported. Refreshing the app...',
        });
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      setStatus({ type: 'error', message: 'Failed to import data.' });
    } finally {
      setDataLoading(false);
    }
  };

  return (
    <div className={styles.settingsPage}>
      <h1>Settings</h1>
      <p className={styles.settingsDescription}>
        Configure your Steam API credentials to fetch your game library.
      </p>

      <form onSubmit={handleSave} className={styles.settingsForm}>
        <div className={styles.formGroup}>
          <label htmlFor="apiKey">Steam API Key</label>
          <input
            type="password"
            id="apiKey"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Enter your Steam API key"
          />
          <small>
            Get your API key from{' '}
            <a
              href="https://steamcommunity.com/dev/apikey"
              target="_blank"
              rel="noopener noreferrer"
            >
              Steam Web API
            </a>
          </small>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="steamId">Steam ID</label>
          <input
            type="text"
            id="steamId"
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
            placeholder="Enter your Steam ID (64-bit)"
          />
          <small>
            Find your Steam ID at{' '}
            <a href="https://steamid.io" target="_blank" rel="noopener noreferrer">
              steamid.io
            </a>
          </small>
        </div>

        {status && (
          <div
            className={`${styles.statusMessage} ${status.type === 'success' ? styles.success : styles.error}`}
          >
            {status.message}
          </div>
        )}

        <button type="submit" className={styles.btnPrimary} disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div className={styles.settingsSection}>
        <h2>Library Sync</h2>
        <p className={styles.settingsDescription}>
          Sync your Steam library data.{' '}
          {games.length > 0 && `Currently ${games.length} games in library.`}
        </p>
        <div className={styles.settingsActions}>
          <button
            className={styles.btnPrimary}
            onClick={handleRefreshLibrary}
            disabled={syncLoading !== null}
          >
            {syncLoading === 'library' ? 'Refreshing...' : 'Refresh Library'}
          </button>
          <button
            className={styles.btnSecondary}
            onClick={handleFetchRatings}
            disabled={syncLoading !== null || games.length === 0}
          >
            {syncLoading === 'ratings' ? 'Loading...' : 'Fetch Ratings'}
          </button>
          <button
            className={styles.btnSecondary}
            onClick={handleFetchAchievements}
            disabled={syncLoading !== null || games.length === 0}
          >
            {syncLoading === 'achievements' ? 'Loading...' : 'Fetch Achievements'}
          </button>
        </div>
      </div>

      <div className={styles.settingsSection}>
        <h2>Data</h2>
        <p className={styles.settingsDescription}>Export or import all local data for this app.</p>
        <div className={styles.settingsActions}>
          <button className={styles.btnSecondary} onClick={handleExport} disabled={dataLoading}>
            {dataLoading ? 'Working...' : 'Export Data'}
          </button>
          <button className={styles.btnSecondary} onClick={handleImport} disabled={dataLoading}>
            {dataLoading ? 'Working...' : 'Import Data'}
          </button>
        </div>
      </div>

      <div className={styles.settingsSection}>
        <h2>Updates</h2>
        <p className={styles.settingsDescription}>
          Beta builds are created from every push to the develop branch. Enable to receive the
          latest changes before they are released.
        </p>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={betaUpdates}
            onChange={async (e) => {
              const value = e.target.checked;
              setBetaUpdates(value);
              await window.electronAPI.saveBetaUpdates(value);
            }}
          />
          Use beta updates
        </label>
      </div>
    </div>
  );
};
