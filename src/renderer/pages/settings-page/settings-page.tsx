import { useState, useEffect } from 'react';

import { useGameContext } from 'context/game-context';
import type { FetchProgress } from 'types';

import styles from './settings-page.module.css';

export const SettingsPage = () => {
  const { games, saveSettings, refreshLibrary, fetchRatings, fetchAchievements, syncLoading } =
    useGameContext();

  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [status, setStatus] = useState<{
    section: 'credentials' | 'sync' | 'data';
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [progress, setProgress] = useState<FetchProgress | null>(null);
  const [betaUpdates, setBetaUpdates] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [updateStatus, setUpdateStatus] = useState<{
    type: string;
    version?: string;
    message?: string;
    percent?: number;
  } | null>(null);

  useEffect(() => {
    loadSettings();
    window.desktopAPI.getAppVersion().then(setAppVersion).catch(console.error);
    const stopUpdater = window.desktopAPI.onUpdaterStatus(setUpdateStatus);
    const stopRatings = window.desktopAPI.onRatingsProgress(setProgress);
    const stopAchievements = window.desktopAPI.onAchievementsProgress(setProgress);
    return () => {
      stopUpdater();
      stopRatings();
      stopAchievements();
    };
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await window.desktopAPI.getSettings();
      setApiKey(settings.apiKey || '');
      setSteamId(settings.steamId || '');
      const beta = await window.desktopAPI.getBetaUpdates();
      setBetaUpdates(beta);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const handleRefreshLibrary = async () => {
    setStatus(null);
    try {
      const count = await refreshLibrary();
      setStatus({
        section: 'sync',
        type: 'success',
        message: `Library refreshed! ${count} games loaded.`,
      });
    } catch {
      setStatus({
        section: 'sync',
        type: 'error',
        message: 'Failed to refresh library. Check your API key and internet connection.',
      });
    }
  };

  const handleFetchRatings = async () => {
    setStatus(null);
    setProgress(null);
    try {
      await fetchRatings();
      setStatus({ section: 'sync', type: 'success', message: 'Ratings fetched successfully!' });
    } catch {
      setStatus({ section: 'sync', type: 'error', message: 'Failed to fetch ratings.' });
    }
  };

  const handleFetchAchievements = async () => {
    setStatus(null);
    setProgress(null);
    try {
      await fetchAchievements();
      setStatus({
        section: 'sync',
        type: 'success',
        message: 'Achievements fetched successfully!',
      });
    } catch {
      setStatus({ section: 'sync', type: 'error', message: 'Failed to fetch achievements.' });
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{17}$/.test(steamId.trim())) {
      setStatus({
        section: 'credentials',
        type: 'error',
        message: 'Steam ID must be the 17-digit SteamID64.',
      });
      return;
    }
    setLoading(true);
    setStatus(null);

    try {
      await saveSettings({ apiKey, steamId });
      setStatus({
        section: 'credentials',
        type: 'success',
        message: 'Settings saved successfully!',
      });
    } catch {
      setStatus({ section: 'credentials', type: 'error', message: 'Failed to save settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    setDataLoading(true);
    setStatus(null);

    try {
      const exported = await window.desktopAPI.exportData();
      if (exported) {
        setStatus({ section: 'data', type: 'success', message: 'Data exported successfully.' });
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      setStatus({ section: 'data', type: 'error', message: 'Failed to export data.' });
    } finally {
      setDataLoading(false);
    }
  };

  const handleImport = async () => {
    setDataLoading(true);
    setStatus(null);

    try {
      const imported = await window.desktopAPI.importData();
      if (imported) {
        setStatus({
          section: 'data',
          type: 'success',
          message: 'Data imported. Refreshing the app...',
        });
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to import data:', error);
      setStatus({ section: 'data', type: 'error', message: 'Failed to import data.' });
    } finally {
      setDataLoading(false);
    }
  };

  const renderStatus = (section: 'credentials' | 'sync' | 'data') =>
    status?.section === section && (
      <div
        className={`${styles.statusMessage} ${status.type === 'success' ? styles.success : styles.error}`}
      >
        {status.message}
      </div>
    );

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

        {renderStatus('credentials')}

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
        {syncLoading && syncLoading !== 'library' && progress && (
          <p className={styles.syncProgress}>
            {progress.fetched} / {progress.total} games checked
          </p>
        )}
        {renderStatus('sync')}
      </div>

      <div className={styles.settingsSection}>
        <h2>Data</h2>
        <p className={styles.settingsDescription}>
          Export or import all local data for this app. Exports include your Steam API key, so keep
          them private. Importing replaces all current data.
        </p>
        <div className={styles.settingsActions}>
          <button className={styles.btnSecondary} onClick={handleExport} disabled={dataLoading}>
            {dataLoading ? 'Working...' : 'Export Data'}
          </button>
          <button className={styles.btnSecondary} onClick={handleImport} disabled={dataLoading}>
            {dataLoading ? 'Working...' : 'Import Data'}
          </button>
        </div>
        {renderStatus('data')}
      </div>

      <div className={styles.settingsSection}>
        <h2>Updates</h2>
        <p className={styles.settingsDescription}>
          Current version: <strong>{appVersion || '—'}</strong>{' '}
          <span className={styles.channelBadge}>
            {betaUpdates ? 'beta channel' : 'stable channel'}
          </span>
        </p>
        <p className={styles.settingsDescription}>
          Beta builds are created from every push to the develop branch. Enable to receive the
          latest changes before they are released. The version shown above only changes after an
          update has been downloaded and installed.
        </p>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            checked={betaUpdates}
            onChange={async (e) => {
              const value = e.target.checked;
              setBetaUpdates(value);
              setUpdateStatus(null);
              try {
                await window.desktopAPI.saveBetaUpdates(value);
              } catch (error) {
                setBetaUpdates(!value);
                setUpdateStatus({ type: 'error', message: String(error) });
              }
            }}
          />
          Use beta updates
        </label>

        {updateStatus && (
          <div className={styles.updateStatus}>
            {updateStatus.type === 'disabled' && (
              <span>
                {updateStatus.message}{' '}
                <a
                  href="https://github.com/katamarinaki/backlog-hero/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View releases
                </a>
              </span>
            )}
            {updateStatus.type === 'checking' && <span>Checking for updates…</span>}
            {updateStatus.type === 'available' && (
              <span>Update available: v{updateStatus.version} — downloading…</span>
            )}
            {updateStatus.type === 'downloading' && (
              <span>Downloading update… {updateStatus.percent ?? 0}%</span>
            )}
            {updateStatus.type === 'not-available' && (
              <span>You&apos;re up to date (v{updateStatus.version}).</span>
            )}
            {updateStatus.type === 'error' && (
              <span className={styles.error}>Update error: {updateStatus.message}</span>
            )}
            {updateStatus.type === 'downloaded' && (
              <div className={styles.settingsActions}>
                <span>Version {updateStatus.version} is ready to install.</span>
                <button
                  className={styles.btnPrimary}
                  onClick={() => {
                    void window.desktopAPI
                      .installUpdate()
                      .catch((error) => setUpdateStatus({ type: 'error', message: String(error) }));
                  }}
                >
                  Restart &amp; Install
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
