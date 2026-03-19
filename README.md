# LoL Counter Picker

A desktop app that connects to your League of Legends client during champion select and recommends the best champion from your pool based on enemy picks.

## Features

- **Live draft detection** — Automatically connects to the League Client (LCU API) and detects when you enter champion select
- **Counter recommendations** — Ranks your champion pool by win rate against enemy picks using data from op.gg and lolalytics
- **Champion pool management** — Sync your most-played champions from op.gg or configure manually per lane
- **Cached matchup data** — Scrapes and caches matchup statistics locally, refreshes daily or on new patches
- **Confidence scoring** — Flags low-sample-size matchups so you know when data is reliable

## Setup

```bash
npm install
npm run dev
```

## Usage

1. **Configure your summoner** — Open Settings, enter your Riot ID (name + tagline) and region
2. **Build your champion pool** — Click "Sync Pool" to import from op.gg, or add champions manually per lane
3. **Scrape matchup data** — Click "Refresh Matchup Data" to populate win rates (runs in background)
4. **Play** — Start League, enter champion select. The app auto-connects and shows recommendations as enemies pick

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start in development mode with hot reload |
| `npm run build` | Build for production |
| `npm run start` | Preview the production build |
| `npm run package` | Package as macOS .dmg |
| `npm run package:win` | Package as Windows installer |

## Tech Stack

- Electron + React + Vite + TypeScript
- league-connect (LCU API)
- better-sqlite3 (local cache)
- cheerio (op.gg scraping)
- Data Dragon (champion assets)

## Architecture

```
src/
  main/           Electron main process
    lcu/          LCU connection, WebSocket listener, draft parsing
    scraper/      op.gg + lolalytics scrapers, background scheduler
    data/         SQLite DB, Data Dragon, recommendation engine, settings
    ipc.ts        IPC handlers bridging main <-> renderer
  preload/        Secure IPC bridge exposed to renderer
  renderer/       React UI
    components/   DraftView, Recommendations, Settings, StatusBar, ChampionCard
    hooks/        useDraftState (IPC listener hook)
```

## Data Sources

- **op.gg** — Primary matchup win rates via `#__NEXT_DATA__` parsing
- **lolalytics** — Secondary source via internal API endpoints
- **Data Dragon** — Champion names, IDs, and icons
