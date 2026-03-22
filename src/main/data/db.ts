import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  const dbPath = join(app.getPath('userData'), 'counter-picker.db')
  db = new Database(dbPath)

  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  db.exec(`
    CREATE TABLE IF NOT EXISTS matchups (
      champion TEXT NOT NULL,
      opponent TEXT NOT NULL,
      lane TEXT NOT NULL,
      win_rate REAL NOT NULL,
      games_played INTEGER NOT NULL DEFAULT 0,
      lane_kill_rate REAL,
      gold_adv_15 REAL,
      source TEXT NOT NULL DEFAULT 'opgg',
      patch TEXT,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (champion, opponent, lane, source)
    );

    CREATE TABLE IF NOT EXISTS champion_pool (
      summoner_id TEXT NOT NULL DEFAULT 'local',
      champion TEXT NOT NULL,
      lanes TEXT NOT NULL DEFAULT 'mid',
      mastery_points INTEGER NOT NULL DEFAULT 0,
      games_played INTEGER NOT NULL DEFAULT 0,
      win_rate REAL,
      kda REAL,
      PRIMARY KEY (summoner_id, champion)
    );

    CREATE TABLE IF NOT EXISTS champion_roles (
      champion TEXT NOT NULL,
      lane TEXT NOT NULL,
      pick_rate REAL NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (champion, lane)
    );

    CREATE TABLE IF NOT EXISTS build_cache (
      champion TEXT NOT NULL,
      opponent TEXT NOT NULL,
      lane TEXT NOT NULL,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      PRIMARY KEY (champion, opponent, lane)
    );

    CREATE INDEX IF NOT EXISTS idx_matchups_champion_lane ON matchups(champion, lane);
    CREATE INDEX IF NOT EXISTS idx_matchups_opponent_lane ON matchups(opponent, lane);
    CREATE INDEX IF NOT EXISTS idx_pool_champion ON champion_pool(champion);
    CREATE INDEX IF NOT EXISTS idx_champion_roles_champion ON champion_roles(champion);
  `)

  // Migrate champion_pool from old per-lane schema to multi-lane schema
  const poolCols = db.pragma('table_info(champion_pool)') as { name: string }[]
  if (poolCols.some((c) => c.name === 'lane') && !poolCols.some((c) => c.name === 'lanes')) {
    const oldRows = db.prepare('SELECT summoner_id, champion, lane, mastery_points, games_played FROM champion_pool').all() as {
      summoner_id: string; champion: string; lane: string; mastery_points: number; games_played: number
    }[]
    const grouped = new Map<string, { summoner_id: string; champion: string; lanes: Set<string>; mastery_points: number; games_played: number }>()
    for (const row of oldRows) {
      const key = `${row.summoner_id}::${row.champion}`
      const existing = grouped.get(key)
      if (existing) {
        existing.lanes.add(row.lane)
        existing.games_played = Math.max(existing.games_played, row.games_played)
        existing.mastery_points = Math.max(existing.mastery_points, row.mastery_points)
      } else {
        grouped.set(key, { summoner_id: row.summoner_id, champion: row.champion, lanes: new Set([row.lane]), mastery_points: row.mastery_points, games_played: row.games_played })
      }
    }
    db.exec('DROP TABLE champion_pool')
    db.exec(`
      CREATE TABLE champion_pool (
        summoner_id TEXT NOT NULL DEFAULT 'local',
        champion TEXT NOT NULL,
        lanes TEXT NOT NULL DEFAULT 'mid',
        mastery_points INTEGER NOT NULL DEFAULT 0,
        games_played INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (summoner_id, champion)
      )
    `)
    const ins = db.prepare('INSERT INTO champion_pool (summoner_id, champion, lanes, mastery_points, games_played) VALUES (?, ?, ?, ?, ?)')
    for (const entry of grouped.values()) {
      ins.run(entry.summoner_id, entry.champion, [...entry.lanes].join(','), entry.mastery_points, entry.games_played)
    }
  }

  const poolColsAfter = db.pragma('table_info(champion_pool)') as { name: string }[]
  if (!poolColsAfter.some((c) => c.name === 'win_rate')) {
    db.exec('ALTER TABLE champion_pool ADD COLUMN win_rate REAL')
  }
  if (!poolColsAfter.some((c) => c.name === 'kda')) {
    db.exec('ALTER TABLE champion_pool ADD COLUMN kda REAL')
  }

  const cols = db.pragma('table_info(matchups)') as { name: string }[]
  if (!cols.some((c) => c.name === 'lane_kill_rate')) {
    db.exec('ALTER TABLE matchups ADD COLUMN lane_kill_rate REAL')
  }
  if (!cols.some((c) => c.name === 'gold_adv_15')) {
    db.exec('ALTER TABLE matchups ADD COLUMN gold_adv_15 REAL')
  }

  return db
}

