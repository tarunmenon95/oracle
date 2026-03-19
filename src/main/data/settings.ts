import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs'

interface AppSettings {
  summonerName: string
  tagline: string
  region: string
  selectedPatch: string
  onboardingComplete: boolean
}

const DEFAULTS: AppSettings = {
  summonerName: '',
  tagline: '',
  region: 'na',
  selectedPatch: '',
  onboardingComplete: false
}

const VERSIONS_CDN = 'https://static.bigbrain.gg/assets/lol/riot_patch_update/prod/versions.json'

/**
 * Fetches the list of available patches from u.gg's CDN.
 * Returns display-friendly versions like ["16.6", "16.5", "16.4", ...].
 */
export async function getAvailablePatches(): Promise<string[]> {
  try {
    const res = await fetch(VERSIONS_CDN, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    })
    if (!res.ok) return []
    const versions: string[] = await res.json()
    const seen = new Set<string>()
    const patches: string[] = []
    for (const v of versions) {
      const short = v.split('.').slice(0, 2).join('.')
      if (!seen.has(short)) {
        seen.add(short)
        patches.push(short)
      }
      if (patches.length >= 10) break
    }
    return patches
  } catch {
    return []
  }
}

/**
 * Converts a display patch like "16.6" to op.gg format "16.06".
 */
export function patchToOpgg(patch: string): string {
  const parts = patch.split('.')
  if (parts.length < 2) return patch
  return `${parts[0]}.${parts[1].padStart(2, '0')}`
}

/**
 * Converts a display patch like "16.6" to u.gg format "16_6".
 */
export function patchToUgg(patch: string): string {
  return patch.replace('.', '_')
}

function getSettingsPath(): string {
  const dir = app.getPath('userData')
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  return join(dir, 'settings.json')
}

export function getSettings(): AppSettings {
  const path = getSettingsPath()
  if (!existsSync(path)) return { ...DEFAULTS }

  try {
    const raw = readFileSync(path, 'utf-8')
    return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveSettings(settings: AppSettings): void {
  const path = getSettingsPath()
  writeFileSync(path, JSON.stringify(settings, null, 2), 'utf-8')
}
