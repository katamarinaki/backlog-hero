# Backlog Hero

Backlog Hero is an Electron desktop app for browsing your Steam library with notes, session logging, ratings, and game status tracking.

## Features

- Fetches your owned games from the Steam Web API
- Caches library, ratings, achievements, notes, statuses, and sessions locally
- **Library** — search, sort, and filter; game detail modal with playtime, achievements, store link, notes, and status
- **Log** — recent activity (games played in the last 2 weeks) and a full session timeline
  - Log a gaming session (length, date, personal rating 0–100, notes) from any game card
  - Session rating averages into the game's shared rating
  - Suggested session length auto-calculated from Steam's 2-week playtime minus already-logged time
- **Status system** — Backlog · Completed · Retired (for endless games) · Dropped; _In Progress_ is derived automatically from logged sessions
- Per-game notes and personal ratings

## Requirements

- Node.js and npm
- Steam Web API key and SteamID64

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the app in development mode:
   ```bash
   npm run dev
   ```
3. Open Settings in the app and add:
   - Steam API key: https://steamcommunity.com/dev/apikey
   - SteamID64: https://steamid.io

## Scripts

- `npm run dev`: Run the Vite renderer and Electron main process together
- `npm run dev:renderer`: Start the renderer only (Vite)
- `npm run dev:main`: Compile and run Electron main
- `npm run build`: Build renderer and compile Electron main
- `npm run start`: Build and run the packaged app
- `npm run typecheck`: TypeScript checks for renderer and main
- `npm run dist`: Build and package for the current platform
- `npm run dist:win`: Build and package a Windows installer
- `npm run dist:mac`: Build and package a macOS DMG

## Development Notes

- The Electron main process is in `src/main/main.ts`.
- The React renderer is in `src/renderer`.
- Local data is stored with `electron-store`.

## Packaging

- Windows: run `npm run dist:win` on Windows to produce an NSIS installer in `release/`.
- macOS: run `npm run dist:mac` on macOS to produce a DMG in `release/`.

## Auto Updates

- Auto updates are enabled in production builds via `electron-updater`.
- Releases are expected to be published on GitHub for this repository.
- When the app starts (and every 4 hours), it checks for updates, downloads them in the
  background, and surfaces a **Restart & Install** button in **Settings → Updates**.

### Channels

- **Stable** (default): updates come from the latest published GitHub release.
- **Beta**: enable **Use beta updates** in Settings to track the rolling `beta` release tag,
  which is rebuilt on every push to `develop`. Beta versions are numbered as a prerelease of
  the next stable (e.g. stable `1.0.10` → beta `1.0.11-beta.N`), so when the matching stable
  ships you roll forward onto it automatically after switching back to the stable channel.

### macOS (unsigned)

The app is **not signed with an Apple Developer certificate**. Squirrel.Mac refuses to install
an unsigned/ad-hoc bundle (`code object is not signed at all`), so on macOS we bypass it: the
update zip is downloaded by `electron-updater`, then a small detached helper waits for the app
to quit, swaps the `.app` bundle in place, and relaunches it. Builds are ad-hoc signed in
`scripts/after-pack.js` so they launch on Apple Silicon. Windows (NSIS) and Linux (AppImage)
use the standard `electron-updater` install path.

## Releases

- On every push to `main`, GitHub Actions builds Windows and macOS installers and creates/updates a draft release.
- The release tag and name are `v<package.json version>`. Bump the version before merging to `main`.
