import { describe, it, expect } from 'vitest'
import { normalizeLane, FLEX_THRESHOLD } from '../shared'

describe('normalizeLane', () => {
  it('maps "top" to "top"', () => {
    expect(normalizeLane('top')).toBe('top')
  })

  it('maps "jungle" to "jungle"', () => {
    expect(normalizeLane('jungle')).toBe('jungle')
  })

  it('maps "middle" to "mid"', () => {
    expect(normalizeLane('middle')).toBe('mid')
  })

  it('maps "mid" to "mid"', () => {
    expect(normalizeLane('mid')).toBe('mid')
  })

  it('maps "bottom" to "bottom"', () => {
    expect(normalizeLane('bottom')).toBe('bottom')
  })

  it('maps "adc" to "bottom"', () => {
    expect(normalizeLane('adc')).toBe('bottom')
  })

  it('maps "support" to "support"', () => {
    expect(normalizeLane('support')).toBe('support')
  })

  it('maps "utility" to "support"', () => {
    expect(normalizeLane('utility')).toBe('support')
  })

  it('is case-insensitive', () => {
    expect(normalizeLane('TOP')).toBe('top')
    expect(normalizeLane('Middle')).toBe('mid')
    expect(normalizeLane('JUNGLE')).toBe('jungle')
    expect(normalizeLane('ADC')).toBe('bottom')
    expect(normalizeLane('Utility')).toBe('support')
  })

  it('passes through unknown lanes lowercased', () => {
    expect(normalizeLane('roam')).toBe('roam')
    expect(normalizeLane('FILL')).toBe('fill')
  })
})

describe('FLEX_THRESHOLD', () => {
  it('is 5', () => {
    expect(FLEX_THRESHOLD).toBe(5)
  })
})
