import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../shared', () => ({
  fetchPage: vi.fn(),
  normalizeLane: vi.fn((l: string) => l),
  FLEX_THRESHOLD: 5
}))

vi.mock('../../data/ddragon', () => ({
  getCurrentPatch: vi.fn(() => '16.6.1'),
  getChampionInternalId: vi.fn((name: string) => name)
}))

vi.mock('../../data/settings', () => ({
  patchToOpgg: vi.fn((p: string) => p.replace('.', '.0'))
}))

vi.mock('../../data/db', () => ({
  getCachedBuild: vi.fn(() => null),
  setCachedBuild: vi.fn()
}))

import { extractBestRuneSetup, extractCoreBuilds, parseCoreItemRow, prefetchBuilds, scrapeMatchupBuild } from '../opgg-build'
import { getCachedBuild, setCachedBuild } from '../../data/db'
import { fetchPage } from '../shared'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractBestRuneSetup', () => {
  it('returns null when no rune_pages found', () => {
    const result = extractBestRuneSetup(['some random payload', 'no rune data here'])
    expect(result).toBeNull()
  })

  it('extracts the highest win rate rune page', () => {
    const runeData = JSON.stringify({
      rune_pages: [
        {
          id: 8112,
          play: 500,
          pick_rate: 0.3,
          win_rate: 0.45,
          builds: [{
            primary_perk_style: { id: 8100, name: 'Domination', image_url: 'https://opgg-static.akamaized.net/meta/images/lol/perkStyle/8100.png' },
            perk_sub_style: { id: 8200, name: 'Sorcery', image_url: 'https://opgg-static.akamaized.net/meta/images/lol/perkStyle/8200.png' },
            main_runes: [
              [{ id: 8112, name: 'Electrocute', image_url: 'https://opgg-static.akamaized.net/perk/8112.png', isActive: true }, { id: 8128, name: 'Dark Harvest', image_url: 'https://opgg-static.akamaized.net/perk/8128.png', isActive: false }],
              [{ id: 8143, name: 'Sudden Impact', image_url: 'https://opgg-static.akamaized.net/perk/8143.png', isActive: true }],
              [{ id: 8140, name: 'Grisly Mementos', image_url: 'https://opgg-static.akamaized.net/perk/8140.png', isActive: true }],
              [{ id: 8105, name: 'Relentless Hunter', image_url: 'https://opgg-static.akamaized.net/perk/8105.png', isActive: true }]
            ],
            sub_runes: [
              [{ id: 8233, name: 'Absolute Focus', image_url: 'https://opgg-static.akamaized.net/perk/8233.png', isActive: true }],
              [{ id: 8237, name: 'Scorch', image_url: 'https://opgg-static.akamaized.net/perk/8237.png', isActive: true }]
            ],
            shards: [
              [{ id: 5008, name: 'Adaptive Force', image_url: 'https://opgg-static.akamaized.net/perkShard/5008.png', isActive: true }],
              [{ id: 5008, name: 'Adaptive Force', image_url: 'https://opgg-static.akamaized.net/perkShard/5008.png', isActive: true }],
              [{ id: 5001, name: 'Health Scaling', image_url: 'https://opgg-static.akamaized.net/perkShard/5001.png', isActive: true }]
            ]
          }]
        },
        {
          id: 9923,
          play: 1000,
          pick_rate: 0.6,
          win_rate: 0.55,
          builds: [{
            primary_perk_style: { id: 8100, name: 'Domination', image_url: 'https://opgg-static.akamaized.net/meta/images/lol/perkStyle/8100.png' },
            perk_sub_style: { id: 8200, name: 'Sorcery', image_url: 'https://opgg-static.akamaized.net/meta/images/lol/perkStyle/8200.png' },
            main_runes: [
              [{ id: 9923, name: 'Hail of Blades', image_url: 'https://opgg-static.akamaized.net/perk/9923.png', isActive: true }],
              [{ id: 8143, name: 'Sudden Impact', image_url: 'https://opgg-static.akamaized.net/perk/8143.png', isActive: true }],
              [{ id: 8140, name: 'Grisly Mementos', image_url: 'https://opgg-static.akamaized.net/perk/8140.png', isActive: true }],
              [{ id: 8105, name: 'Relentless Hunter', image_url: 'https://opgg-static.akamaized.net/perk/8105.png', isActive: true }]
            ],
            sub_runes: [
              [{ id: 8233, name: 'Absolute Focus', image_url: 'https://opgg-static.akamaized.net/perk/8233.png', isActive: true }],
              [{ id: 8237, name: 'Scorch', image_url: 'https://opgg-static.akamaized.net/perk/8237.png', isActive: true }]
            ],
            shards: [
              [{ id: 5008, name: 'Adaptive Force', image_url: 'https://opgg-static.akamaized.net/perkShard/5008.png', isActive: true }],
              [{ id: 5008, name: 'Adaptive Force', image_url: 'https://opgg-static.akamaized.net/perkShard/5008.png', isActive: true }],
              [{ id: 5001, name: 'Health Scaling', image_url: 'https://opgg-static.akamaized.net/perkShard/5001.png', isActive: true }]
            ]
          }]
        }
      ]
    })

    const payload = `some prefix ${runeData} some suffix`
    const result = extractBestRuneSetup([payload])

    expect(result).not.toBeNull()
    expect(result!.primaryTree.name).toBe('Domination')
    expect(result!.primaryTree.icon).toContain('8100')
    expect(result!.secondaryTree.name).toBe('Sorcery')
    expect(result!.secondaryTree.icon).toContain('8200')
    expect(result!.winRate).toBeCloseTo(55, 1)
    expect(result!.gamesPlayed).toBe(1000)

    expect(result!.primaryRows).toHaveLength(4)
    const keystoneRow = result!.primaryRows[0]
    const activeKeystone = keystoneRow.find(r => r.isActive)
    expect(activeKeystone?.name).toBe('Hail of Blades')
    expect(activeKeystone?.icon).toBeTruthy()

    const activeNames = result!.primaryRows.slice(1).map(row => row.find(r => r.isActive)?.name)
    expect(activeNames).toEqual(['Sudden Impact', 'Grisly Mementos', 'Relentless Hunter'])

    const secondaryActiveNames = result!.secondaryRows.map(row => row.find(r => r.isActive)?.name)
    expect(secondaryActiveNames).toEqual(['Absolute Focus', 'Scorch'])

    const shardActiveNames = result!.shardRows.map(row => row.find(r => r.isActive)?.name)
    expect(shardActiveNames).toEqual(['Adaptive Force', 'Adaptive Force', 'Health Scaling'])
  })

  it('handles rune page with missing builds gracefully', () => {
    const runeData = JSON.stringify({
      rune_pages: [
        { id: 8112, play: 500, pick_rate: 0.3, win_rate: 0.45, builds: [] }
      ]
    })
    const payload = `prefix ${runeData} suffix`
    const result = extractBestRuneSetup([payload])
    expect(result).toBeNull()
  })
})

