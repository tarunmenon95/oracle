import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { LcuChampSelectSession } from '../types'

vi.mock('../../data/ddragon', () => ({
  getChampionNameById: vi.fn((id: number) => {
    const names: Record<number, string> = { 266: 'Aatrox', 122: 'Darius', 86: 'Garen', 114: 'Fiora', 164: 'Camille' }
    if (id === 0) return ''
    return names[id] ?? `Champion(${id})`
  })
}))

vi.mock('../../index', () => ({
  getMainWindow: vi.fn()
}))

vi.mock('../../data/recommender', () => ({
  inferTeamPositions: vi.fn(),
  laneToLcuPosition: vi.fn(),
  computeRecommendations: vi.fn(),
  filterEnemiesByLane: vi.fn()
}))

vi.mock('league-connect', () => ({
  request: vi.fn()
}))

import { parseDraftState, applyInferredPositions } from '../websocket'
import { inferTeamPositions, laneToLcuPosition } from '../../data/recommender'

const mockInferTeamPositions = vi.mocked(inferTeamPositions)
const mockLaneToLcuPosition = vi.mocked(laneToLcuPosition)

beforeEach(() => {
  vi.clearAllMocks()
})

function makeSession(overrides: Partial<LcuChampSelectSession> = {}): LcuChampSelectSession {
  return {
    myTeam: [
      { cellId: 0, championId: 266, championPickIntent: 0, summonerId: 1001, spell1Id: 4, spell2Id: 14, assignedPosition: 'top', team: 1 },
      { cellId: 1, championId: 0, championPickIntent: 0, summonerId: 1002, spell1Id: 4, spell2Id: 14, assignedPosition: 'jungle', team: 1 }
    ],
    theirTeam: [
      { cellId: 5, championId: 122, championPickIntent: 0, summonerId: 2001, spell1Id: 4, spell2Id: 14, assignedPosition: 'top', team: 2 },
      { cellId: 6, championId: 86, championPickIntent: 0, summonerId: 2002, spell1Id: 4, spell2Id: 14, assignedPosition: 'jungle', team: 2 }
    ],
    bans: { myTeamBans: [10, 20], theirTeamBans: [30, 40], numBans: 10 },
    actions: [[]],
    localPlayerCellId: 0,
    timer: { phase: 'BAN_PICK', timeLeftInPhase: 30, adjustedTimeLeftInPhaseInSec: 30, isInfinite: false },
    ...overrides
  }
}

