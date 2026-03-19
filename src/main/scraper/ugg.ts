import { upsertMatchup } from '../data/db'
import { getChampionNameById, getChampionIdByName, getCurrentPatch } from '../data/ddragon'
import { patchToUgg } from '../data/settings'
import { fetchPage } from './shared'

export function uggSlug(champion: string): string {
  return champion.toLowerCase().replace(/['.]/g, '').replace(/\s+/g, '-')
}

const LANE_MAP: Record<string, string> = {
  top: 'top',
  jungle: 'jungle',
  mid: 'mid',
  bottom: 'adc',
  support: 'support'
}

/**
 * u.gg embeds matchup data in `window.__SSR_DATA__` as JSON.
 * One page load contains ALL roles for a champion, keyed like `world_emerald_mid`.
 * Each counter entry has: champion_id, win_rate, matches, gold_adv_15, etc.
 */
export async function scrapeChampionMatchups(champion: string, lane: string, patch?: string): Promise<number> {
  const championId = getChampionIdByName(champion)
  if (!championId) {
    console.warn(`u.gg: unknown champion ID for ${champion}`)
    return 0
  }

  const effectivePatch = patch || getCurrentPatch().split('.').slice(0, 2).join('.')
  const uggPatch = patchToUgg(effectivePatch)
  const url = `https://u.gg/lol/champions/${uggSlug(champion)}/matchups?patch=${uggPatch}`

  const html = await fetchPage(url)
  const ssrData = extractSsrData(html)
  if (!ssrData) {
    console.warn(`u.gg: no __SSR_DATA__ found for ${champion}`)
    return 0
  }

  const matchupsKey = Object.keys(ssrData).find((k) => k.includes('/matchups/') && k.includes(`/${championId}/`))
  if (!matchupsKey) {
    console.warn(`u.gg: no matchups key found for ${champion} (id ${championId})`)
    return 0
  }

  const matchupsData = ssrData[matchupsKey]?.data
  if (!matchupsData || typeof matchupsData !== 'object') {
    console.warn(`u.gg: no matchup data object for ${champion}`)
    return 0
  }

  const uggLane = LANE_MAP[lane] || lane
  const regionKey = findRegionKey(matchupsData, uggLane)
  if (!regionKey) {
    console.warn(`u.gg: no region key found for ${champion} ${lane}`)
    return 0
  }

  const regionData = matchupsData[regionKey]
  if (!regionData?.counters || !Array.isArray(regionData.counters)) {
    console.warn(`u.gg: no counters array for ${champion} ${lane}`)
    return 0
  }

  let count = 0
  for (const entry of regionData.counters) {
    const oppId = entry.champion_id
    const oppName = getChampionNameById(oppId)
    if (!oppName || oppName.startsWith('Champion(')) continue

    const winRate = entry.win_rate ?? 50
    const matches = entry.matches ?? 0
    const goldAdv15 = entry.gold_adv_15 ?? null

    if (matches > 0) {
      upsertMatchup(champion, oppName, lane, winRate, matches, 'ugg', effectivePatch, null, goldAdv15)
      count++
    }
  }

  if (count > 0) {
    console.log(`u.gg: scraped ${count} matchups for ${champion} ${lane} (patch ${effectivePatch})`)
  }

  return count
}

export function extractSsrData(html: string): Record<string, any> | null {
  const marker = '__SSR_DATA__ = '
  const start = html.indexOf(marker)
  if (start === -1) return null

  const jsonStart = start + marker.length
  const apolloMarker = 'window.__APOLLO_STATE__'
  let jsonEnd = html.indexOf(apolloMarker, jsonStart)
  if (jsonEnd === -1) {
    jsonEnd = html.indexOf('</script>', jsonStart)
  }
  if (jsonEnd === -1) return null

  let jsonStr = html.substring(jsonStart, jsonEnd).trim()
  while (jsonStr.endsWith(';') || jsonStr.endsWith('\n')) {
    jsonStr = jsonStr.slice(0, -1)
  }
  jsonStr = jsonStr.trim()

  try {
    return JSON.parse(jsonStr)
  } catch {
    console.warn('u.gg: failed to parse __SSR_DATA__')
    return null
  }
}

export function findRegionKey(data: Record<string, any>, lane: string): string | null {
  const preferred = [
    `world_emerald_${lane}`,
    `world_emerald_plus_${lane}`,
    `world_platinum_plus_${lane}`,
    `world_diamond_plus_${lane}`
  ]
  for (const key of preferred) {
    if (data[key]) return key
  }
  const keys = Object.keys(data)
  return keys.find((k) => k.includes('world') && k.includes(lane)) || null
}
