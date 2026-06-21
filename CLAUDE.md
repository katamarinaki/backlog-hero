# CLAUDE.md

Backlog Hero is an Electron desktop app for browsing your Steam library with notes, completion tracking, ratings, and achievements.

## Architecture

```
src/
├── main/                  # Electron main process (Node.js, CommonJS)
│   ├── main.ts            # Window creation, IPC handlers, electron-store, auto-updater
│   └── preload.ts         # contextBridge API exposed to renderer (electronAPI)
├── renderer/              # React UI (Vite, ESM, TypeScript)
│   ├── main.tsx           # Entry point — HashRouter + GameProvider
│   ├── components/        # Reusable UI components (kebab-case directories)
│   │   ├── header/        # Nav bar with Library/Settings links
│   │   └── game-card-modal/ # Game detail modal (status pills, notes, achievements)
│   ├── context/
│   │   └── game-context/  # GameProvider — all game state, filters, sorting, API calls
│   ├── pages/
│   │   ├── home-page/     # Library grid with search/filter/sort
│   │   └── settings-page/ # Steam API key config, refresh library, export/import
│   ├── styles.global.css  # CSS variables and base styles
│   └── types.d.ts         # Renderer-side type declarations + window.electronAPI
└── shared/                # Shared between main and renderer (pure TypeScript)
    ├── types.ts            # Shared type definitions (SteamGame, GameRating, etc.)
    ├── gameUtils.ts        # Pure filter/sort/format utilities
    └── gameUtils.test.ts   # 18 unit tests for gameUtils
```

## Key Patterns

- **kebab-case** for all file and directory names (e.g. `game-card-modal/`, `home-page/`)
- **CSS Modules** — each component/page has a co-located `.module.css`
- **Path aliases** — `components/*`, `pages/*`, `context/*` map to `src/renderer/*`; `@shared/*` maps to `src/shared/*`
- **GameContext** holds all game state; pages/components consume via `useGameContext()`
- **electron-store** persists all data locally (games, ratings, notes, statuses, achievements, filter prefs)
- **IPC** is request/response via `ipcMain.handle` / `ipcRenderer.invoke` plus progress events for batch fetches
- **electron-updater** checks GitHub Releases for updates every 4 hours in production builds

## Scripts

| Command             | Purpose                                                 |
| ------------------- | ------------------------------------------------------- |
| `npm run dev`       | Start renderer (Vite) + main process concurrently       |
| `npm run build`     | Compile main (tsc) + bundle renderer (Vite)             |
| `npm run test`      | Run vitest test suite                                   |
| `npm run lint`      | ESLint on all `.ts/.tsx` files                          |
| `npm run format`    | Prettier on all files                                   |
| `npm run typecheck` | TypeScript check for both renderer and main             |
| `npm run dist`      | Build + package for current platform (electron-builder) |

## Testing

- **Vitest** with `environment: 'node'`
- Tests live alongside source: `src/shared/gameUtils.test.ts`
- Run: `npm test` (also runs in pre-commit hook via `lint-staged && npm test`)

## CI/CD

### PR checks (`.github/workflows/pr-checks.yml`)

- Builds, runs tests, lints, and checks formatting on every PR

### Release flow

1. Bump `version` in `package.json` in a PR
2. Merge to `main` → `tag-on-merge.yml` auto-creates `v{version}` tag
3. Tag push triggers `release.yml` → builds macOS `.dmg`, Windows `.exe`, Linux `.AppImage`
4. Draft release created on GitHub with all artifacts
5. Publish the draft → `electron-updater` picks it up for users

## Conventions

- TypeScript strict mode enabled
- No unused locals/parameters enforced
- ESLint import ordering: builtin → external → internal → parent → sibling → index
- Pre-commit hook: `lint-staged` (eslint --fix on TS, prettier on JSON/MD/CSS) + `npm test`
- All new logic in `src/shared/` should have unit tests
- Shared types go in `src/shared/types.ts`; renderer-specific types in `src/renderer/types.d.ts`
