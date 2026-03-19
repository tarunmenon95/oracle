import { describe, it, expect } from 'vitest'
import { wrColor, goldColor, lkrColor, confidenceColor, getConfidence, formatNumber } from '../matchup-colors'

describe('wrColor', () => {
  it('returns green for wr >= 54', () => {
    expect(wrColor(54)).toBe('#2ecc71')
    expect(wrColor(60)).toBe('#2ecc71')
  })

  it('returns light green for wr >= 52 and < 54', () => {
    expect(wrColor(52)).toBe('#7dcea0')
    expect(wrColor(53.9)).toBe('#7dcea0')
  })

  it('returns neutral for wr >= 48 and < 52', () => {
    expect(wrColor(48)).toBe('var(--text-primary)')
    expect(wrColor(50)).toBe('var(--text-primary)')
    expect(wrColor(51.9)).toBe('var(--text-primary)')
  })

  it('returns orange for wr >= 46 and < 48', () => {
    expect(wrColor(46)).toBe('#e59866')
    expect(wrColor(47.9)).toBe('#e59866')
  })

  it('returns red for wr < 46', () => {
    expect(wrColor(45.9)).toBe('#e74c3c')
    expect(wrColor(30)).toBe('#e74c3c')
  })
})

describe('goldColor', () => {
  it('returns gold for >= 200', () => {
    expect(goldColor(200)).toBe('#f1c40f')
    expect(goldColor(500)).toBe('#f1c40f')
  })

  it('returns light green for >= 50 and < 200', () => {
    expect(goldColor(50)).toBe('#7dcea0')
    expect(goldColor(199)).toBe('#7dcea0')
  })

  it('returns neutral for >= -50 and < 50', () => {
    expect(goldColor(-50)).toBe('var(--text-secondary)')
    expect(goldColor(0)).toBe('var(--text-secondary)')
    expect(goldColor(49)).toBe('var(--text-secondary)')
  })

  it('returns orange for >= -200 and < -50', () => {
    expect(goldColor(-200)).toBe('#e59866')
    expect(goldColor(-51)).toBe('#e59866')
  })

  it('returns red for < -200', () => {
    expect(goldColor(-201)).toBe('#e74c3c')
    expect(goldColor(-500)).toBe('#e74c3c')
  })
})

describe('lkrColor', () => {
  it('returns green for lkr >= 52', () => {
    expect(lkrColor(52)).toBe('#2ecc71')
    expect(lkrColor(60)).toBe('#2ecc71')
  })

  it('returns light green for lkr >= 50 and < 52', () => {
    expect(lkrColor(50)).toBe('#7dcea0')
    expect(lkrColor(51.9)).toBe('#7dcea0')
  })

  it('returns neutral for lkr >= 48 and < 50', () => {
    expect(lkrColor(48)).toBe('var(--text-secondary)')
    expect(lkrColor(49.9)).toBe('var(--text-secondary)')
  })

  it('returns orange for lkr >= 46 and < 48', () => {
    expect(lkrColor(46)).toBe('#e59866')
    expect(lkrColor(47.9)).toBe('#e59866')
  })

  it('returns red for lkr < 46', () => {
    expect(lkrColor(45.9)).toBe('#e74c3c')
    expect(lkrColor(30)).toBe('#e74c3c')
  })
})

describe('confidenceColor', () => {
  it('returns correct CSS variable for high confidence', () => {
    expect(confidenceColor('high')).toBe('var(--accent-green)')
  })

  it('returns correct CSS variable for medium confidence', () => {
    expect(confidenceColor('medium')).toBe('var(--accent-gold)')
  })

  it('returns correct CSS variable for low confidence', () => {
    expect(confidenceColor('low')).toBe('var(--accent-red)')
  })
})

describe('getConfidence', () => {
  it('returns "high" when average games >= 800', () => {
    const rec = {
      championId: 1,
      championName: 'Aatrox',
      championIcon: '',
      score: 55,
      matchups: [
        { enemyChampionId: 2, enemyChampionName: 'Darius', winRate: 55, gamesPlayed: 1000, source: 'opgg' },
        { enemyChampionId: 3, enemyChampionName: 'Garen', winRate: 52, gamesPlayed: 600, source: 'opgg' }
      ]
    }
    expect(getConfidence(rec)).toBe('high')
  })

  it('returns "medium" when average games >= 200 and < 800', () => {
    const rec = {
      championId: 1,
      championName: 'Aatrox',
      championIcon: '',
      score: 55,
      matchups: [
        { enemyChampionId: 2, enemyChampionName: 'Darius', winRate: 55, gamesPlayed: 300, source: 'opgg' },
        { enemyChampionId: 3, enemyChampionName: 'Garen', winRate: 52, gamesPlayed: 200, source: 'opgg' }
      ]
    }
    expect(getConfidence(rec)).toBe('medium')
  })

  it('returns "low" when average games < 200', () => {
    const rec = {
      championId: 1,
      championName: 'Aatrox',
      championIcon: '',
      score: 55,
      matchups: [
        { enemyChampionId: 2, enemyChampionName: 'Darius', winRate: 55, gamesPlayed: 50, source: 'opgg' },
        { enemyChampionId: 3, enemyChampionName: 'Garen', winRate: 52, gamesPlayed: 100, source: 'opgg' }
      ]
    }
    expect(getConfidence(rec)).toBe('low')
  })

  it('handles empty matchups without dividing by zero', () => {
    const rec = {
      championId: 1,
      championName: 'Aatrox',
      championIcon: '',
      score: 50,
      matchups: []
    }
    expect(getConfidence(rec)).toBe('low')
  })
})

describe('formatNumber', () => {
  it('formats numbers >= 1000 with k suffix', () => {
    expect(formatNumber(1000)).toBe('1.0k')
    expect(formatNumber(1500)).toBe('1.5k')
    expect(formatNumber(10000)).toBe('10.0k')
  })

  it('returns plain string for numbers < 1000', () => {
    expect(formatNumber(999)).toBe('999')
    expect(formatNumber(0)).toBe('0')
    expect(formatNumber(500)).toBe('500')
  })
})
