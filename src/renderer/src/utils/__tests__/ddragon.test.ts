import { describe, it, expect } from 'vitest'
import { nameToInternalId, laneIcon, championIcon, championSplash, championLoading, getPatch } from '../ddragon'

describe('getPatch', () => {
  it('returns the default cached patch value', () => {
    const patch = getPatch()
    expect(typeof patch).toBe('string')
    expect(patch.length).toBeGreaterThan(0)
  })
})

describe('nameToInternalId', () => {
  it('maps known special names', () => {
    expect(nameToInternalId("Dr. Mundo")).toBe('DrMundo')
    expect(nameToInternalId("Kai'Sa")).toBe('Kaisa')
    expect(nameToInternalId("Kha'Zix")).toBe('Khazix')
    expect(nameToInternalId("Cho'Gath")).toBe('Chogath')
    expect(nameToInternalId("Kog'Maw")).toBe('KogMaw')
    expect(nameToInternalId("Rek'Sai")).toBe('RekSai')
    expect(nameToInternalId("Vel'Koz")).toBe('VelKoz')
    expect(nameToInternalId("Bel'Veth")).toBe('Belveth')
    expect(nameToInternalId("K'Sante")).toBe('KSante')
    expect(nameToInternalId("Lee Sin")).toBe('LeeSin')
    expect(nameToInternalId("Master Yi")).toBe('MasterYi')
    expect(nameToInternalId("Miss Fortune")).toBe('MissFortune')
    expect(nameToInternalId("Tahm Kench")).toBe('TahmKench')
    expect(nameToInternalId("Twisted Fate")).toBe('TwistedFate')
    expect(nameToInternalId("Xin Zhao")).toBe('XinZhao')
    expect(nameToInternalId("Jarvan IV")).toBe('JarvanIV')
    expect(nameToInternalId("Aurelion Sol")).toBe('AurelionSol')
    expect(nameToInternalId("Renata Glasc")).toBe('Renata')
    expect(nameToInternalId("Nunu & Willump")).toBe('Nunu')
    expect(nameToInternalId("Wukong")).toBe('MonkeyKing')
  })

  it('strips non-alpha characters for unknown names', () => {
    expect(nameToInternalId('Aatrox')).toBe('Aatrox')
    expect(nameToInternalId('Zed')).toBe('Zed')
  })

  it('returns empty string for empty input', () => {
    expect(nameToInternalId('')).toBe('')
  })

  it('returns empty string for "?"', () => {
    expect(nameToInternalId('?')).toBe('')
  })
})

describe('laneIcon', () => {
  const BASE = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions'

  it('maps standard lane names to position icons', () => {
    expect(laneIcon('top')).toBe(`${BASE}/icon-position-top.png`)
    expect(laneIcon('jungle')).toBe(`${BASE}/icon-position-jungle.png`)
    expect(laneIcon('mid')).toBe(`${BASE}/icon-position-middle.png`)
    expect(laneIcon('middle')).toBe(`${BASE}/icon-position-middle.png`)
    expect(laneIcon('bottom')).toBe(`${BASE}/icon-position-bottom.png`)
    expect(laneIcon('adc')).toBe(`${BASE}/icon-position-bottom.png`)
    expect(laneIcon('support')).toBe(`${BASE}/icon-position-utility.png`)
    expect(laneIcon('utility')).toBe(`${BASE}/icon-position-utility.png`)
  })

  it('is case-insensitive', () => {
    expect(laneIcon('TOP')).toBe(`${BASE}/icon-position-top.png`)
    expect(laneIcon('Jungle')).toBe(`${BASE}/icon-position-jungle.png`)
  })
})

describe('championIcon', () => {
  it('returns correct URL with cached patch', () => {
    const url = championIcon('Aatrox')
    expect(url).toMatch(/ddragon\.leagueoflegends\.com\/cdn\/.*\/img\/champion\/Aatrox\.png/)
  })

  it('returns empty string for empty input', () => {
    expect(championIcon('')).toBe('')
  })
})

describe('championSplash', () => {
  it('returns correct URL with default skin', () => {
    const url = championSplash('Aatrox')
    expect(url).toBe('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_0.jpg')
  })

  it('returns correct URL with specified skin', () => {
    const url = championSplash('Aatrox', 3)
    expect(url).toBe('https://ddragon.leagueoflegends.com/cdn/img/champion/splash/Aatrox_3.jpg')
  })

  it('returns empty string for empty input', () => {
    expect(championSplash('')).toBe('')
  })
})

describe('championLoading', () => {
  it('returns correct URL with default skin', () => {
    const url = championLoading('Aatrox')
    expect(url).toBe('https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Aatrox_0.jpg')
  })

  it('returns correct URL with specified skin', () => {
    const url = championLoading('Zed', 2)
    expect(url).toBe('https://ddragon.leagueoflegends.com/cdn/img/champion/loading/Zed_2.jpg')
  })

  it('returns empty string for empty input', () => {
    expect(championLoading('')).toBe('')
  })
})
