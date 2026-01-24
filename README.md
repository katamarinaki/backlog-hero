# Steam Tracker

Steam Tracker is an Electron desktop app for browsing your Steam library and keeping lightweight notes and completion status per game.

## Features

- Fetches your owned games from the Steam Web API
- Caches library, ratings, achievements, notes, and completion state locally
- Search, sort, and filter by completion status, playtime, rating, and last played
- Game detail modal with playtime, last played, achievements, and store link
- Per-game notes and completion date tracking

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

## Development Notes

- The Electron main process is in `src/main/main.ts`.
- The React renderer is in `src/renderer`.
- Local data is stored with `electron-store`.
