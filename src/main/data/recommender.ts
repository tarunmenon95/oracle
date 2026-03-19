import { getDb, getChampionPool, getChampionRoles } from './db'
import { getCurrentPatch, getChampionInternalId, getChampionIdByName } from './ddragon'
import { normalizeLane, FLEX_THRESHOLD } from '../scraper/shared'

interface EnemyPick {
  championId: number
  championName: string
}

interface Recommendation {
  championId: number
  championName: string
  championIcon: string
  score: number
  matchups: MatchupDetail[]
}

interface MatchupDetail {
  enemyChampionId: number
  enemyChampionName: string
  winRate: number
  laneKillRate?: number | null
  goldAdv15?: number | null
  gamesPlayed: number
  source: string
}

const DDRAGON_BASE = 'https://ddragon.leagueoflegends.com/cdn'

type MatchupRow = {
  champion: string
  opponent: string
  win_rate: number
  games_played: number
  lane_kill_rate: number | null
  gold_adv_15: number | null
  source: string
}

export function computeRecommendations(lane: string, enemyPicks: EnemyPick[]): Recommendation[] {
  const normalizedLane = normalizeLane(lane)
  const pool = getChampionPool(normalizedLane)

  if (pool.length === 0) return []

  const db = getDb()
  const patch = getCurrentPatch()

  const allPool = [...new Map(pool.map((p) => [p.champion, p])).values()]

  const uniquePool = allPool.filter((p) => {
    const roles = getChampionRoles(p.champion)
    if (roles.length === 0) return true
    return roles.some((r) => r.lane === normalizedLane && r.pickRate >= FLEX_THRESHOLD)
  })

  if (uniquePool.length === 0) return []

  const poolNames = uniquePool.map((p) => p.champion)
  const enemyNames = enemyPicks.map((e) => e.championName)

  const champPlaceholders = poolNames.map(() => '?').join(',')
  const enemyPlaceholders = enemyNames.map(() => '?').join(',')

  const allRows = db.prepare(`
    SELECT champion, opponent, win_rate, games_played, lane_kill_rate, gold_adv_15, source
    FROM matchups
    WHERE champion IN (${champPlaceholders})
      AND opponent IN (${enemyPlaceholders})
      AND lane = ?
    ORDER BY champion, opponent, source
  `).all(...poolNames, ...enemyNames, normalizedLane) as MatchupRow[]

  const matchupMap = new Map<string, MatchupRow[]>()
  for (const row of allRows) {
    const key = `${row.champion}|${row.opponent}`
    const arr = matchupMap.get(key)
    if (arr) arr.push(row)
    else matchupMap.set(key, [row])
  }

  const recommendations: Recommendation[] = []

  for (const poolEntry of uniquePool) {
    const matchups: MatchupDetail[] = []
    let totalScore = 0
    let totalWeight = 0

    for (const enemy of enemyPicks) {
      const key = `${poolEntry.champion}|${enemy.championName}`
      const rows = matchupMap.get(key) || []

      if (rows.length > 0) {
        let weightedWr = 0
        let weightSum = 0

        for (const row of rows) {
          const sourceWeight = row.source === 'opgg' ? 0.6 : row.source === 'ugg' ? 0.4 : 0.2
          const sampleWeight = Math.min(row.games_played / 500, 1)
          const w = sourceWeight * (0.5 + 0.5 * sampleWeight)
          weightedWr += row.win_rate * w
          weightSum += w
        }

        const finalWr = weightSum > 0 ? weightedWr / weightSum : 50
        const totalGames = rows.reduce((s, r) => s + r.games_played, 0)
        const laneKillRate = rows.find((r) => r.lane_kill_rate != null)?.lane_kill_rate ?? null
        const goldAdv15 = rows.find((r) => r.gold_adv_15 != null)?.gold_adv_15 ?? null

        matchups.push({
          enemyChampionId: enemy.championId,
          enemyChampionName: enemy.championName,
          winRate: finalWr,
          laneKillRate,
          goldAdv15,
          gamesPlayed: totalGames,
          source: rows.map((r) => r.source).join(', ')
        })

        totalScore += finalWr
        totalWeight += 1
      } else {
        matchups.push({
          enemyChampionId: enemy.championId,
          enemyChampionName: enemy.championName,
          winRate: 50,
          laneKillRate: null,
          goldAdv15: null,
          gamesPlayed: 0,
          source: 'none'
        })
        totalScore += 50
        totalWeight += 1
      }
    }

    const avgScore = totalWeight > 0 ? totalScore / totalWeight : 50
    const internalId = getChampionInternalId(poolEntry.champion)

    recommendations.push({
      championId: getChampionIdByName(poolEntry.champion),
      championName: poolEntry.champion,
      championIcon: `${DDRAGON_BASE}/${patch}/img/champion/${internalId}.png`,
      score: avgScore,
      matchups
    })
  }

  recommendations.sort((a, b) => b.score - a.score)
  return recommendations.slice(0, 10)
}

