# Backlog Hero

Backlog Hero uses Tauri 2 with a React/TypeScript interface and a Rust desktop backend.

## Architecture

- `src/renderer/desktop-api.ts` implements the typed `window.desktopAPI` bridge using Tauri commands and events. It loads before React renders. Pages consume the bridge through GameContext or directly.
- `src-tauri/src/main.rs` dispatches desktop operations and creates native backup dialogs.
- `src-tauri/src/store.rs` owns JSON persistence, validation, atomic writes, and first-run Electron migration. Preserve compatibility with existing backups and leave legacy data untouched.
- `src-tauri/src/steam.rs` owns Steam requests, timeouts, retry handling, ratings, achievements, and cover resolution. Never log URLs containing credentials.
- `src-tauri/src/updater.rs` uses signed Tauri updates with stable/beta GitHub manifests. `TAURI_UPDATER_PUBLIC_KEY` is embedded at build time. Unconfigured builds offer manual downloads.
- `src/renderer/` contains React pages, components, CSS Modules, and GameContext.
- `src/shared/` contains pure TypeScript domain utilities and types.

## Conventions

Use kebab-case for frontend files and directories, CSS Modules for component styles, and the existing path aliases (`components/*`, `pages/*`, `context/*`, `@shared/*`). TypeScript is strict. Use standard Rust module naming and rustfmt in the backend.

Statuses are backlog, completed, retired, or dropped. In Progress is derived from sessions without an explicit status. Preserve the existing session-rating calculations in the frontend.

Keep store locks out of asynchronous network operations. Merge fetched data into the current store to avoid losing concurrent changes. Persist before publishing successful mutation results. Validate imported data before replacing the store.

## Validation

Run `npm run typecheck`, `npm test`, `npm run lint`, `npm run format:check`, and `npm run build`. Backend changes also require `cargo fmt --manifest-path src-tauri/Cargo.toml --check`, `npm run test:rust`, and `cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings`. New shared logic needs unit tests. Add backend tests for data migration and persistence changes.

`npm run dev` launches the desktop app; `npm run dist` builds installers under `src-tauri/target/release/bundle`. Read README.md for prerequisites, data paths, update signing, and release workflows.
