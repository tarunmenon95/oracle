import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../db', () => ({
  getDb: vi.fn(),
  getChampionPool: vi.fn(),
  getChampionRoles: vi.fn()
}))

vi.mock('../ddragon', () => ({
  getCurrentPatch: vi.fn(() => '16.6.1'),
  getChampionInternalId: vi.fn((name: string) => name),
  getChampionIdByName: vi.fn((name: string) => {
    const ids: Record<string, number> = { Aatrox: 266, Darius: 122, Garen: 86, Fiora: 114, Camille: 164, Irelia: 39, Jax: 24, Riven: 92, Sett: 875, Mordekaiser: 82, Renekton: 58 }
    return ids[name] ?? 0
  })
}))

import { getDb, getChampionPool, getChampionRoles } from '../db'
import {
  computeRecommendations,
  inferTeamPositions,
  laneToLcuPosition,
  filterEnemiesByLane
} from '../recommender'

const mockGetChampionPool = vi.mocked(getChampionPool)
const mockGetChampionRoles = vi.mocked(getChampionRoles)
const mockGetDb = vi.mocked(getDb)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('laneToLcuPosition', () => {
  it('maps top -> top', () => {
    expect(laneToLcuPosition('top')).toBe('top')
  })

  it('maps jungle -> jungle', () => {
    expect(laneToLcuPosition('jungle')).toBe('jungle')
  })

  it('maps mid -> middle', () => {
    expect(laneToLcuPosition('mid')).toBe('middle')
  })

  it('maps bottom -> bottom', () => {
    expect(laneToLcuPosition('bottom')).toBe('bottom')
  })

  it('maps support -> utility', () => {
    expect(laneToLcuPosition('support')).toBe('utility')
  })

  it('returns unknown input as-is', () => {
    expect(laneToLcuPosition('roam')).toBe('roam')
    expect(laneToLcuPosition('fill')).toBe('fill')
  })
})

describe('inferTeamPositions', () => {
  it('returns empty map for empty input', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = inferTeamPositions([])
    expect(result.size).toBe(0)
  })

  it('skips members with championId <= 0', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = inferTeamPositions([
      { championId: 0, championName: '' }
    ])
    expect(result.size).toBe(0)
  })

  it('assigns a single champion with role data to its best lane', () => {
    mockGetChampionRoles.mockImplementation((name: string) => {
      if (name === 'Aatrox') return [{ lane: 'top', pickRate: 80 }, { lane: 'mid', pickRate: 5 }]
      return []
    })
    const result = inferTeamPositions([
      { championId: 266, championName: 'Aatrox' }
    ])
    expect(result.get('Aatrox')).toBe('top')
  })

  it('uses greedy assignment — highest pick rate wins contested lane', () => {
    mockGetChampionRoles.mockImplementation((name: string) => {
      if (name === 'Aatrox') return [{ lane: 'top', pickRate: 80 }]
      if (name === 'Darius') return [{ lane: 'top', pickRate: 90 }, { lane: 'jungle', pickRate: 3 }]
      return []
    })
    const result = inferTeamPositions([
      { championId: 266, championName: 'Aatrox' },
      { championId: 122, championName: 'Darius' }
    ])
    expect(result.get('Darius')).toBe('top')
    expect(result.get('Aatrox')).not.toBe('top')
  })

  it('falls back to assignedPosition when no role data', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = inferTeamPositions([
      { championId: 86, championName: 'Garen', assignedPosition: 'top' }
    ])
    expect(result.get('Garen')).toBe('top')
  })

  it('assigns unassigned champions to first open lane', () => {
    mockGetChampionRoles.mockImplementation((name: string) => {
      if (name === 'Aatrox') return [{ lane: 'top', pickRate: 90 }]
      return []
    })
    const result = inferTeamPositions([
      { championId: 266, championName: 'Aatrox' },
      { championId: 86, championName: 'Garen' }
    ])
    expect(result.get('Aatrox')).toBe('top')
    expect(result.has('Garen')).toBe(true)
    expect(result.get('Garen')).not.toBe('top')
  })

  it('assigns full team of 5 without duplicate lanes', () => {
    mockGetChampionRoles.mockImplementation((name: string) => {
      const data: Record<string, { lane: string; pickRate: number }[]> = {
        Aatrox: [{ lane: 'top', pickRate: 90 }],
        Darius: [{ lane: 'jungle', pickRate: 60 }],
        Garen: [{ lane: 'mid', pickRate: 70 }],
        Fiora: [{ lane: 'bottom', pickRate: 50 }],
        Camille: [{ lane: 'support', pickRate: 40 }]
      }
      return data[name] ?? []
    })
    const result = inferTeamPositions([
      { championId: 266, championName: 'Aatrox' },
      { championId: 122, championName: 'Darius' },
      { championId: 86, championName: 'Garen' },
      { championId: 114, championName: 'Fiora' },
      { championId: 164, championName: 'Camille' }
    ])
    const lanes = [...result.values()]
    expect(new Set(lanes).size).toBe(5)
  })
})