describe('parseCoreItemRow', () => {
  it('extracts items and stats from a core build row', () => {
    const rowText = `["$","tr","core_items_0",{"className":"text-xs","children":[["$","td",null,{"children":["$","div",null,{"className":"flex","children":[["$","$1","2510-0",{"children":[false,["$","div",null,{"className":"relative","children":["$","$L55",null,{"metaType":"item","metaId":2510,"children":["$","$L56",null,{"className":"rounded","src":"https://example.com/item/2510.png","alt":"Dusk and Dawn","width":32,"height":32}]}]}]]}],["$","$1","4645-1",{"children":[["$","svg",null,{}],["$","div",null,{"className":"relative","children":["$","$L55",null,{"metaType":"item","metaId":4645,"children":["$","$L56",null,{"className":"rounded","src":"https://example.com/item/4645.png","alt":"Shadowflame","width":32,"height":32}]}]}]]}]]}]}],["$","td",null,{"children":["$","div",null,{"className":"flex flex-col items-center justify-center","children":[["$","strong",null,{"children":[16.85,"%"]}],["$","span",null,{"className":"text-gray-500","children":["295"," ","Games"]}]]}]}],["$","td",null,{"children":["$","strong",null,{"className":"flex justify-center text-xs text-main-600","children":[51.53,"%"]}]}]]}]`

    const result = parseCoreItemRow(rowText)
    expect(result).not.toBeNull()
    expect(result!.items).toHaveLength(2)
    expect(result!.items[0]).toEqual({ id: 2510, name: 'Dusk and Dawn', icon: '' })
    expect(result!.items[1]).toEqual({ id: 4645, name: 'Shadowflame', icon: '' })
    expect(result!.pickRate).toBeCloseTo(16.85, 2)
    expect(result!.gamesPlayed).toBe(295)
    expect(result!.winRate).toBeCloseTo(51.53, 2)
  })

  it('returns null when no items found', () => {
    const result = parseCoreItemRow('some random text with no item data')
    expect(result).toBeNull()
  })
})

