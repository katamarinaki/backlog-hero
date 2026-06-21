/**
 * Pure helpers for the auto-updater. Kept in `shared/` so they can be unit
 * tested without pulling in Electron.
 */

export type UpdateFeed =
  | { provider: 'generic'; url: string }
  | { provider: 'github'; owner: string; repo: string };

/**
 * Returns the electron-updater feed config for the requested channel.
 *
 * - Stable uses the GitHub provider (published, non-prerelease releases).
 * - Beta uses a generic feed pointed at the rolling `beta` release tag, whose
 *   assets are replaced on every push to `develop`.
 */
export function getUpdateFeed(owner: string, repo: string, useBeta: boolean): UpdateFeed {
  if (useBeta) {
    return {
      provider: 'generic',
      url: `https://github.com/${owner}/${repo}/releases/download/beta/`,
    };
  }
  return { provider: 'github', owner, repo };
}

/**
 * Derives the installed macOS `.app` bundle path from the running executable
 * path, e.g.
 *   /Applications/Backlog Hero.app/Contents/MacOS/Backlog Hero
 *   -> /Applications/Backlog Hero.app
 *
 * If the path doesn't contain a `.app` bundle (non-bundled/dev), returns null.
 */
export function deriveAppBundlePath(exePath: string): string | null {
  const marker = '.app/';
  const index = exePath.indexOf(marker);
  if (index === -1) return null;
  return exePath.slice(0, index + marker.length - 1);
}
