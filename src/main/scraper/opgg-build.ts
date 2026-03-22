import { extractRscPayloads, findJsonInPayload, opggSlug } from './opgg'
import { fetchPage } from './shared'
import { getCurrentPatch } from '../data/ddragon'
import { patchToOpgg } from '../data/settings'
import { getCachedBuild, setCachedBuild } from '../data/db'

export interface RuneInfo {
  name: string
  icon: string
}

export interface RuneOption {
  name: string
  icon: string
  isActive: boolean
}

export interface RuneSetup {
  primaryTree: RuneInfo
  secondaryTree: RuneInfo
  primaryRows: RuneOption[][]
  secondaryRows: RuneOption[][]
  shardRows: RuneOption[][]
  winRate: number
  gamesPlayed: number
}

export interface ItemBuild {
  items: { id: number; name: string; icon: string }[]
  winRate: number
  gamesPlayed: number
  pickRate: number
}

export interface MatchupBuildData {
  runes: RuneSetup | null
  items: ItemBuild[]
}

const LANE_MAP: Record<string, string> = {
  top: 'top',
  jungle: 'jungle',
  mid: 'mid',
  bottom: 'adc',
  support: 'support'
}

const inFlight = new Map<string, Promise<MatchupBuildData>>()

export async function scrapeMatchupBuild(
  champion: string,
  opponent: string,
  lane: string,
  patch?: string
): Promise<MatchupBuildData> {
  const cacheKey = `${champion}|${opponent}|${lane}`

  try {
    const cached = getCachedBuild(champion, opponent, lane)
    if (cached) return JSON.parse(cached) as MatchupBuildData
  } catch { /* db not ready or corrupt row */ }

  const existing = inFlight.get(cacheKey)
  if (existing) return existing

  const promise = fetchAndCacheBuild(champion, opponent, lane, patch)
  inFlight.set(cacheKey, promise)
  try {
    return await promise
  } finally {
    inFlight.delete(cacheKey)
  }
}

async function fetchAndCacheBuild(
  champion: string,
  opponent: string,
  lane: string,
  patch?: string
): Promise<MatchupBuildData> {
  const opggLane = LANE_MAP[lane] || lane
  const effectivePatch = patch || getCurrentPatch().split('.').slice(0, 2).join('.')
  const opggPatch = patchToOpgg(effectivePatch)
  const slug = opggSlug(champion)
  const opponentSlug = opggSlug(opponent)
  const url = `https://op.gg/lol/champions/${slug}/build/${opggLane}?target_champion=${opponentSlug}&patch=${opggPatch}`

  try {
    const html = await fetchPage(url)
    const payloads = extractRscPayloads(html)

    const runes = extractBestRuneSetup(payloads)
    const items = extractCoreBuilds(payloads)

    const result: MatchupBuildData = { runes, items }
    try { setCachedBuild(champion, opponent, lane, JSON.stringify(result)) } catch { /* best effort */ }
    return result
  } catch (err) {
    console.warn(`Failed to scrape build for ${champion} vs ${opponent} ${lane}:`, err)
    return { runes: null, items: [] }
  }
}

/**
 * Fire-and-forget prefetch for a list of matchups.
 * Fetches sequentially with a small delay to avoid hammering op.gg.
 */
export function prefetchBuilds(
  matchups: { champion: string; opponent: string; lane: string }[]
): void {
  const unique = matchups.filter((m, i, arr) =>
    arr.findIndex((x) => x.champion === m.champion && x.opponent === m.opponent && x.lane === m.lane) === i
  )

  let i = 0
  const next = (): void => {
    if (i >= unique.length) return
    const { champion, opponent, lane } = unique[i++]
    scrapeMatchupBuild(champion, opponent, lane).then(next, next)
  }
  next()
}

export function extractBestRuneSetup(payloads: string[]): RuneSetup | null {
  for (const payload of payloads) {
    if (!payload.includes('"rune_pages"')) continue

    const data = findJsonInPayload(payload, '"rune_pages"')
    if (!data) {
      const idx = payload.indexOf('{"rune_pages"')
      if (idx === -1) continue
      let depth = 0
      let end = idx
      for (let i = idx; i < payload.length; i++) {
        if (payload[i] === '{') depth++
        else if (payload[i] === '}') depth--
        if (depth === 0) { end = i; break }
      }
      try {
        const parsed = JSON.parse(payload.substring(idx, end + 1))
        return parseRunePages(parsed.rune_pages)
      } catch {
        continue
      }
    }

    if (Array.isArray(data)) {
      return parseRunePages(data)
    }
    if (data && Array.isArray(data.rune_pages)) {
      return parseRunePages(data.rune_pages)
    }
  }
  return null
}

