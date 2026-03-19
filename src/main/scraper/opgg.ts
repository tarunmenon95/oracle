import { upsertMatchup, upsertChampionRole, getChampionRoles, getDb } from '../data/db'
import { getCurrentPatch, getChampionNameById, getChampionInternalId } from '../data/ddragon'
import { patchToOpgg } from '../data/settings'
import { fetchPage, normalizeLane, FLEX_THRESHOLD } from './shared'

export function opggSlug(champion: string): string {
  return getChampionInternalId(champion).toLowerCase()
}

const LANE_MAP: Record<string, string> = {
  top: 'top',
  jungle: 'jungle',
  mid: 'mid',
  bottom: 'adc',
  support: 'support'
}

/**
 * Extracts decoded strings from Next.js RSC `self.__next_f.push([1,"..."])`
 * payloads. The content uses JS string escaping (`\"` for quotes, `\\n` for
 * newlines, etc.), so a simple `[^"]*` regex won't work — we walk the string
 * character-by-character to handle escaped quotes.
 */
export function extractRscPayloads(html: string): string[] {
  const payloads: string[] = []
  const marker = 'self.__next_f.push([1,"'
  let searchFrom = 0

  while (true) {
    const start = html.indexOf(marker, searchFrom)
    if (start === -1) break

    const contentStart = start + marker.length
    let i = contentStart

    while (i < html.length) {
      if (html[i] === '\\' && i + 1 < html.length) {
        i += 2
      } else if (html[i] === '"') {
        break
      } else {
        i++
      }
    }

    const raw = html.substring(contentStart, i)
    const decoded = raw
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .replace(/\\u0026/g, '&')
      .replace(/\\\\/g, '\\')
    payloads.push(decoded)

    searchFrom = i + 1
  }

  return payloads
}

export function findJsonInPayload(payload: string, startMarker: string): any | null {
  const idx = payload.indexOf(startMarker)
  if (idx === -1) return null

  let braceStart = payload.indexOf('{', idx)
  let bracketStart = payload.indexOf('[', idx)

  let start: number
  let openChar: string
  let closeChar: string

  if (braceStart === -1 && bracketStart === -1) return null
  if (braceStart === -1) { start = bracketStart; openChar = '['; closeChar = ']' }
  else if (bracketStart === -1) { start = braceStart; openChar = '{'; closeChar = '}' }
  else if (bracketStart < braceStart) { start = bracketStart; openChar = '['; closeChar = ']' }
  else { start = braceStart; openChar = '{'; closeChar = '}' }

  let depth = 0
  for (let i = start; i < payload.length; i++) {
    if (payload[i] === openChar) depth++
    else if (payload[i] === closeChar) depth--
    if (depth === 0) {
      try {
        return JSON.parse(payload.substring(start, i + 1))
      } catch {
        return null
      }
    }
  }
  return null
}

export async function scrapeChampionMatchups(champion: string, lane: string, patch?: string): Promise<number> {
  const opggLane = LANE_MAP[lane] || lane
  const effectivePatch = patch || getCurrentPatch().split('.').slice(0, 2).join('.')
  const opggPatch = patchToOpgg(effectivePatch)
  const url = `https://op.gg/lol/champions/${opggSlug(champion)}/counters/${opggLane}?region=global&tier=emerald_plus&patch=${opggPatch}`

  const html = await fetchPage(url)
  let matchupCount = 0

  const payloads = extractRscPayloads(html)

  extractChampionRoles(payloads, champion)

  const matchupEntries: { opponentName: string; opponentKey: string; winRate: number; games: number }[] = []

  for (const payload of payloads) {
    if (!payload.includes('"win_rate"') || !payload.includes('"champion"')) continue

    const dataArray = findJsonInPayload(payload, '"data"')
    if (!Array.isArray(dataArray)) continue

    const hasMatchupShape = dataArray.some(
      (item: any) => item && typeof item === 'object' && 'win_rate' in item && 'champion' in item
    )
    if (!hasMatchupShape) continue

    for (const matchup of dataArray) {
      const opponentName = matchup.champion?.name
      const opponentKey = matchup.champion?.key
      const winRate = matchup.win_rate
      const games = matchup.play ?? 0

      if (opponentName && winRate != null) {
        matchupEntries.push({ opponentName, opponentKey: opponentKey || opponentName.toLowerCase(), winRate, games })
        upsertMatchup(champion, opponentName, lane, winRate, games, 'opgg', effectivePatch)
        matchupCount++
      }
    }

    if (matchupCount > 0) break
  }

  if (matchupCount === 0) {
    console.warn(`No counter data found in RSC payloads for ${champion} ${lane}`)
    return 0
  }

  return matchupCount
}

