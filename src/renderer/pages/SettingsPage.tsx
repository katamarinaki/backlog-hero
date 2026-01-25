import { useState, useEffect } from 'react';

function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const settings = await window.electronAPI.getSettings();
      setApiKey(settings.apiKey || '');
      setSteamId(settings.steamId || '');
    } catch (error) {
      console.error('Failed to load settings:', error);
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
    <div className="settings-page">
      <h1>Settings</h1>
      <p className="settings-description">
        Configure your Steam API credentials to fetch your game library.
      </p>

      <form onSubmit={handleSave} className="settings-form">
        <div className="form-group">
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

        <div className="form-group">
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

        {status && <div className={`status-message ${status.type}`}>{status.message}</div>}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>

      <div className="settings-section">
        <h2>Data</h2>
        <p className="settings-description">Export or import all local data for this app.</p>
        <div className="settings-actions">
          <button className="btn-secondary" onClick={handleExport} disabled={dataLoading}>
            {dataLoading ? 'Working...' : 'Export Data'}
          </button>
          <button className="btn-secondary" onClick={handleImport} disabled={dataLoading}>
            {dataLoading ? 'Working...' : 'Import Data'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsPage;
