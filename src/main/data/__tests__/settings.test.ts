import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFs: Record<string, string> = {}
let mockUserDataPath = '/mock/userData'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => mockUserDataPath)
  }
}))

vi.mock('fs', () => ({
  existsSync: vi.fn((p: string) => p in mockFs || p === mockUserDataPath),
  readFileSync: vi.fn((p: string) => {
    if (p in mockFs) return mockFs[p]
    throw new Error('ENOENT')
  }),
  writeFileSync: vi.fn((p: string, data: string) => {
    mockFs[p] = data
  }),
  mkdirSync: vi.fn()
}))

import { patchToOpgg, patchToUgg, getSettings, saveSettings, getAvailablePatches } from '../settings'

beforeEach(() => {
  vi.clearAllMocks()
  for (const key of Object.keys(mockFs)) delete mockFs[key]
})

describe('patchToOpgg', () => {
  it('pads single-digit minor version', () => {
    expect(patchToOpgg('16.6')).toBe('16.06')
  })

  it('keeps double-digit minor version as-is', () => {
    expect(patchToOpgg('16.12')).toBe('16.12')
  })

  it('pads minor version 1', () => {
    expect(patchToOpgg('15.1')).toBe('15.01')
  })

  it('returns input unchanged if no dot', () => {
    expect(patchToOpgg('16')).toBe('16')
  })

  it('handles three-part version by using first two parts', () => {
    expect(patchToOpgg('16.6.1')).toBe('16.06')
  })
})

describe('patchToUgg', () => {
  it('replaces dot with underscore', () => {
    expect(patchToUgg('16.6')).toBe('16_6')
  })

  it('replaces first dot only', () => {
    expect(patchToUgg('16.12')).toBe('16_12')
  })

  it('handles version with multiple dots (replaces first)', () => {
    expect(patchToUgg('16.6.1')).toBe('16_6.1')
  })

  it('returns input unchanged if no dot', () => {
    expect(patchToUgg('16')).toBe('16')
  })
})

describe('getSettings', () => {
  it('returns defaults when file does not exist', () => {
    const settings = getSettings()
    expect(settings).toEqual({
      summonerName: '',
      tagline: '',
      region: 'na',
      selectedPatch: '',
      onboardingComplete: false
    })
  })

  it('merges saved values with defaults', () => {
    const settingsPath = `${mockUserDataPath}/settings.json`
    mockFs[settingsPath] = JSON.stringify({ summonerName: 'TestUser', region: 'euw' })
    const settings = getSettings()
    expect(settings.summonerName).toBe('TestUser')
    expect(settings.region).toBe('euw')
    expect(settings.tagline).toBe('')
    expect(settings.onboardingComplete).toBe(false)
  })

  it('returns defaults on malformed JSON', () => {
    const settingsPath = `${mockUserDataPath}/settings.json`
    mockFs[settingsPath] = '{broken json'
    const settings = getSettings()
    expect(settings.region).toBe('na')
  })
})

describe('saveSettings', () => {
  it('writes JSON to the correct path', () => {
    const settings = {
      summonerName: 'Player1',
      tagline: 'NA1',
      region: 'na',
      selectedPatch: '16.6',
      onboardingComplete: true
    }
    saveSettings(settings)
    const settingsPath = `${mockUserDataPath}/settings.json`
    expect(mockFs[settingsPath]).toBeDefined()
    const written = JSON.parse(mockFs[settingsPath])
    expect(written.summonerName).toBe('Player1')
    expect(written.onboardingComplete).toBe(true)
  })
})

describe('getAvailablePatches', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('deduplicates and shortens version strings', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(['16.6.1', '16.6.2', '16.5.1', '16.4.1'])
    }) as any
    const patches = await getAvailablePatches()
    expect(patches).toEqual(['16.6', '16.5', '16.4'])
  })

  it('caps at 10 patches', async () => {
    const versions = Array.from({ length: 20 }, (_, i) => `16.${20 - i}.1`)
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(versions)
    }) as any
    const patches = await getAvailablePatches()
    expect(patches).toHaveLength(10)
  })

  it('returns empty array on network error', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error')) as any
    const patches = await getAvailablePatches()
    expect(patches).toEqual([])
  })

  it('returns empty array on non-OK response', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false }) as any
    const patches = await getAvailablePatches()
    expect(patches).toEqual([])
  })
})