describe('extractCoreBuilds', () => {
  it('returns empty array when no core_items rows found', () => {
    const result = extractCoreBuilds(['no item data here'])
    expect(result).toEqual([])
  })

  it('extracts and sorts builds by win rate, limited to top 3', () => {
    const makeRow = (idx: number, itemId: number, itemName: string, pickRate: number, games: string, winRate: number) =>
      `["$","tr","core_items_${idx}",{"className":"text-xs","children":[["$","td",null,{"children":["$","div",null,{"className":"flex","children":[["$","$1","${itemId}-0",{"children":[false,["$","div",null,{"className":"relative","children":["$","$L55",null,{"metaType":"item","metaId":${itemId},"children":["$","$L56",null,{"className":"rounded","src":"x","alt":"${itemName}","width":32,"height":32}]}]}]]}]]}]}],["$","td",null,{"children":["$","div",null,{"className":"flex flex-col items-center justify-center","children":[["$","strong",null,{"children":[${pickRate},"%"]}],["$","span",null,{"className":"text-gray-500","children":["${games}"," ","Games"]}]]}]}],["$","td",null,{"children":["$","strong",null,{"className":"flex justify-center text-xs","children":[${winRate},"%"]}]}]]}]`

    const payload = [
      makeRow(0, 2510, 'Dusk and Dawn', 16.85, '295', 51.53),
      makeRow(1, 3100, 'Lich Bane', 10.91, '191', 64.4),
      makeRow(2, 3157, 'Zhonyas', 4, '70', 50),
      makeRow(3, 3089, 'Deathcap', 4, '70', 61.43)
    ].join('')

    const result = extractCoreBuilds([payload])
    expect(result.length).toBe(3)
    expect(result[0].winRate).toBeCloseTo(64.4, 1)
    expect(result[1].winRate).toBeCloseTo(61.43, 1)
    expect(result[2].winRate).toBeCloseTo(51.53, 1)
  })
})

describe('scrapeMatchupBuild – SQLite cache', () => {
  it('returns cached data from DB without fetching', async () => {
    const cached = { runes: null, items: [{ items: [{ id: 1, name: 'Sword', icon: '' }], winRate: 55, gamesPlayed: 100, pickRate: 20 }] }
    vi.mocked(getCachedBuild).mockReturnValue(JSON.stringify(cached))

    const result = await scrapeMatchupBuild('Ekko', 'Zed', 'mid')
    expect(result).toEqual(cached)
    expect(fetchPage).not.toHaveBeenCalled()
  })

  it('fetches and persists to DB on cache miss', async () => {
    vi.mocked(getCachedBuild).mockReturnValue(null)
    vi.mocked(fetchPage as any).mockResolvedValue('<html></html>')

    const result = await scrapeMatchupBuild('Ekko', 'Zed', 'mid')
    expect(fetchPage).toHaveBeenCalledOnce()
    expect(setCachedBuild).toHaveBeenCalledWith('Ekko', 'Zed', 'mid', expect.any(String))
    expect(result).toEqual({ runes: null, items: [] })
  })
})

describe('prefetchBuilds', () => {
  it('deduplicates and fetches sequentially', async () => {
    vi.mocked(getCachedBuild).mockReturnValue(null)
    vi.mocked(fetchPage as any).mockResolvedValue('<html></html>')

    const done = new Promise<void>((resolve) => {
      let calls = 0
      vi.mocked(setCachedBuild).mockImplementation(() => {
        calls++
        if (calls >= 2) setTimeout(resolve, 10)
      })
    })

    prefetchBuilds([
      { champion: 'Ekko', opponent: 'Zed', lane: 'mid' },
      { champion: 'Ekko', opponent: 'Zed', lane: 'mid' },
      { champion: 'Ekko', opponent: 'Ahri', lane: 'mid' }
    ])

    await done
    expect(fetchPage).toHaveBeenCalledTimes(2)
  })
})
