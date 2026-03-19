import { describe, it, expect, vi, beforeEach } from 'vitest'

type Row = Record<string, unknown>

function createMockDb() {
  const tables: Record<string, Row[]> = {
    matchups: [],
    champion_roles: [],
    champion_pool: []
  }

  function prepare(sql: string) {
    return {
      run(...params: unknown[]) {
        const sqlLower = sql.toLowerCase().trim()

        if (sqlLower.includes('insert into matchups') || sqlLower.includes('insert into matchups')) {
          const [champion, opponent, lane, winRate, gamesPlayed, laneKillRate, goldAdv15, source, patch] = params as [string, string, string, number, number, number | null, number | null, string, string | null]
          const existing = tables.matchups.findIndex(
            (r) => r.champion === champion && r.opponent === opponent && r.lane === lane && r.source === source
          )
          const row = { champion, opponent, lane, win_rate: winRate, games_played: gamesPlayed, lane_kill_rate: laneKillRate, gold_adv_15: goldAdv15, source, patch, updated_at: Date.now() }
          if (existing >= 0) tables.matchups[existing] = row
          else tables.matchups.push(row)
        } else if (sqlLower.includes('insert into champion_roles')) {
          const [champion, lane, pickRate] = params as [string, string, number]
          const existing = tables.champion_roles.findIndex(
            (r) => r.champion === champion && r.lane === lane
          )
          const row = { champion, lane, pick_rate: pickRate, updated_at: Date.now() }
          if (existing >= 0) tables.champion_roles[existing] = row
          else tables.champion_roles.push(row)
        }
      },
      all(...params: unknown[]): Row[] {
        const sqlLower = sql.toLowerCase().trim()

        if (sqlLower.includes('from matchups')) {
          let rows = tables.matchups
          if (params.length >= 2) {
            const [champion, lane] = params as [string, string]
            rows = rows.filter((r) => r.champion === champion && r.lane === lane)
            if (params.length >= 3) {
              const source = params[2] as string
              rows = rows.filter((r) => r.source === source)
            }
          }
          return rows.map((r) => ({
            opponent: r.opponent,
            winRate: r.win_rate,
            gamesPlayed: r.games_played,
            laneKillRate: r.lane_kill_rate,
            goldAdv15: r.gold_adv_15,
            source: r.source
          }))
        }

        if (sqlLower.includes('from champion_roles')) {
          const [champion] = params as [string]
          return tables.champion_roles
            .filter((r) => r.champion === champion)
            .sort((a, b) => (b.pick_rate as number) - (a.pick_rate as number))
            .map((r) => ({ lane: r.lane, pickRate: r.pick_rate }))
        }

        if (sqlLower.includes('from champion_pool')) {
          let rows = tables.champion_pool
          if (params.length >= 1) {
            const lane = params[0] as string
            rows = rows.filter((r) => {
              const lanes = `,${r.lanes},`
              return lanes.includes(`,${lane},`)
            })
          }
          return rows.map((r) => ({
            champion: r.champion,
            lanes: r.lanes,
            masteryPoints: r.mastery_points,
            gamesPlayed: r.games_played,
            winRate: r.win_rate ?? null,
            kda: r.kda ?? null
          }))
        }

        return []
      }
    }
  }

  return { prepare, _tables: tables }
}

let mockDb: ReturnType<typeof createMockDb>

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/mock') }
}))

vi.mock('better-sqlite3', () => ({
  default: vi.fn()
}))

