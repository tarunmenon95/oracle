import { net } from 'electron'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

interface ChampionData {
  id: string
  key: string
  name: string
}

let championMap: Map<number, ChampionData> = new Map()
let championsByName: Map<string, ChampionData & { numericId: number }> = new Map()
let currentPatch: string = '15.6.1'
let loaded = false
let cachedAllChampions: { id: number; name: string; icon: string }[] | null = null

const VERSIONS_URL = 'https://ddragon.leagueoflegends.com/api/versions.json'

function getCacheDir(): string {
  const dir = join(app.getPath('userData'), 'ddragon-cache')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return dir
}

function getCachePath(): string {
  return join(getCacheDir(), 'champions.json')
}

function loadFromCache(): boolean {
  const cachePath = getCachePath()
  if (!existsSync(cachePath)) return false

  try {
    const raw = readFileSync(cachePath, 'utf-8')
    const data = JSON.parse(raw) as { patch: string; champions: Record<string, any> }
    populateMaps(data.champions)
    currentPatch = data.patch
    loaded = true
    return true
  } catch {
    return false
  }
}

function saveToCache(patch: string, champions: Record<string, any>): void {
  const cachePath = getCachePath()
  writeFileSync(cachePath, JSON.stringify({ patch, champions }), 'utf-8')
}

function populateMaps(champions: Record<string, any>): void {
  championMap.clear()
  championsByName.clear()
  cachedAllChampions = null

  for (const [, champ] of Object.entries(champions)) {
    const numericId = parseInt(champ.key, 10)
    const data: ChampionData = { id: champ.id, key: champ.key, name: champ.name }
    championMap.set(numericId, data)
    championsByName.set(champ.name.toLowerCase(), { ...data, numericId })
    championsByName.set(champ.id.toLowerCase(), { ...data, numericId })
  }
}

async function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    let body = ''
    request.on('response', (response) => {
      response.on('data', (chunk) => { body += chunk.toString() })
      response.on('end', () => {
        try { resolve(JSON.parse(body)) }
        catch (e) { reject(e) }
      })
    })
    request.on('error', reject)
    request.end()
  })
}

export async function initDdragon(): Promise<void> {
  if (loaded) return

  if (loadFromCache()) {
    refreshInBackground()
    return
  }

  await refreshDdragon()
}

async function refreshDdragon(): Promise<void> {
  try {
    const versions: string[] = await fetchJson(VERSIONS_URL)
    const latestPatch = versions[0]
    currentPatch = latestPatch

    const champUrl = `https://ddragon.leagueoflegends.com/cdn/${latestPatch}/data/en_US/champion.json`
    const champData = await fetchJson(champUrl)
    populateMaps(champData.data)
    saveToCache(latestPatch, champData.data)
    loaded = true
  } catch (err) {
    console.error('Failed to fetch DDragon data:', err)
  }
}

function refreshInBackground(): void {
  setTimeout(() => refreshDdragon(), 10_000)
}

export function getChampionNameById(id: number): string {
  if (id === 0) return ''
  return championMap.get(id)?.name || `Champion(${id})`
}

export function getChampionIdByName(name: string): number {
  const entry = championsByName.get(name.toLowerCase())
  return entry?.numericId || 0
}

export function getAllChampions(): { id: number; name: string; icon: string }[] {
  if (cachedAllChampions) return cachedAllChampions
  const result: { id: number; name: string; icon: string }[] = []
  for (const [numericId, data] of championMap.entries()) {
    result.push({
      id: numericId,
      name: data.name,
      icon: `https://ddragon.leagueoflegends.com/cdn/${currentPatch}/img/champion/${data.id}.png`
    })
  }
  cachedAllChampions = result.sort((a, b) => a.name.localeCompare(b.name))
  return cachedAllChampions
}

export function getCurrentPatch(): string {
  return currentPatch
}

export function getChampionInternalId(name: string): string {
  const entry = championsByName.get(name.toLowerCase())
  return entry?.id || name
}
