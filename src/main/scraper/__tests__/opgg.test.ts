import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../data/db', () => ({
  getChampionRoles: vi.fn(),
  upsertChampionRole: vi.fn(),
  upsertMatchup: vi.fn(),
  getDb: vi.fn()
}))

vi.mock('../../data/ddragon', () => ({
  getChampionInternalId: vi.fn((name: string) => name),
  getCurrentPatch: vi.fn(() => '16.6.1'),
  getChampionNameById: vi.fn(() => '')
}))

vi.mock('../../data/settings', () => ({
  patchToOpgg: vi.fn((p: string) => p)
}))

vi.mock('../shared', () => ({
  fetchPage: vi.fn(),
  normalizeLane: vi.fn((lane: string) => lane.toLowerCase()),
  FLEX_THRESHOLD: 5
}))

import { getChampionRoles } from '../../data/db'
import {
  extractRscPayloads,
  findJsonInPayload,
  inferLanesFromStats,
  opggSlug,
  OPGG_LANE_NORMALIZE
} from '../opgg'

const mockGetChampionRoles = vi.mocked(getChampionRoles)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractRscPayloads', () => {
  it('extracts a single payload from minimal HTML', () => {
    const html = '<script>self.__next_f.push([1,"hello world"])</script>'
    const result = extractRscPayloads(html)
    expect(result).toEqual(['hello world'])
  })

  it('extracts multiple payloads', () => {
    const html = 'self.__next_f.push([1,"first"]) other stuff self.__next_f.push([1,"second"])'
    const result = extractRscPayloads(html)
    expect(result).toEqual(['first', 'second'])
  })

  it('handles escaped quotes', () => {
    const html = 'self.__next_f.push([1,"say \\"hello\\""])'
    const result = extractRscPayloads(html)
    expect(result).toEqual(['say "hello"'])
  })

  it('handles escaped newlines and tabs', () => {
    const html = 'self.__next_f.push([1,"line1\\nline2\\ttab"])'
    const result = extractRscPayloads(html)
    expect(result).toEqual(['line1\nline2\ttab'])
  })

  it('handles escaped unicode \\u0026', () => {
    const html = 'self.__next_f.push([1,"foo\\u0026bar"])'
    const result = extractRscPayloads(html)
    expect(result).toEqual(['foo&bar'])
  })

  it('handles escaped backslashes', () => {
    const html = 'self.__next_f.push([1,"back\\\\slash"])'
    const result = extractRscPayloads(html)
    expect(result).toEqual(['back\\slash'])
  })

  it('returns empty array when no payloads found', () => {
    const html = '<html><body>no payloads here</body></html>'
    const result = extractRscPayloads(html)
    expect(result).toEqual([])
  })

  it('returns empty array for empty input', () => {
    expect(extractRscPayloads('')).toEqual([])
  })
})

describe('findJsonInPayload', () => {
  it('finds an object after the marker', () => {
    const payload = 'prefix "data":{"key":"value"} suffix'
    const result = findJsonInPayload(payload, '"data"')
    expect(result).toEqual({ key: 'value' })
  })

  it('finds an array after the marker', () => {
    const payload = 'prefix "items":[1,2,3] suffix'
    const result = findJsonInPayload(payload, '"items"')
    expect(result).toEqual([1, 2, 3])
  })

  it('handles nested braces', () => {
    const payload = '"data":{"a":{"b":1},"c":2}'
    const result = findJsonInPayload(payload, '"data"')
    expect(result).toEqual({ a: { b: 1 }, c: 2 })
  })

  it('handles nested brackets', () => {
    const payload = '"data":[[1,2],[3,4]]'
    const result = findJsonInPayload(payload, '"data"')
    expect(result).toEqual([[1, 2], [3, 4]])
  })

  it('prefers array when bracket comes before brace', () => {
    const payload = '"data":[{"a":1}]'
    const result = findJsonInPayload(payload, '"data"')
    expect(result).toEqual([{ a: 1 }])
  })

  it('returns null when marker not found', () => {
    const payload = 'some random text'
    expect(findJsonInPayload(payload, '"missing"')).toBeNull()
  })

  it('returns null when no JSON structure after marker', () => {
    const payload = '"data": plain text no braces'
    expect(findJsonInPayload(payload, '"data"')).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    const payload = '"data":{broken json here}'
    expect(findJsonInPayload(payload, '"data"')).toBeNull()
  })
})

describe('inferLanesFromStats', () => {
  it('returns lanes from champion_roles when above FLEX_THRESHOLD', () => {
    mockGetChampionRoles.mockReturnValue([
      { lane: 'top', pickRate: 60 },
      { lane: 'mid', pickRate: 20 }
    ])
    const result = inferLanesFromStats({}, 'Aatrox')
    expect(result).toEqual(['top', 'mid'])
  })

  it('ignores roles below FLEX_THRESHOLD', () => {
    mockGetChampionRoles.mockReturnValue([
      { lane: 'top', pickRate: 60 },
      { lane: 'support', pickRate: 2 }
    ])
    const result = inferLanesFromStats({}, 'Aatrox')
    expect(result).toEqual(['top'])
  })

  it('falls back to stat.position when no roles above threshold', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = inferLanesFromStats({ position: 'TOP' }, 'Aatrox')
    expect(result).toEqual(['top'])
  })

  it('falls back to stat.lane when no position', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = inferLanesFromStats({ lane: 'jungle' }, 'Aatrox')
    expect(result).toEqual(['jungle'])
  })

  it('falls back to stat.role when no lane', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = inferLanesFromStats({ role: 'support' }, 'Aatrox')
    expect(result).toEqual(['support'])
  })

  it('defaults to ["mid"] when no data available', () => {
    mockGetChampionRoles.mockReturnValue([])
    const result = inferLanesFromStats({}, 'Aatrox')
    expect(result).toEqual(['mid'])
  })
})

describe('opggSlug', () => {
  it('lowercases the internal ID', () => {
    expect(opggSlug('Aatrox')).toBe('aatrox')
  })
})

describe('OPGG_LANE_NORMALIZE', () => {
  it('maps all expected lane names', () => {
    expect(OPGG_LANE_NORMALIZE['TOP']).toBe('top')
    expect(OPGG_LANE_NORMALIZE['JUNGLE']).toBe('jungle')
    expect(OPGG_LANE_NORMALIZE['MID']).toBe('mid')
    expect(OPGG_LANE_NORMALIZE['MIDDLE']).toBe('mid')
    expect(OPGG_LANE_NORMALIZE['ADC']).toBe('bottom')
    expect(OPGG_LANE_NORMALIZE['BOTTOM']).toBe('bottom')
    expect(OPGG_LANE_NORMALIZE['SUPPORT']).toBe('support')
  })
})
