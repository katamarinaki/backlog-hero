import { spawn } from 'child_process';
import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';

import { autoUpdater } from 'electron-updater';
import { app, BrowserWindow } from 'electron';

import { getUpdateFeed, deriveAppBundlePath } from '../shared/updaterUtils';

import { store } from './store';

const GITHUB_OWNER = 'katamarinaki';
const GITHUB_REPO = 'backlog-hero';

// Path to the zip that electron-updater downloaded to its cache (set on
// `update-downloaded`). On macOS we install this ourselves — see installUpdate().
let downloadedZipPath: string | null = null;
let downloadedVersion: string | null = null;

function getFeedURL(useBeta: boolean) {
  return getUpdateFeed(GITHUB_OWNER, GITHUB_REPO, useBeta);
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

export function initAutoUpdater(): void {
  if (!app.isPackaged) {
    log('Skipping auto-updater — app is not packaged (development mode)');
    return;
  }

  // The app is NOT signed with an Apple Developer certificate. macOS auto-update
  // normally goes through Squirrel.Mac, which mandatorily validates the new
  // bundle's code signature and refuses to install an unsigned/ad-hoc app
  // ("code object is not signed at all"). We therefore disable the Squirrel
  // hand-off entirely and install the downloaded build ourselves (installUpdate).
  //
  // Setting autoInstallOnAppQuit = false means electron-updater's MacUpdater
  // never calls the native Squirrel updater, so signature validation never runs
  // and `update-downloaded` still fires with a usable zip path.
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = false;
  // GitHub release assets don't support HTTP range requests, so differential
  // downloads always 501 and fall back to a full download anyway. Skip them.
  autoUpdater.disableDifferentialDownload = true;

  const useBeta = store.get('useBetaUpdates', false);
  autoUpdater.allowPrerelease = useBeta;
  autoUpdater.allowDowngrade = useBeta;

  const feed = getFeedURL(useBeta);
  log(
    `Setting feed URL: provider=${feed.provider}, owner=${GITHUB_OWNER}, repo=${GITHUB_REPO}, beta=${useBeta}`,
  );

  autoUpdater.setFeedURL(feed);

  // Register listeners once — these persist across toggleBetaFeed calls.
  autoUpdater.on('checking-for-update', () => {
    log('Checking for update...');
    broadcast('updater-status', { type: 'checking' });
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
    downloadedZipPath = info.downloadedFile;
    downloadedVersion = info.version;
    log(`Update downloaded: v${info.version} — ready to install (${info.downloadedFile})`);
    broadcast('updater-status', { type: 'downloaded', version: info.version });
  });
  autoUpdater.on('error', (error) => {
    log(`Error: ${error.message}`);
    broadcast('updater-status', { type: 'error', message: error.message });
  });

  autoUpdater.checkForUpdates().catch((error) => {
    log(`checkForUpdates() rejected: ${error.message}`);
    broadcast('updater-status', { type: 'error', message: error.message });
  });

  const intervalMs = 4 * 60 * 60 * 1000;
  setInterval(() => {
    log('Periodic update check...');
    autoUpdater.checkForUpdates().catch((error) => {
      log(`Periodic check failed: ${error.message}`);
    });
  }, intervalMs);
}

export function toggleBetaFeed(useBeta: boolean): void {
  autoUpdater.allowPrerelease = useBeta;
  autoUpdater.allowDowngrade = useBeta;

  const feed = getFeedURL(useBeta);
  log(`Toggle beta: switching to provider=${feed.provider}, beta=${useBeta}`);
  autoUpdater.setFeedURL(feed);

  autoUpdater.checkForUpdates().catch((error) => {
    log(`Toggle check failed: ${error.message}`);
    broadcast('updater-status', { type: 'error', message: error.message });
  });
}

/**
 * Installs the downloaded update and relaunches the app.
 *
 * On Windows/Linux electron-updater's quitAndInstall works fine (NSIS / AppImage
 * don't require code signing). On macOS we cannot use Squirrel.Mac for an
 * unsigned app, so we spawn a detached helper that waits for this process to
 * exit, swaps the .app bundle in place, and relaunches it.
 *
 * Returns false if there is nothing to install.
 */
export function installUpdate(): boolean {
  if (process.platform !== 'darwin') {
    // Windows (NSIS) / Linux (AppImage) — standard path works.
    autoUpdater.quitAndInstall();
    return true;
  }

  if (!downloadedZipPath) {
    log('installUpdate() called but no downloaded update is available');
    return false;
  }

  // Derive the installed .app bundle path from the executable path, e.g.
  // /Applications/Backlog Hero.app/Contents/MacOS/Backlog Hero -> /Applications/Backlog Hero.app
  const exePath = app.getPath('exe');
  const installedAppPath = deriveAppBundlePath(exePath) ?? path.dirname(exePath);

  // Helper script: wait for us to quit, then swap the bundle and relaunch.
  // Designed so that a crash/kill at any point leaves a working app behind:
  //   1. Abort if the app is still alive after the timeout (never delete a
  //      bundle that is currently mapped/running).
  //   2. Stage the new bundle next to the target first (the slow cross-device
  //      copy), then swap via same-directory renames, which are atomic.
  //   3. Keep the old bundle as a .bak until the swap succeeds; restore it on
  //      failure.
  const script = `#!/bin/bash
set -e
APP_PID="$1"
ZIP="$2"
DEST="$3"

# Wait (up to ~30s) for the running app to exit so we can replace it.
ALIVE=1
for i in $(seq 1 60); do
  if ! kill -0 "$APP_PID" 2>/dev/null; then ALIVE=0; break; fi
  sleep 0.5
done

# Still running after the timeout — abort rather than delete a mapped bundle.
if [ "$ALIVE" -ne 0 ]; then
  exit 1
fi

TMP="$(mktemp -d)"
trap '/bin/rm -rf "$TMP"' EXIT
/usr/bin/unzip -qo "$ZIP" -d "$TMP"

NEW_APP="$(/usr/bin/find "$TMP" -maxdepth 1 -name '*.app' | head -1)"
if [ -z "$NEW_APP" ]; then
  exit 1
fi

# Strip quarantine on the staged copy so Gatekeeper doesn't block the relaunch.
/usr/bin/xattr -dr com.apple.quarantine "$NEW_APP" 2>/dev/null || true

# Stage on the destination filesystem so the final swap is atomic renames.
STAGE="\${DEST}.new"
BAK="\${DEST}.bak"
/bin/rm -rf "$STAGE" "$BAK"
/bin/mv "$NEW_APP" "$STAGE"

if [ -d "$DEST" ]; then
  /bin/mv "$DEST" "$BAK"
fi

if /bin/mv "$STAGE" "$DEST"; then
  /bin/rm -rf "$BAK"
else
  # Swap failed — restore the previous bundle so the user is never left without one.
  /bin/rm -rf "$DEST"
  if [ -d "$BAK" ]; then
    /bin/mv "$BAK" "$DEST"
  fi
  exit 1
fi

/usr/bin/open "$DEST"
`;

  try {
    const scriptDir = mkdtempSync(path.join(tmpdir(), 'backlog-hero-update-'));
    const scriptPath = path.join(scriptDir, 'install.sh');
    writeFileSync(scriptPath, script, { mode: 0o755 });

    log(`Installing update v${downloadedVersion ?? '?'} — spawning detached installer`);

    const child = spawn(
      '/bin/bash',
      [scriptPath, String(process.pid), downloadedZipPath, installedAppPath],
      { detached: true, stdio: 'ignore' },
    );
    child.unref();

    // Give the helper a moment to start, then quit so it can replace the bundle.
    setTimeout(() => app.quit(), 500);
    return true;
  } catch (error) {
    log(`Failed to start installer: ${(error as Error).message}`);
    return false;
  }
}