/**
 * Scrapes just the role distribution for a single champion from op.gg.
 * Lighter than a full matchup scrape — only fetches the page and extracts
 * the positions header data.
 */
export async function scrapeChampionRoles(champion: string, patch?: string): Promise<number> {
  const effectivePatch = patch || getCurrentPatch().split('.').slice(0, 2).join('.')
  const opggPatch = patchToOpgg(effectivePatch)
  const url = `https://op.gg/lol/champions/${opggSlug(champion)}/counters/mid?region=global&tier=emerald_plus&patch=${opggPatch}`

  try {
    const html = await fetchPage(url)
    const payloads = extractRscPayloads(html)
    extractChampionRoles(payloads, champion)
    return 1
  } catch (err) {
    console.warn(`Failed to scrape roles for ${champion}:`, err)
    return 0
  }
}

export const OPGG_LANE_NORMALIZE: Record<string, string> = {
  TOP: 'top',
  JUNGLE: 'jungle',
  MID: 'mid',
  MIDDLE: 'mid',
  ADC: 'bottom',
  BOTTOM: 'bottom',
  SUPPORT: 'support'
}

function extractChampionRoles(payloads: string[], champion: string): void {
  for (const payload of payloads) {
    const idx = payload.indexOf('"positions":[{')
    if (idx === -1) continue

    const arrStart = payload.indexOf('[', idx)
    if (arrStart === -1) continue

    let depth = 0
    let arrEnd = arrStart
    for (let i = arrStart; i < payload.length; i++) {
      if (payload[i] === '[') depth++
      else if (payload[i] === ']') depth--
      if (depth === 0) { arrEnd = i; break }
    }

    try {
      const positions = JSON.parse(payload.substring(arrStart, arrEnd + 1)) as { name: string; percentage: string }[]
      for (const pos of positions) {
        const lane = OPGG_LANE_NORMALIZE[pos.name.toUpperCase()]
        if (!lane) continue
        const rate = parseFloat(pos.percentage.replace('%', ''))
        if (!isNaN(rate) && rate > 0) {
          upsertChampionRole(champion, lane, rate)
        }
      }
      return
    } catch {
      continue
    }
  }
}

export async function syncChampionPool(summonerName: string, tagline: string, region: string): Promise<void> {
  const riotId = `${encodeURIComponent(summonerName)}-${encodeURIComponent(tagline)}`
  const url = `https://op.gg/lol/summoners/${region}/${riotId}/champions`

  const html = await fetchPage(url)
  const payloads = extractRscPayloads(html)

  let championStats: any[] | null = null

  for (const payload of payloads) {
    if (!payload.includes('my_champion_stats')) continue

    const data = findJsonInPayload(payload, '"my_champion_stats"')
    if (Array.isArray(data) && data.length > 0 && data.some((s: any) => s.id != null && s.play != null)) {
      championStats = data
      break
    }
  }

  if (!championStats) {
    console.warn('No my_champion_stats found in RSC payloads for summoner page')
    return
  }

  const db = getDb()
  const insertStmt = db.prepare(
    'INSERT OR REPLACE INTO champion_pool (summoner_id, champion, lanes, mastery_points, games_played) VALUES (?, ?, ?, 0, ?)'
  )

  const entries: { champion: string; lanes: string; games: number }[] = []

  for (const stat of championStats) {
    if (stat.id === 0 || !stat.id) continue

    const championName = stat.name || getChampionNameById(stat.id)
    if (!championName || championName.startsWith('Champion(')) continue

    const games = stat.play ?? 0
    if (games < 3) continue

    const lanes = inferLanesFromStats(stat, championName)
    entries.push({ champion: championName, lanes: lanes.join(','), games })
  }

  if (entries.length > 0) {
    const insertMany = db.transaction((rows: typeof entries) => {
      for (const entry of rows) {
        insertStmt.run('local', entry.champion, entry.lanes, entry.games)
      }
    })
    insertMany(entries)
    console.log(`Synced ${entries.length} champion pool entries from op.gg`)
  } else {
    console.warn('No champion pool entries found with >= 3 games')
  }
}

/**
 * Returns all viable lanes for a champion. Uses the summoner stat's
 * explicit position if available, then enriches with flex roles from
 * the champion_roles table (any role with pickRate >= threshold).
 * Falls back to ['mid'] as a last resort.
 */
export function inferLanesFromStats(stat: any, championName: string): string[] {
  const roles = getChampionRoles(championName)
  const viableLanes = roles
    .filter((r) => r.pickRate >= FLEX_THRESHOLD)
    .map((r) => r.lane)

  if (viableLanes.length > 0) return viableLanes

  if (stat.position) return [normalizeLane(stat.position)]
  if (stat.lane) return [normalizeLane(stat.lane)]
  if (stat.role) return [normalizeLane(stat.role)]

  return ['mid']
}