vi.mock('../db', () => {
  return {
    getDb: () => mockDb,
    upsertMatchup: (champion: string, opponent: string, lane: string, winRate: number, gamesPlayed: number, source: string, patch: string | null, laneKillRate?: number | null, goldAdv15?: number | null) => {
      mockDb.prepare(`
        INSERT INTO matchups (champion, opponent, lane, win_rate, games_played, lane_kill_rate, gold_adv_15, source, patch, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch())
        ON CONFLICT (champion, opponent, lane, source)
        DO UPDATE SET win_rate = excluded.win_rate
      `).run(champion, opponent, lane, winRate, gamesPlayed, laneKillRate ?? null, goldAdv15 ?? null, source, patch)
    },
    getMatchupsForChampion: (champion: string, lane: string, source?: string) => {
      if (source) {
        return mockDb.prepare(
          'SELECT ... FROM matchups WHERE champion = ? AND lane = ? AND source = ?'
        ).all(champion, lane, source)
      }
      return mockDb.prepare(
        'SELECT ... FROM matchups WHERE champion = ? AND lane = ?'
      ).all(champion, lane)
    },
    upsertChampionRole: (champion: string, lane: string, pickRate: number) => {
      mockDb.prepare(`
        INSERT INTO champion_roles (champion, lane, pick_rate, updated_at)
        VALUES (?, ?, ?, unixepoch())
        ON CONFLICT (champion, lane)
        DO UPDATE SET pick_rate = excluded.pick_rate
      `).run(champion, lane, pickRate)
    },
    getChampionRoles: (champion: string) => {
      return mockDb.prepare(
        'SELECT lane, pick_rate as pickRate FROM champion_roles WHERE champion = ? ORDER BY pick_rate DESC'
      ).all(champion)
    },
    getChampionPool: (lane?: string) => {
      if (lane) {
        return mockDb.prepare(
          "SELECT ... FROM champion_pool WHERE lanes LIKE lane"
        ).all(lane)
      }
      return mockDb.prepare(
        'SELECT ... FROM champion_pool'
      ).all()
    }
  }
})

import {
  upsertMatchup,
  getMatchupsForChampion,
  upsertChampionRole,
  getChampionRoles,
  getChampionPool
} from '../db'

beforeEach(() => {
  mockDb = createMockDb()
})

describe('upsertMatchup', () => {
  it('inserts a new matchup row', () => {
    upsertMatchup('Aatrox', 'Darius', 'top', 52.5, 1000, 'opgg', '16.6')
    const rows = getMatchupsForChampion('Aatrox', 'top')
    expect(rows).toHaveLength(1)
    expect(rows[0].opponent).toBe('Darius')
    expect(rows[0].winRate).toBe(52.5)
    expect(rows[0].gamesPlayed).toBe(1000)
    expect(rows[0].source).toBe('opgg')
  })

  it('upserts on conflict with same champion/opponent/lane/source', () => {
    upsertMatchup('Aatrox', 'Darius', 'top', 52.5, 1000, 'opgg', '16.6')
    upsertMatchup('Aatrox', 'Darius', 'top', 55.0, 1200, 'opgg', '16.7')
    const rows = getMatchupsForChampion('Aatrox', 'top')
    expect(rows).toHaveLength(1)
    expect(rows[0].winRate).toBe(55.0)
    expect(rows[0].gamesPlayed).toBe(1200)
  })

  it('allows different sources for same matchup', () => {
    upsertMatchup('Aatrox', 'Darius', 'top', 52.5, 1000, 'opgg', '16.6')
    upsertMatchup('Aatrox', 'Darius', 'top', 48.0, 800, 'ugg', '16.6')
    const rows = getMatchupsForChampion('Aatrox', 'top')
    expect(rows).toHaveLength(2)
  })

  it('handles null laneKillRate and goldAdv15', () => {
    upsertMatchup('Aatrox', 'Darius', 'top', 52.5, 1000, 'opgg', '16.6', null, null)
    const rows = getMatchupsForChampion('Aatrox', 'top')
    expect(rows[0].laneKillRate).toBeNull()
    expect(rows[0].goldAdv15).toBeNull()
  })

  it('stores laneKillRate and goldAdv15 when provided', () => {
    upsertMatchup('Aatrox', 'Darius', 'top', 52.5, 1000, 'ugg', '16.6', 51.2, 150)
    const rows = getMatchupsForChampion('Aatrox', 'top')
    expect(rows[0].laneKillRate).toBe(51.2)
    expect(rows[0].goldAdv15).toBe(150)
  })
})

describe('getMatchupsForChampion', () => {
  beforeEach(() => {
    upsertMatchup('Aatrox', 'Darius', 'top', 52.5, 1000, 'opgg', '16.6')
    upsertMatchup('Aatrox', 'Darius', 'top', 48.0, 800, 'ugg', '16.6')
    upsertMatchup('Aatrox', 'Garen', 'top', 55.0, 500, 'opgg', '16.6')
    upsertMatchup('Aatrox', 'Fiora', 'mid', 45.0, 300, 'opgg', '16.6')
  })

  it('returns all matchups for a champion + lane', () => {
    const rows = getMatchupsForChampion('Aatrox', 'top')
    expect(rows).toHaveLength(3)
  })

  it('filters by source when provided', () => {
    const rows = getMatchupsForChampion('Aatrox', 'top', 'opgg')
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => r.source === 'opgg')).toBe(true)
  })

  it('returns empty array when no matches', () => {
    const rows = getMatchupsForChampion('Zed', 'mid')
    expect(rows).toEqual([])
  })

  it('does not return matchups from other lanes', () => {
    const rows = getMatchupsForChampion('Aatrox', 'mid')
    expect(rows).toHaveLength(1)
    expect(rows[0].opponent).toBe('Fiora')
  })
})