describe('filterEnemiesByLane', () => {
  it('filters to enemies assigned to the same lane', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = filterEnemiesByLane(
      [
        { championId: 122, championName: 'Darius', assignedPosition: 'top' },
        { championId: 86, championName: 'Garen', assignedPosition: 'middle' }
      ],
      'top'
    )
    expect(result).toEqual([{ championId: 122, championName: 'Darius' }])
  })

  it('excludes enemies inferred to a different lane even if they can flex', () => {
    mockGetChampionRoles.mockImplementation((name: string) => {
      if (name === 'Garen') return [{ lane: 'top', pickRate: 10 }, { lane: 'mid', pickRate: 60 }]
      return []
    })
    const result = filterEnemiesByLane(
      [
        { championId: 86, championName: 'Garen', assignedPosition: 'middle' },
        { championId: 122, championName: 'Darius', assignedPosition: 'top' }
      ],
      'top'
    )
    expect(result.length).toBe(1)
    expect(result[0].championName).toBe('Darius')
  })

  it('includes unassigned enemies that can play the lane via role data', () => {
    mockGetChampionRoles.mockImplementation((name: string) => {
      if (name === 'Garen') return [{ lane: 'top', pickRate: 10 }, { lane: 'mid', pickRate: 60 }]
      return []
    })
    const result = filterEnemiesByLane(
      [
        { championId: 86, championName: 'Garen', assignedPosition: '' }
      ],
      'top'
    )
    expect(result.some((e) => e.championName === 'Garen')).toBe(true)
  })

  it('narrows matchups as draft progresses and positions are inferred', () => {
    mockGetChampionRoles.mockImplementation((name: string) => {
      if (name === 'Diana') return [{ lane: 'mid', pickRate: 50 }, { lane: 'jungle', pickRate: 40 }]
      if (name === 'Syndra') return [{ lane: 'mid', pickRate: 95 }]
      if (name === 'LeeSin') return [{ lane: 'jungle', pickRate: 90 }]
      return []
    })
    const result = filterEnemiesByLane(
      [
        { championId: 131, championName: 'Diana', assignedPosition: 'jungle' },
        { championId: 134, championName: 'Syndra', assignedPosition: 'middle' },
        { championId: 64, championName: 'LeeSin', assignedPosition: 'jungle' }
      ],
      'mid'
    )
    expect(result.length).toBe(1)
    expect(result[0].championName).toBe('Syndra')
  })

  it('falls back to all picked enemies when no lane data matches', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = filterEnemiesByLane(
      [
        { championId: 122, championName: 'Darius', assignedPosition: 'jungle' },
        { championId: 86, championName: 'Garen', assignedPosition: 'middle' }
      ],
      'top'
    )
    expect(result.length).toBe(2)
  })

  it('skips enemies with championId <= 0', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = filterEnemiesByLane(
      [
        { championId: 0, championName: '', assignedPosition: 'top' },
        { championId: 122, championName: 'Darius', assignedPosition: 'top' }
      ],
      'top'
    )
    expect(result.length).toBe(1)
    expect(result[0].championName).toBe('Darius')
  })

  it('sorts assigned-position enemies before flex picks', () => {
    mockGetChampionRoles.mockImplementation((name: string) => {
      if (name === 'Garen') return [{ lane: 'top', pickRate: 30 }]
      return []
    })
    const result = filterEnemiesByLane(
      [
        { championId: 86, championName: 'Garen', assignedPosition: 'middle' },
        { championId: 122, championName: 'Darius', assignedPosition: 'top' }
      ],
      'top'
    )
    expect(result[0].championName).toBe('Darius')
  })
})