describe('parseDraftState', () => {
  it('parses myTeam and theirTeam members correctly', () => {
    const session = makeSession()
    const state = parseDraftState(session)

    expect(state.myTeam).toHaveLength(2)
    expect(state.myTeam[0].championId).toBe(266)
    expect(state.myTeam[0].championName).toBe('Aatrox')
    expect(state.myTeam[0].assignedPosition).toBe('top')
    expect(state.myTeam[0].summonerId).toBe(1001)

    expect(state.theirTeam).toHaveLength(2)
    expect(state.theirTeam[0].championId).toBe(122)
    expect(state.theirTeam[0].championName).toBe('Darius')
  })

  it('uses championPickIntent as fallback when championId is 0', () => {
    const session = makeSession({
      myTeam: [
        { cellId: 0, championId: 0, championPickIntent: 114, summonerId: 1001, spell1Id: 4, spell2Id: 14, assignedPosition: 'top', team: 1 }
      ]
    })
    const state = parseDraftState(session)
    expect(state.myTeam[0].championId).toBe(114)
    expect(state.myTeam[0].championName).toBe('Fiora')
  })

  it('extracts bans from session', () => {
    const session = makeSession()
    const state = parseDraftState(session)
    expect(state.myBans).toEqual([10, 20])
    expect(state.theirBans).toEqual([30, 40])
  })

  it('sets assignedPosition from local player', () => {
    const session = makeSession()
    const state = parseDraftState(session)
    expect(state.assignedPosition).toBe('top')
    expect(state.localPlayerCellId).toBe(0)
  })

  it('sets phase from timer', () => {
    const session = makeSession()
    const state = parseDraftState(session)
    expect(state.phase).toBe('BAN_PICK')
  })

  it('defaults phase to UNKNOWN when timer is missing', () => {
    const session = makeSession({ timer: undefined as any })
    const state = parseDraftState(session)
    expect(state.phase).toBe('UNKNOWN')
  })

  it('handles missing bans gracefully', () => {
    const session = makeSession({ bans: undefined as any })
    const state = parseDraftState(session)
    expect(state.myBans).toEqual([])
    expect(state.theirBans).toEqual([])
  })

  it('extracts enemy picks from actions when theirTeam is all zeros', () => {
    const session = makeSession({
      theirTeam: [
        { cellId: 5, championId: 0, championPickIntent: 0, summonerId: 2001, spell1Id: 4, spell2Id: 14, assignedPosition: '', team: 2 },
        { cellId: 6, championId: 0, championPickIntent: 0, summonerId: 2002, spell1Id: 4, spell2Id: 14, assignedPosition: '', team: 2 }
      ],
      actions: [
        [
          { actorCellId: 5, championId: 122, completed: true, id: 1, pickTurn: 1, type: 'pick', isInProgress: false },
          { actorCellId: 6, championId: 86, completed: true, id: 2, pickTurn: 2, type: 'pick', isInProgress: false }
        ]
      ]
    })
    const state = parseDraftState(session)
    expect(state.theirTeam).toHaveLength(2)
    expect(state.theirTeam[0].championId).toBe(122)
    expect(state.theirTeam[0].championName).toBe('Darius')
    expect(state.theirTeam[1].championId).toBe(86)
    expect(state.theirTeam[1].championName).toBe('Garen')
  })

  it('ignores incomplete enemy picks from actions', () => {
    const session = makeSession({
      theirTeam: [
        { cellId: 5, championId: 0, championPickIntent: 0, summonerId: 2001, spell1Id: 4, spell2Id: 14, assignedPosition: '', team: 2 }
      ],
      actions: [
        [
          { actorCellId: 5, championId: 122, completed: false, id: 1, pickTurn: 1, type: 'pick', isInProgress: true }
        ]
      ]
    })
    const state = parseDraftState(session)
    expect(state.theirTeam.every((m) => m.championId === 0)).toBe(true)
  })

  it('ignores ban actions when extracting enemy picks', () => {
    const session = makeSession({
      theirTeam: [
        { cellId: 5, championId: 0, championPickIntent: 0, summonerId: 2001, spell1Id: 4, spell2Id: 14, assignedPosition: '', team: 2 }
      ],
      actions: [
        [
          { actorCellId: 5, championId: 122, completed: true, id: 1, pickTurn: 1, type: 'ban', isInProgress: false }
        ]
      ]
    })
    const state = parseDraftState(session)
    expect(state.theirTeam.every((m) => m.championId === 0)).toBe(true)
  })

  it('does not include own team picks in enemy extraction', () => {
    const session = makeSession({
      myTeam: [
        { cellId: 0, championId: 266, championPickIntent: 0, summonerId: 1001, spell1Id: 4, spell2Id: 14, assignedPosition: 'top', team: 1 }
      ],
      theirTeam: [
        { cellId: 5, championId: 0, championPickIntent: 0, summonerId: 2001, spell1Id: 4, spell2Id: 14, assignedPosition: '', team: 2 }
      ],
      actions: [
        [
          { actorCellId: 0, championId: 266, completed: true, id: 1, pickTurn: 1, type: 'pick', isInProgress: false },
          { actorCellId: 5, championId: 122, completed: true, id: 2, pickTurn: 2, type: 'pick', isInProgress: false }
        ]
      ]
    })
    const state = parseDraftState(session)
    expect(state.theirTeam).toHaveLength(1)
    expect(state.theirTeam[0].championId).toBe(122)
  })
})

describe('applyInferredPositions', () => {
  it('updates enemy team members with inferred positions', () => {
    const posMap = new Map([['Darius', 'top'], ['Garen', 'mid']])
    mockInferTeamPositions.mockReturnValue(posMap)
    mockLaneToLcuPosition.mockImplementation((lane: string) => {
      const map: Record<string, string> = { top: 'top', mid: 'middle' }
      return map[lane] || lane
    })

    const state = {
      phase: 'BAN_PICK',
      myTeam: [],
      theirTeam: [
        { cellId: 5, championId: 122, championName: 'Darius', summonerId: 2001, assignedPosition: '' },
        { cellId: 6, championId: 86, championName: 'Garen', summonerId: 2002, assignedPosition: '' }
      ],
      myBans: [],
      theirBans: [],
      localPlayerCellId: 0,
      assignedPosition: 'top'
    }

    applyInferredPositions(state)
    expect(state.theirTeam[0].assignedPosition).toBe('top')
    expect(state.theirTeam[1].assignedPosition).toBe('middle')
  })

  it('leaves positions unchanged when inference returns no data', () => {
    mockInferTeamPositions.mockReturnValue(new Map())

    const state = {
      phase: 'BAN_PICK',
      myTeam: [],
      theirTeam: [
        { cellId: 5, championId: 122, championName: 'Darius', summonerId: 2001, assignedPosition: 'jungle' }
      ],
      myBans: [],
      theirBans: [],
      localPlayerCellId: 0,
      assignedPosition: 'top'
    }

    applyInferredPositions(state)
    expect(state.theirTeam[0].assignedPosition).toBe('jungle')
  })
})
