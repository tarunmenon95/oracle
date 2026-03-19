import { describe, it, expect } from 'vitest'
import { extractSsrData, findRegionKey, uggSlug } from '../ugg'

describe('extractSsrData', () => {
  it('parses valid __SSR_DATA__ with __APOLLO_STATE__ terminator', () => {
    const html = '<script>window.__SSR_DATA__ = {"key":"value"};window.__APOLLO_STATE__ = {}</script>'
    const result = extractSsrData(html)
    expect(result).toEqual({ key: 'value' })
  })

  it('parses valid __SSR_DATA__ with </script> terminator', () => {
    const html = '<script>window.__SSR_DATA__ = {"key":"value"};</script>'
    const result = extractSsrData(html)
    expect(result).toEqual({ key: 'value' })
  })

  it('strips trailing semicolons', () => {
    const html = '<script>window.__SSR_DATA__ = {"a":1};;;</script>'
    const result = extractSsrData(html)
    expect(result).toEqual({ a: 1 })
  })

  it('strips trailing newlines', () => {
    const html = '<script>window.__SSR_DATA__ = {"a":1};\n\n</script>'
    const result = extractSsrData(html)
    expect(result).toEqual({ a: 1 })
  })

  it('handles complex nested data', () => {
    const data = { path: { data: { world_emerald_mid: { counters: [{ champion_id: 1 }] } } } }
    const html = `<script>window.__SSR_DATA__ = ${JSON.stringify(data)};</script>`
    const result = extractSsrData(html)
    expect(result).toEqual(data)
  })

  it('returns null when marker not found', () => {
    const html = '<script>var x = 1;</script>'
    expect(extractSsrData(html)).toBeNull()
  })

  it('returns null when no terminator found', () => {
    const html = '__SSR_DATA__ = {"a":1}'
    expect(extractSsrData(html)).toBeNull()
  })

  it('returns null for malformed JSON', () => {
    const html = '<script>window.__SSR_DATA__ = {broken json;</script>'
    expect(extractSsrData(html)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(extractSsrData('')).toBeNull()
  })
})

describe('findRegionKey', () => {
  it('finds preferred key world_emerald_{lane} first', () => {
    const data = {
      world_emerald_mid: { counters: [] },
      world_emerald_plus_mid: { counters: [] },
      world_platinum_plus_mid: { counters: [] }
    }
    expect(findRegionKey(data, 'mid')).toBe('world_emerald_mid')
  })

  it('falls back to world_emerald_plus_{lane}', () => {
    const data = {
      world_emerald_plus_mid: { counters: [] },
      world_platinum_plus_mid: { counters: [] }
    }
    expect(findRegionKey(data, 'mid')).toBe('world_emerald_plus_mid')
  })

  it('falls back to world_platinum_plus_{lane}', () => {
    const data = {
      world_platinum_plus_mid: { counters: [] },
      world_diamond_plus_mid: { counters: [] }
    }
    expect(findRegionKey(data, 'mid')).toBe('world_platinum_plus_mid')
  })

  it('falls back to world_diamond_plus_{lane}', () => {
    const data = {
      world_diamond_plus_mid: { counters: [] }
    }
    expect(findRegionKey(data, 'mid')).toBe('world_diamond_plus_mid')
  })

  it('falls back to any key containing world and lane', () => {
    const data = {
      world_gold_mid: { counters: [] },
      na_emerald_top: { counters: [] }
    }
    expect(findRegionKey(data, 'mid')).toBe('world_gold_mid')
  })

  it('returns null when no matching key exists', () => {
    const data = {
      na_emerald_top: { counters: [] },
      eu_diamond_jungle: { counters: [] }
    }
    expect(findRegionKey(data, 'mid')).toBeNull()
  })

  it('returns null for empty data', () => {
    expect(findRegionKey({}, 'mid')).toBeNull()
  })

  it('works for all standard lanes', () => {
    for (const lane of ['top', 'jungle', 'mid', 'adc', 'support']) {
      const data = { [`world_emerald_${lane}`]: { counters: [] } }
      expect(findRegionKey(data, lane)).toBe(`world_emerald_${lane}`)
    }
  })
})

describe('uggSlug', () => {
  it('lowercases the name', () => {
    expect(uggSlug('Aatrox')).toBe('aatrox')
  })

  it('strips apostrophes', () => {
    expect(uggSlug("Kai'Sa")).toBe('kaisa')
    expect(uggSlug("Kha'Zix")).toBe('khazix')
  })

  it('strips dots', () => {
    expect(uggSlug('Dr. Mundo')).toBe('dr-mundo')
  })

  it('replaces spaces with hyphens', () => {
    expect(uggSlug('Lee Sin')).toBe('lee-sin')
    expect(uggSlug('Aurelion Sol')).toBe('aurelion-sol')
  })

  it('handles multiple special characters', () => {
    expect(uggSlug("Nunu & Willump")).toBe('nunu-&-willump')
  })

  it('handles simple names', () => {
    expect(uggSlug('Zed')).toBe('zed')
  })
})