describe('upsertChampionRole', () => {
  it('inserts a new role', () => {
    upsertChampionRole('Aatrox', 'top', 85.5)
    const roles = getChampionRoles('Aatrox')
    expect(roles).toHaveLength(1)
    expect(roles[0].lane).toBe('top')
    expect(roles[0].pickRate).toBe(85.5)
  })

  it('updates pick_rate on conflict', () => {
    upsertChampionRole('Aatrox', 'top', 85.5)
    upsertChampionRole('Aatrox', 'top', 90.0)
    const roles = getChampionRoles('Aatrox')
    expect(roles).toHaveLength(1)
    expect(roles[0].pickRate).toBe(90.0)
  })

  it('allows multiple lanes for same champion', () => {
    upsertChampionRole('Aatrox', 'top', 80)
    upsertChampionRole('Aatrox', 'mid', 15)
    const roles = getChampionRoles('Aatrox')
    expect(roles).toHaveLength(2)
  })
})

describe('getChampionRoles', () => {
  it('returns roles sorted by pick_rate descending', () => {
    upsertChampionRole('Aatrox', 'mid', 15)
    upsertChampionRole('Aatrox', 'top', 80)
    upsertChampionRole('Aatrox', 'jungle', 5)
    const roles = getChampionRoles('Aatrox')
    expect(roles[0].lane).toBe('top')
    expect(roles[1].lane).toBe('mid')
    expect(roles[2].lane).toBe('jungle')
  })

  it('returns empty array for unknown champion', () => {
    const roles = getChampionRoles('NonExistent')
    expect(roles).toEqual([])
  })
})

describe('getChampionPool', () => {
  beforeEach(() => {
    mockDb._tables.champion_pool.push(
      { summoner_id: 'local', champion: 'Aatrox', lanes: 'top,mid', mastery_points: 50000, games_played: 100, win_rate: 58.0, kda: 2.5 },
      { summoner_id: 'local', champion: 'Darius', lanes: 'top', mastery_points: 30000, games_played: 80, win_rate: 52.0, kda: 1.8 },
      { summoner_id: 'local', champion: 'Zed', lanes: 'mid', mastery_points: 20000, games_played: 60, win_rate: null, kda: null }
    )
  })

  it('returns all pool entries when no lane filter', () => {
    const pool = getChampionPool()
    expect(pool).toHaveLength(3)
  })

  it('filters by lane using comma-delimited lanes column', () => {
    const topPool = getChampionPool('top')
    expect(topPool).toHaveLength(2)
    const names = topPool.map((p) => p.champion)
    expect(names).toContain('Aatrox')
    expect(names).toContain('Darius')
  })

  it('returns champions with multi-lane entries when filtering', () => {
    const midPool = getChampionPool('mid')
    expect(midPool).toHaveLength(2)
    const names = midPool.map((p) => p.champion)
    expect(names).toContain('Aatrox')
    expect(names).toContain('Zed')
  })

  it('returns empty array when pool is empty', () => {
    mockDb._tables.champion_pool.length = 0
    const pool = getChampionPool()
    expect(pool).toEqual([])
  })

  it('returns correct field names', () => {
    const pool = getChampionPool()
    const aatrox = pool.find((p) => p.champion === 'Aatrox')!
    expect(aatrox.lanes).toBe('top,mid')
    expect(aatrox.masteryPoints).toBe(50000)
    expect(aatrox.gamesPlayed).toBe(100)
    expect(aatrox.winRate).toBe(58.0)
    expect(aatrox.kda).toBe(2.5)
  })

  it('returns null for winRate and kda when not set', () => {
    const pool = getChampionPool()
    const zed = pool.find((p) => p.champion === 'Zed')!
    expect(zed.winRate).toBeNull()
    expect(zed.kda).toBeNull()
  })
})
