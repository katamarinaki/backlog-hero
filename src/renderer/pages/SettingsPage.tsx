import { useState, useEffect } from 'react';

function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [status, setStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

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
    } catch (error) {
      setStatus({ type: 'error', message: 'Failed to save settings' });
    } finally {
      setLoading(false);
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
            <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer">
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

        {status && (
          <div className={`status-message ${status.type}`}>
            {status.message}
          </div>
        )}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}

export default SettingsPage;