describe('computeRecommendations', () => {
  function setupMockDb(rows: Record<string, unknown>[]) {
    const mockPrepare = vi.fn().mockReturnValue({
      all: vi.fn().mockReturnValue(rows)
    })
    mockGetDb.mockReturnValue({ prepare: mockPrepare } as never)
  }

  it('returns empty array when pool is empty', () => {
    mockGetChampionPool.mockReturnValue([])
    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result).toEqual([])
  })

  it('returns empty array when all pool champions are filtered out by FLEX_THRESHOLD', () => {
    mockGetChampionPool.mockReturnValue([{ champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }])
    mockGetChampionRoles.mockReturnValue([{ lane: 'top', pickRate: 2 }])
    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result).toEqual([])
  })

  it('includes champions with no role data (passes filter)', () => {
    mockGetChampionPool.mockReturnValue([{ champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([])
    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result.length).toBe(1)
    expect(result[0].championName).toBe('Aatrox')
    expect(result[0].personalGames).toBe(0)
    expect(result[0].personalWinRate).toBeNull()
    expect(result[0].personalKda).toBeNull()
  })

  it('defaults to 50 WR when no matchup data exists', () => {
    mockGetChampionPool.mockReturnValue([{ champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([])
    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result[0].score).toBe(50)
    expect(result[0].matchups[0].winRate).toBe(50)
    expect(result[0].matchups[0].gamesPlayed).toBe(0)
    expect(result[0].matchups[0].source).toBe('none')
  })

  it('computes weighted average from opgg and ugg sources', () => {
    mockGetChampionPool.mockReturnValue([{ champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([
      { champion: 'Aatrox', opponent: 'Darius', win_rate: 55, games_played: 500, lane_kill_rate: null, gold_adv_15: null, source: 'opgg' },
      { champion: 'Aatrox', opponent: 'Darius', win_rate: 45, games_played: 500, lane_kill_rate: null, gold_adv_15: null, source: 'ugg' }
    ])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])

    // opgg weight: 0.6 * (0.5 + 0.5 * min(500/500, 1)) = 0.6
    // ugg weight:  0.4 * (0.5 + 0.5 * min(500/500, 1)) = 0.4
    // weighted WR = (55 * 0.6 + 45 * 0.4) / (0.6 + 0.4) = (33 + 18) / 1.0 = 51
    expect(result[0].matchups[0].winRate).toBeCloseTo(51, 1)
  })

  it('applies sample size scaling to weights', () => {
    mockGetChampionPool.mockReturnValue([{ champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([
      { champion: 'Aatrox', opponent: 'Darius', win_rate: 60, games_played: 100, lane_kill_rate: null, gold_adv_15: null, source: 'opgg' }
    ])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])

    // sampleWeight = min(100/500, 1) = 0.2
    // w = 0.6 * (0.5 + 0.5 * 0.2) = 0.6 * 0.6 = 0.36
    // finalWr = (60 * 0.36) / 0.36 = 60
    expect(result[0].matchups[0].winRate).toBeCloseTo(60, 1)
  })

  it('sorts results descending by score', () => {
    mockGetChampionPool.mockReturnValue([
      { champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 },
      { champion: 'Fiora', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }
    ])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([
      { champion: 'Aatrox', opponent: 'Darius', win_rate: 45, games_played: 500, lane_kill_rate: null, gold_adv_15: null, source: 'opgg' },
      { champion: 'Fiora', opponent: 'Darius', win_rate: 60, games_played: 500, lane_kill_rate: null, gold_adv_15: null, source: 'opgg' }
    ])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result[0].championName).toBe('Fiora')
    expect(result[1].championName).toBe('Aatrox')
    expect(result[0].score).toBeGreaterThan(result[1].score)
  })

  it('caps results at 10', () => {
    const poolEntries = Array.from({ length: 15 }, (_, i) => ({
      champion: `Champ${i}`,
      lanes: 'top',
      masteryPoints: 0,
      gamesPlayed: 0
    }))
    mockGetChampionPool.mockReturnValue(poolEntries)
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result.length).toBe(10)
  })

  it('constructs correct champion icon URL', () => {
    mockGetChampionPool.mockReturnValue([{ champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result[0].championIcon).toBe('https://ddragon.leagueoflegends.com/cdn/16.6.1/img/champion/Aatrox.png')
  })

  it('deduplicates pool entries by champion name', () => {
    mockGetChampionPool.mockReturnValue([
      { champion: 'Aatrox', lanes: 'top', masteryPoints: 100, gamesPlayed: 50 },
      { champion: 'Aatrox', lanes: 'mid', masteryPoints: 100, gamesPlayed: 50 }
    ])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result.length).toBe(1)
  })

  it('includes laneKillRate and goldAdv15 from matchup rows', () => {
    mockGetChampionPool.mockReturnValue([{ champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([
      { champion: 'Aatrox', opponent: 'Darius', win_rate: 55, games_played: 500, lane_kill_rate: 52.3, gold_adv_15: 150, source: 'ugg' }
    ])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result[0].matchups[0].laneKillRate).toBe(52.3)
    expect(result[0].matchups[0].goldAdv15).toBe(150)
  })

  it('comfort bonus breaks ties when matchup scores are equal', () => {
    mockGetChampionPool.mockReturnValue([
      { champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 100, winRate: 60, kda: 3.0 },
      { champion: 'Fiora', lanes: 'top', masteryPoints: 0, gamesPlayed: 5, winRate: 48, kda: 1.5 }
    ])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([
      { champion: 'Aatrox', opponent: 'Darius', win_rate: 50, games_played: 500, lane_kill_rate: null, gold_adv_15: null, source: 'opgg' },
      { champion: 'Fiora', opponent: 'Darius', win_rate: 50, games_played: 500, lane_kill_rate: null, gold_adv_15: null, source: 'opgg' }
    ])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result[0].championName).toBe('Aatrox')
    expect(result[0].score).toBeGreaterThan(result[1].score)
    expect(result[0].personalWinRate).toBe(60)
    expect(result[0].personalGames).toBe(100)
    expect(result[0].personalKda).toBe(3.0)
  })

  it('comfort bonus does not override a large matchup advantage', () => {
    mockGetChampionPool.mockReturnValue([
      { champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 100, winRate: 65, kda: 4.0 },
      { champion: 'Fiora', lanes: 'top', masteryPoints: 0, gamesPlayed: 0, winRate: null, kda: null }
    ])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([
      { champion: 'Aatrox', opponent: 'Darius', win_rate: 45, games_played: 500, lane_kill_rate: null, gold_adv_15: null, source: 'opgg' },
      { champion: 'Fiora', opponent: 'Darius', win_rate: 55, games_played: 500, lane_kill_rate: null, gold_adv_15: null, source: 'opgg' }
    ])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result[0].championName).toBe('Fiora')
    expect(result[0].score).toBeGreaterThan(result[1].score)
  })

  it('comfort bonus is zero when games played is below 5', () => {
    mockGetChampionPool.mockReturnValue([
      { champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 3, winRate: 70, kda: 5.0 }
    ])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result[0].score).toBe(50)
  })

  it('excludes champions already picked by either team', () => {
    mockGetChampionPool.mockReturnValue([
      { champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 },
      { champion: 'Fiora', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 },
      { champion: 'Darius', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }
    ])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([])

    const picked = new Set(['Darius', 'Fiora'])
    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }], picked)
    expect(result.length).toBe(1)
    expect(result[0].championName).toBe('Aatrox')
  })

  it('works normally when pickedChampionNames is not provided', () => {
    mockGetChampionPool.mockReturnValue([
      { champion: 'Aatrox', lanes: 'top', masteryPoints: 0, gamesPlayed: 0 }
    ])
    mockGetChampionRoles.mockReturnValue([])
    setupMockDb([])

    const result = computeRecommendations('top', [{ championId: 122, championName: 'Darius' }])
    expect(result.length).toBe(1)
  })
})
