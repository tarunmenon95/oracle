import { getDb, getChampionPool } from '../data/db'
import { initDdragon, getCurrentPatch } from '../data/ddragon'
import { getSettings } from '../data/settings'
import { scrapeChampionMatchups as scrapeOpgg, scrapeChampionRoles } from './opgg'
import { scrapeChampionMatchups as scrapeUgg } from './ugg'
import { getMainWindow } from '../index'

const SCRAPE_DELAY_MS = 1500
const DAILY_MS = 24 * 60 * 60 * 1000

let isRunning = false
let lastRefresh: number | null = null
let refreshTimer: ReturnType<typeof setTimeout> | null = null

export function getScraperStatus(): { lastRefresh: number | null; isRunning: boolean } {
  return { lastRefresh, isRunning }
}

export async function refreshAllMatchups(): Promise<void> {
  if (isRunning) return
  isRunning = true

  try {
    await initDdragon()

    const settings = getSettings()
    const patch = settings.selectedPatch || getCurrentPatch().split('.').slice(0, 2).join('.')

    const pool = getChampionPool()

    if (pool.length === 0) {
      console.log('No champions in pool — skipping scrape')
      isRunning = false
      return
    }

    const champLanePairs: { champion: string; lane: string }[] = []
    for (const entry of pool) {
      for (const lane of entry.lanes.split(',')) {
        champLanePairs.push({ champion: entry.champion, lane })
      }
    }

    const total = champLanePairs.length
    let current = 0

    for (const { champion, lane } of champLanePairs) {
      current++
      sendProgress(current, total, champion)

      const results = await Promise.allSettled([
        scrapeOpgg(champion, lane, patch),
        scrapeUgg(champion, lane, patch)
      ])

      for (const r of results) {
        if (r.status === 'rejected') {
          console.error(`Scrape failed for ${champion} ${lane}:`, r.reason)
        }
      }

      await sleep(SCRAPE_DELAY_MS)
    }

    // Scrape role distributions for opponents we don't have role data for yet
    const db = getDb()
    const opponents = db.prepare(
      'SELECT DISTINCT opponent FROM matchups WHERE opponent NOT IN (SELECT DISTINCT champion FROM champion_roles)'
    ).all() as { opponent: string }[]

    if (opponents.length > 0) {
      console.log(`Scraping role data for ${opponents.length} opponents...`)
      let completed = 0
      const CONCURRENCY = 5

      for (let i = 0; i < opponents.length; i += CONCURRENCY) {
        const batch = opponents.slice(i, i + CONCURRENCY)
        sendProgress(completed, opponents.length, `roles (${batch.map((o) => o.opponent).join(', ')})`)

        const results = await Promise.allSettled(
          batch.map((o) => scrapeChampionRoles(o.opponent, patch))
        )
        for (let j = 0; j < results.length; j++) {
          if (results[j].status === 'rejected') {
            console.warn(`Role scrape failed for ${batch[j].opponent}:`, (results[j] as PromiseRejectedResult).reason)
          }
        }

        completed += batch.length
        sendProgress(completed, opponents.length, `roles`)
        if (i + CONCURRENCY < opponents.length) await sleep(1000)
      }

    }

    lastRefresh = Date.now()
  } catch (err) {
    console.error('Scraper error:', err)
  } finally {
    isRunning = false
    sendProgress(0, 0, '')
  }
}

export function startScheduler(): void {
  if (refreshTimer) return

  const checkAndRefresh = async () => {
    const db = getDb()
    const row = db.prepare('SELECT MAX(updated_at) as latest FROM matchups').get() as { latest: number | null } | undefined
    const latestUpdate = row?.latest ? row.latest * 1000 : 0

    if (Date.now() - latestUpdate > DAILY_MS) {
      await refreshAllMatchups()
    }

    refreshTimer = setTimeout(checkAndRefresh, 60 * 60 * 1000)
  }

  setTimeout(checkAndRefresh, 5000)
}

function sendProgress(current: number, total: number, champion: string): void {
  const win = getMainWindow()
  if (win && !win.isDestroyed()) {
    win.webContents.send('scraper:progress', { current, total, champion })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
