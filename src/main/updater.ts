import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow } from 'electron';

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

function broadcast(channel: string, data: unknown) {
  BrowserWindow.getAllWindows().forEach((win) => {
    win.webContents.send(channel, data);
  });
}

function log(msg: string) {
  const line = `[updater] ${msg}`;
  console.log(line);
  broadcast('updater-log', line);
}

export function initAutoUpdater(broadcastEvents = true): void {
  if (!app.isPackaged) {
    log('Skipping auto-updater — app is not packaged (development mode)');
    return;
  }

  // Force stable-only updates (GitHub release page must not be a prerelease)
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  const useBeta = store.get('useBetaUpdates', false);
  const feed = getFeedURL(useBeta);
  log(
    `Setting feed URL: provider=${feed.provider}, owner=${GITHUB_OWNER}, repo=${GITHUB_REPO}, beta=${useBeta}`,
  );

  autoUpdater.setFeedURL(feed);

  if (broadcastEvents) {
    autoUpdater.on('checking-for-update', () => {
      log('Checking for update...');
    });

    autoUpdater.on('update-available', (info) => {
      log(`Update available: v${info.version}`);
      broadcast('updater-status', { type: 'available', version: info.version });
    });

    autoUpdater.on('update-not-available', (info) => {
      log(`No update available (current: ${info.version})`);
      broadcast('updater-status', { type: 'not-available', version: info.version });
    });

    autoUpdater.on('download-progress', (progress) => {
      broadcast('updater-status', { type: 'downloading', percent: Math.round(progress.percent) });
    });

    autoUpdater.on('update-downloaded', (info) => {
      log(`Update downloaded: v${info.version} — will install on quit`);
      broadcast('updater-status', { type: 'downloaded', version: info.version });
    });

    autoUpdater.on('error', (error) => {
      log(`Error: ${error.message}`);
      broadcast('updater-status', { type: 'error', message: error.message });
    });
  }

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    log(`checkForUpdatesAndNotify() rejected: ${error.message}`);
    broadcast('updater-status', { type: 'error', message: error.message });
  });

  const intervalMs = 4 * 60 * 60 * 1000;
  setInterval(() => {
    log('Periodic update check...');
    autoUpdater.checkForUpdatesAndNotify().catch((error) => {
      log(`Periodic check failed: ${error.message}`);
    });
  }, intervalMs);
}

export function toggleBetaFeed(useBeta: boolean): void {
  if (useBeta) {
    autoUpdater.allowPrerelease = true;
    autoUpdater.allowDowngrade = true;
  } else {
    autoUpdater.allowPrerelease = false;
    autoUpdater.allowDowngrade = false;
  }

  const feed = getFeedURL(useBeta);
  log(`Toggle beta: switching to provider=${feed.provider}, beta=${useBeta}`);
  autoUpdater.setFeedURL(feed);

  autoUpdater.checkForUpdatesAndNotify().catch((error) => {
    log(`Toggle check failed: ${error.message}`);
    broadcast('updater-status', { type: 'error', message: error.message });
  });
}
