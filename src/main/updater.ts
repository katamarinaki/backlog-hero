import { autoUpdater } from 'electron-updater';
import { app } from 'electron';

import { store } from './store';

const GITHUB_OWNER = 'katamarinaki';
const GITHUB_REPO = 'backlog-hero';

function getFeedURL(useBeta: boolean) {
  if (useBeta) {
    return {
      provider: 'generic' as const,
      url: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/beta/`,
    };
  }
  return {
    provider: 'github' as const,
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
  };
}

export function initAutoUpdater(): void {
  if (!app.isPackaged) return;

  const useBeta = store.get('useBetaUpdates', false);
  autoUpdater.setFeedURL(getFeedURL(useBeta));

  autoUpdater.on('error', (error) => {
    console.error('Auto update error:', error);
  });

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('Auto update check failed:', error);
  });

  const intervalMs = 4 * 60 * 60 * 1000;
  setInterval(() => {
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      console.error('Auto update check failed:', error);
    });
  }, intervalMs);
}

export function toggleBetaFeed(useBeta: boolean): void {
  autoUpdater.setFeedURL(getFeedURL(useBeta));
  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    console.error('Auto update check failed:', error);
  });
}