function parseRunePages(pages: any[]): RuneSetup | null {
  if (!Array.isArray(pages) || pages.length === 0) return null

  const best = pages.reduce((a, b) =>
    (a.win_rate ?? 0) > (b.win_rate ?? 0) ? a : b
  )

  const build = best.builds?.[0]
  if (!build) return null

  const primaryTree: RuneInfo = {
    name: build.primary_perk_style?.name ?? '',
    icon: build.primary_perk_style?.image_url ?? ''
  }
  const secondaryTree: RuneInfo = {
    name: build.perk_sub_style?.name ?? '',
    icon: build.perk_sub_style?.image_url ?? ''
  }

  const toRow = (row: any[]): RuneOption[] =>
    row.map((r: any) => ({
      name: r?.name ?? '',
      icon: r?.image_url ?? '',
      isActive: !!r?.isActive
    })).filter((r: RuneOption) => r.name)

  const primaryRows = (build.main_runes || []).map(toRow).filter((r: RuneOption[]) => r.length > 0)
  const secondaryRows = (build.sub_runes || []).map(toRow).filter((r: RuneOption[]) => r.length > 0)
  const shardRows = (build.shards || []).map(toRow).filter((r: RuneOption[]) => r.length > 0)

  return {
    primaryTree,
    secondaryTree,
    primaryRows,
    secondaryRows,
    shardRows,
    winRate: (best.win_rate ?? 0) * 100,
    gamesPlayed: best.play ?? 0
  }
}

/**
 * Extracts core item builds from RSC component tree payloads.
 * Each core build row is keyed as "core_items_N" and contains:
 * - Item components with metaId and alt (name)
 * - Pick rate, games played, and win rate in table cells
 */
export function extractCoreBuilds(payloads: string[]): ItemBuild[] {
  const builds: ItemBuild[] = []
  const fullText = payloads.join('\n')

  const rowPattern = /\["\$","tr","core_items_(\d+)"/g
  let match: RegExpExecArray | null

  while ((match = rowPattern.exec(fullText)) !== null) {
    const rowStart = match.index
    const rowEnd = findRowEnd(fullText, rowStart)
    if (rowEnd === -1) continue

    const rowText = fullText.substring(rowStart, rowEnd)
    const build = parseCoreItemRow(rowText)
    if (build) builds.push(build)
  }

  builds.sort((a, b) => b.winRate - a.winRate)
  return builds.slice(0, 3)
}

function findRowEnd(text: string, start: number): number {
  const nextRow = text.indexOf('["$","tr","core_items_', start + 10)
  const nextSection = text.indexOf('["$","tr","depth_', start + 10)

  const candidates = [nextRow, nextSection].filter((i) => i > start)
  if (candidates.length === 0) {
    const tbodyEnd = text.indexOf('"tbody"', start + 10)
    return tbodyEnd > start ? tbodyEnd : Math.min(start + 5000, text.length)
  }
  return Math.min(...candidates)
}

export function parseCoreItemRow(rowText: string): ItemBuild | null {
  const items: { id: number; name: string; icon: string }[] = []

  const itemPattern = /"metaType":"item","metaId":(\d+),"children":\["\$","[^"]*",null,\{[^}]*"alt":"([^"]*)"/g
  let itemMatch: RegExpExecArray | null
  while ((itemMatch = itemPattern.exec(rowText)) !== null) {
    const id = parseInt(itemMatch[1], 10)
    const name = itemMatch[2]
    items.push({ id, name, icon: '' })
  }

  if (items.length === 0) return null

  const numbers: number[] = []
  const numPattern = /\["\$","strong",null,\{[^[]*"children":\[([0-9.]+),"%"\]\}/g
  let numMatch: RegExpExecArray | null
  while ((numMatch = numPattern.exec(rowText)) !== null) {
    numbers.push(parseFloat(numMatch[1]))
  }

  const gamesMatch = rowText.match(/"children":\["(\d[\d,]*)"\s*,\s*" "\s*,\s*"Games"\]/)
  const gamesPlayed = gamesMatch ? parseInt(gamesMatch[1].replace(/,/g, ''), 10) : 0

  const pickRate = numbers[0] ?? 0
  const winRate = numbers[1] ?? 0

  return { items, winRate, gamesPlayed, pickRate }
}
