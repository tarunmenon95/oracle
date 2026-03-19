import type { Recommendation } from '../../../preload/index'

export function wrColor(wr: number): string {
  if (wr >= 54) return '#2ecc71'
  if (wr >= 52) return '#7dcea0'
  if (wr >= 48) return 'var(--text-primary)'
  if (wr >= 46) return '#e59866'
  return '#e74c3c'
}

export function goldColor(gold: number): string {
  if (gold >= 200) return '#f1c40f'
  if (gold >= 50) return '#7dcea0'
  if (gold >= -50) return 'var(--text-secondary)'
  if (gold >= -200) return '#e59866'
  return '#e74c3c'
}

export function lkrColor(lkr: number): string {
  if (lkr >= 52) return '#2ecc71'
  if (lkr >= 50) return '#7dcea0'
  if (lkr >= 48) return 'var(--text-secondary)'
  if (lkr >= 46) return '#e59866'
  return '#e74c3c'
}

export function confidenceColor(c: 'high' | 'medium' | 'low'): string {
  return { high: 'var(--accent-green)', medium: 'var(--accent-gold)', low: 'var(--accent-red)' }[c]
}

export function getConfidence(rec: Recommendation): 'high' | 'medium' | 'low' {
  const totalGames = rec.matchups.reduce((sum, m) => sum + m.gamesPlayed, 0)
  const avgGames = totalGames / Math.max(rec.matchups.length, 1)
  if (avgGames >= 800) return 'high'
  if (avgGames >= 200) return 'medium'
  return 'low'
}

export function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}
