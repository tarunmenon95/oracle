import type { LeagueWebSocket, Credentials, EventResponse } from 'league-connect'
import { request } from 'league-connect'
import type { LcuChampSelectSession, ParsedDraftState, ParsedTeamMember } from './types'
import { getChampionNameById } from '../data/ddragon'
import { getMainWindow } from '../index'
import { computeRecommendations, filterEnemiesByLane, inferTeamPositions, laneToLcuPosition } from '../data/recommender'
import { prefetchBuilds } from '../scraper/opgg-build'

let isListening = false

export function startChampSelectListener(ws: LeagueWebSocket, credentials: Credentials): void {
  if (isListening) return
  isListening = true

  ws.subscribe('/lol-champ-select/v1/session', async (data: LcuChampSelectSession | null, event: EventResponse) => {
    const win = getMainWindow()
    if (!win || win.isDestroyed()) return

    if (!data) {
      win.webContents.send('connection:status', 'connected')
      return
    }

    win.webContents.send('connection:status', 'in-champ-select')

    const draftState = parseDraftState(data)
    applyInferredPositions(draftState)
    win.webContents.send('draft:update', draftState)

    const enemyPicks = filterEnemiesByLane(draftState.theirTeam, draftState.assignedPosition)

    if (enemyPicks.length > 0 && draftState.assignedPosition) {
      const pickedNames = new Set<string>()
      for (const m of [...draftState.myTeam, ...draftState.theirTeam]) {
        if (m.championId > 0 && m.championName) pickedNames.add(m.championName)
      }
      const recs = computeRecommendations(draftState.assignedPosition, enemyPicks, pickedNames)
      win.webContents.send('recommendations:update', recs)

      const lane = draftState.assignedPosition
      const topRecs = recs.slice(0, 3)
      const matchups = topRecs.flatMap((r) =>
        r.matchups.map((m) => ({ champion: r.championName, opponent: m.enemyChampionName, lane }))
      )
      if (matchups.length > 0) prefetchBuilds(matchups)
    }
  })

  pollForSession(credentials)
}

export function stopChampSelectListener(ws: LeagueWebSocket): void {
  ws.unsubscribe('/lol-champ-select/v1/session')
  isListening = false
}

async function pollForSession(credentials: Credentials): Promise<void> {
  try {
    const response = await request({
      method: 'GET',
      url: '/lol-champ-select/v1/session'
    }, credentials)

    if (response.ok) {
      const session = await response.json() as LcuChampSelectSession
      const win = getMainWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('connection:status', 'in-champ-select')
        const draftState = parseDraftState(session)
        applyInferredPositions(draftState)
        win.webContents.send('draft:update', draftState)
      }
    }
  } catch {
    // Not in champ select
  }
}

export function parseDraftState(session: LcuChampSelectSession): ParsedDraftState {
  const parseTeam = (members: LcuChampSelectSession['myTeam']): ParsedTeamMember[] =>
    members.map((m) => ({
      cellId: m.cellId,
      championId: m.championId || m.championPickIntent || 0,
      championName: getChampionNameById(m.championId || m.championPickIntent || 0),
      summonerId: m.summonerId,
      assignedPosition: m.assignedPosition || ''
    }))

  const localPlayer = session.myTeam.find((m) => m.cellId === session.localPlayerCellId)

  let theirTeam = parseTeam(session.theirTeam)
  if (theirTeam.every((m) => m.championId === 0)) {
    const myTeamCellIds = new Set(session.myTeam.map((m) => m.cellId))
    const enemyPicks: ParsedTeamMember[] = []

    for (const actionGroup of session.actions) {
      for (const action of actionGroup) {
        if (action.type === 'pick' && action.completed && !myTeamCellIds.has(action.actorCellId) && action.championId > 0) {
          enemyPicks.push({
            cellId: action.actorCellId,
            championId: action.championId,
            championName: getChampionNameById(action.championId),
            summonerId: 0,
            assignedPosition: ''
          })
        }
      }
    }

    if (enemyPicks.length > 0) {
      theirTeam = enemyPicks
    }
  }

  return {
    phase: session.timer?.phase || 'UNKNOWN',
    myTeam: parseTeam(session.myTeam),
    theirTeam,
    myBans: session.bans?.myTeamBans || [],
    theirBans: session.bans?.theirTeamBans || [],
    localPlayerCellId: session.localPlayerCellId,
    assignedPosition: localPlayer?.assignedPosition || ''
  }
}

export function applyInferredPositions(state: ParsedDraftState): void {
  const inferFor = (members: ParsedTeamMember[]): void => {
    const posMap = inferTeamPositions(members)
    for (const m of members) {
      const inferred = posMap.get(m.championName)
      if (inferred) {
        m.assignedPosition = laneToLcuPosition(inferred)
      }
    }
  }

  inferFor(state.theirTeam)
}