export function upsertMatchup(
  champion: string,
  opponent: string,
  lane: string,
  winRate: number,
  gamesPlayed: number,
  source: string,
  patch: string | null,
  laneKillRate?: number | null,
  goldAdv15?: number | null
): void {
  const database = getDb()
  database.prepare(`
    INSERT INTO matchups (champion, opponent, lane, win_rate, games_played, lane_kill_rate, gold_adv_15, source, patch, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
    ON CONFLICT (champion, opponent, lane, source)
    DO UPDATE SET win_rate = excluded.win_rate, games_played = excluded.games_played,
                  lane_kill_rate = excluded.lane_kill_rate, gold_adv_15 = excluded.gold_adv_15,
                  patch = excluded.patch, updated_at = excluded.updated_at
  `).run(champion, opponent, lane, winRate, gamesPlayed, laneKillRate ?? null, goldAdv15 ?? null, source, patch)
}

export function getMatchupsForChampion(champion: string, lane: string, source?: string): {
  opponent: string
  winRate: number
  gamesPlayed: number
  laneKillRate: number | null
  goldAdv15: number | null
  source: string
}[] {
  const database = getDb()
  if (source) {
    return database.prepare(
      'SELECT opponent, win_rate as winRate, games_played as gamesPlayed, lane_kill_rate as laneKillRate, gold_adv_15 as goldAdv15, source FROM matchups WHERE champion = ? AND lane = ? AND source = ?'
    ).all(champion, lane, source) as any[]
  }
  return database.prepare(
    'SELECT opponent, win_rate as winRate, games_played as gamesPlayed, lane_kill_rate as laneKillRate, gold_adv_15 as goldAdv15, source FROM matchups WHERE champion = ? AND lane = ?'
  ).all(champion, lane) as any[]
}

export function upsertChampionRole(champion: string, lane: string, pickRate: number): void {
  const database = getDb()
  database.prepare(`
    INSERT INTO champion_roles (champion, lane, pick_rate, updated_at)
    VALUES (?, ?, ?, unixepoch())
    ON CONFLICT (champion, lane)
    DO UPDATE SET pick_rate = excluded.pick_rate, updated_at = excluded.updated_at
  `).run(champion, lane, pickRate)
}

export function getChampionRoles(champion: string): { lane: string; pickRate: number }[] {
  const database = getDb()
  return database.prepare(
    'SELECT lane, pick_rate as pickRate FROM champion_roles WHERE champion = ? ORDER BY pick_rate DESC'
  ).all(champion) as { lane: string; pickRate: number }[]
}

const BUILD_CACHE_TTL_S = 6 * 60 * 60

export function getCachedBuild(champion: string, opponent: string, lane: string): string | null {
  const database = getDb()
  const row = database.prepare(
    'SELECT data FROM build_cache WHERE champion = ? AND opponent = ? AND lane = ? AND updated_at > unixepoch() - ?'
  ).get(champion, opponent, lane, BUILD_CACHE_TTL_S) as { data: string } | undefined
  return row?.data ?? null
}

export function setCachedBuild(champion: string, opponent: string, lane: string, data: string): void {
  const database = getDb()
  database.prepare(`
    INSERT INTO build_cache (champion, opponent, lane, data, updated_at)
    VALUES (?, ?, ?, ?, unixepoch())
    ON CONFLICT (champion, opponent, lane)
    DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at
  `).run(champion, opponent, lane, data)
}

export function getChampionPool(lane?: string): { champion: string; lanes: string; masteryPoints: number; gamesPlayed: number; winRate: number | null; kda: number | null }[] {
  const database = getDb()
  if (lane) {
    return database.prepare(
      "SELECT champion, lanes, mastery_points as masteryPoints, games_played as gamesPlayed, win_rate as winRate, kda FROM champion_pool WHERE ',' || lanes || ',' LIKE '%,' || ? || ',%'"
    ).all(lane) as any[]
  }
  return database.prepare(
    'SELECT champion, lanes, mastery_points as masteryPoints, games_played as gamesPlayed, win_rate as winRate, kda FROM champion_pool'
  ).all() as any[]
}
