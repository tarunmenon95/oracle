# LoL Counter Picker

A desktop app that connects to your League of Legends client during champion select and recommends the best champion from your pool based on enemy picks.

## Features

- **Live draft detection** — Automatically connects to the League Client (LCU API) and detects when you enter champion select
- **Counter recommendations** — Ranks your champion pool by win rate against enemy picks using data from op.gg and lolalytics
- **Champion pool management** — Sync your most-played champions from op.gg or configure manually per lane
- **Cached matchup data** — Scrapes and caches matchup statistics locally, refreshes daily or on new patches
- **Confidence scoring** — Flags low-sample-size matchups so you know when data is reliable

## Usage

1. **Configure your summoner** — Open Settings, enter your Riot ID (name + tagline) and region
2. **Build your champion pool** — Click "Sync Pool" to import from op.gg, or add champions manually per lane
3. **Scrape matchup data** — Click "Refresh Matchup Data" to populate win rates (runs in background)
4. **Play** — Start League, enter champion select. The app auto-connects and shows recommendations as enemies pick

## Installation

Download the latest release from the [releases page](https://github.com/yourusername/oracle-lol/releases).