export { normalizeLane } from '../scraper/shared'

/**
 * Checks whether a champion can plausibly play a given lane based on
 * scraped role distribution data from op.gg. A champion qualifies if
 * they have a pick rate >= FLEX_THRESHOLD% in that lane.
 */
function canPlayLane(championName: string, lane: string): boolean {
  const roles = getChampionRoles(championName)
  if (roles.length === 0) return false
  return roles.some((r) => r.lane === lane && r.pickRate >= FLEX_THRESHOLD)
}

function getLanePickRate(championName: string, lane: string): number {
  const roles = getChampionRoles(championName)
  const match = roles.find((r) => r.lane === lane)
  return match?.pickRate ?? 0
}

/**
 * Filters enemy team members to those who could plausibly be in the
 * player's lane. An enemy qualifies if:
 *   1. They are assigned to the same lane, OR
 *   2. They have a meaningful pick rate (>= 5%) in that lane according
 *      to scraped op.gg role distribution data.
 *
 * If no enemies match (e.g. no role data scraped yet), returns all
 * picked enemies as a fallback.
 */
const ALL_LANES = ['top', 'jungle', 'mid', 'bottom', 'support'] as const

/**
 * Infers the most likely position for each picked champion on a team
 * using scraped role distribution data. Uses a greedy assignment:
 * each champion-lane pair is scored by pick rate, then assigned
 * highest-first so flex picks settle into their best available slot.
 *
 * Returns a map of championName -> normalized lane. Champions without
 * role data keep their original assignedPosition (if any) or are
 * left unassigned.
 */
export function inferTeamPositions(
  members: { championId: number; championName: string; assignedPosition?: string }[]
): Map<string, string> {
  const picked = members.filter((m) => m.championId > 0 && m.championName)
  const result = new Map<string, string>()

  if (picked.length === 0) return result

  type Candidate = { champion: string; lane: string; pickRate: number }
  const candidates: Candidate[] = []

  for (const m of picked) {
    const roles = getChampionRoles(m.championName)
    if (roles.length > 0) {
      for (const r of roles) {
        if (r.pickRate >= 1) {
          candidates.push({ champion: m.championName, lane: r.lane, pickRate: r.pickRate })
        }
      }
    } else {
      const fallbackLane = m.assignedPosition ? normalizeLane(m.assignedPosition) : ''
      if (fallbackLane) {
        candidates.push({ champion: m.championName, lane: fallbackLane, pickRate: 100 })
      }
    }
  }

  candidates.sort((a, b) => b.pickRate - a.pickRate)

  const assignedLanes = new Set<string>()
  const assignedChamps = new Set<string>()

  for (const c of candidates) {
    if (assignedChamps.has(c.champion)) continue
    if (assignedLanes.has(c.lane)) continue
    result.set(c.champion, c.lane)
    assignedChamps.add(c.champion)
    assignedLanes.add(c.lane)
  }

  for (const m of picked) {
    if (!assignedChamps.has(m.championName)) {
      const fallback = m.assignedPosition ? normalizeLane(m.assignedPosition) : ''
      if (fallback && !assignedLanes.has(fallback)) {
        result.set(m.championName, fallback)
        assignedLanes.add(fallback)
      } else {
        const open = ALL_LANES.find((l) => !assignedLanes.has(l))
        if (open) {
          result.set(m.championName, open)
          assignedLanes.add(open)
        }
      }
    }
  }

  return result
}

/**
 * Converts a normalized lane name back to LCU-style position string
 * (e.g. 'mid' -> 'middle', 'support' -> 'utility').
 */
export function laneToLcuPosition(lane: string): string {
  const mapping: Record<string, string> = {
    top: 'top',
    jungle: 'jungle',
    mid: 'middle',
    bottom: 'bottom',
    support: 'utility'
  }
  return mapping[lane] || lane
}

export function filterEnemiesByLane(
  enemies: { championId: number; championName: string; assignedPosition?: string }[],
  myLane: string
): { championId: number; championName: string }[] {
  const normalizedMyLane = normalizeLane(myLane)
  const picked = enemies.filter((e) => e.championId > 0)

  const relevant = picked.filter((e) => {
    if (e.assignedPosition && normalizeLane(e.assignedPosition) === normalizedMyLane) return true
    return canPlayLane(e.championName, normalizedMyLane)
  })

  const toReturn = relevant.length > 0 ? relevant : picked

  toReturn.sort((a, b) => {
    const aAssigned = a.assignedPosition && normalizeLane(a.assignedPosition) === normalizedMyLane
    const bAssigned = b.assignedPosition && normalizeLane(b.assignedPosition) === normalizedMyLane
    if (aAssigned && !bAssigned) return -1
    if (!aAssigned && bAssigned) return 1
    const aRate = getLanePickRate(a.championName, normalizedMyLane)
    const bRate = getLanePickRate(b.championName, normalizedMyLane)
    return bRate - aRate
  })

  return toReturn.map((e) => ({ championId: e.championId, championName: e.championName }))
}
