# Backlog Hero

A Tauri desktop app for browsing your Steam library, tracking game statuses, and keeping notes, ratings, and a gaming session log. The interface uses React and TypeScript; the desktop backend uses Rust.

## Development

Install Node.js 22+, npm, and the current stable Rust toolchain. Follow the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for your OS (Xcode Command Line Tools on macOS, C++ Build Tools and WebView2 on Windows, WebKitGTK and build dependencies on Linux).

```sh
npm ci
npm run dev
```

In Settings, enter your [Steam API key](https://steamcommunity.com/dev/apikey) and SteamID64. Your Steam profile's game details must be visible to the API.

| Command                                                            | Purpose                                         |
| ------------------------------------------------------------------ | ----------------------------------------------- |
| `npm run dev`                                                      | Run the desktop app with Vite hot reload        |
| `npm run dev:renderer`                                             | Run Vite alone (desktop commands require Tauri) |
| `npm run build`                                                    | Typecheck and bundle the React interface        |
| `npm run dist`                                                     | Build native installers for the current OS      |
| `npm run dist:mac`                                                 | Build macOS app and DMG                         |
| `npm run dist:win`                                                 | Build a Windows NSIS installer on Windows       |
| `npm run typecheck`                                                | Check TypeScript                                |
| `npm test`                                                         | Run frontend/domain tests                       |
| `npm run test:rust`                                                | Run Rust persistence and migration tests        |
| `npm run lint`                                                     | Check TypeScript style                          |
| `npm run format:check`                                             | Check frontend/config/document formatting       |
| `cargo fmt --manifest-path src-tauri/Cargo.toml --check`           | Check Rust formatting                           |
| `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings` | Check Rust lint                                 |

Native bundles are written to `src-tauri/target/release/bundle/`.

## Data and migration from Electron

The Rust backend stores JSON in Tauri's app config directory under `com.steamtracker.backloghero`. It preserves the previous JSON layout, including credentials, cached games and covers, notes, statuses, ratings, sessions, and preferences.

On the first launch, if the new data file does not exist, the app first imports `config.json` from the previous Tauri directory, `com.steamtracker.app`, leaving the original untouched. An existing file in the new directory always takes precedence.

If neither Tauri directory has data, the app looks for Electron's `config.json` in the OS config directory under `backlog-hero`, `Backlog Hero`, `steam-tracker`, or `Steam Tracker`. On macOS it also checks `~/Library/Application Support`. It selects the candidate with the newest modification time and copies and migrates the data into the new directory, leaving the Electron file untouched. Subsequent launches use the Tauri file. Invalid source data produces a startup error instead of being overwritten.

Settings → Export Data / Import Data uses native file dialogs. Existing Electron JSON backups can be imported. Imports validate the data and run the legacy status migrations before replacing local data. Exports include your Steam credentials; keep backups private.

## Updates and releases

The GitHub workflows build macOS, Windows, and Linux packages with Tauri. Pushes to `develop` update the rolling `beta` prerelease; publishing a stable release builds assets for its tag. A manual release workflow run creates a draft. The app checks for updates at launch and every four hours, downloads a verified update, and offers Restart & Install in Settings.

Automatic updates require Tauri update signatures. Create a signing key pair with `npm run tauri signer generate -- -w <private-key-path>` and keep the private key outside the repository. Configure:

- Repository variable `TAURI_UPDATER_PUBLIC_KEY`: contents of the generated public key file.
- Repository secret `TAURI_SIGNING_PRIVATE_KEY`: contents of the private key file.
- Repository secret `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: key password, if one was set.

The workflows then enable `src-tauri/tauri.updater.conf.json`, sign updater artifacts, and publish `latest.json`. They serialize platform builds so each platform can merge its entry into the same manifest. Both stable and beta builds must use the same signing key. These signatures are separate from Apple code signing/notarization and Windows Authenticode signing.

Without a public key, packages build normally and Settings links to GitHub Releases for manual installation. Development builds do not check for updates.

The first Tauri version must be installed manually over the Electron app: Electron's updater cannot consume Tauri packages or its update manifest. Existing local data is imported on launch as described above.

## Source layout

- `src/renderer/`: React screens, styles, and the typed Tauri adapter (`desktop-api.ts`).
- `src/shared/`: pure TypeScript models and UI/domain utilities.
- `src-tauri/src/`: Rust command dispatch, Steam client, persistent store, and updater.
- `src-tauri/capabilities/`: webview permissions and allowed external links.

Steam requests run in Rust. The webview has no general HTTP or filesystem access; backups use native dialogs and external links use a scoped OS opener.
