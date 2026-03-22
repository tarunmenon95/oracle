import { ipcMain } from 'electron'
import { getDb, getChampionRoles } from './data/db'
import { getAllChampions, getCurrentPatch, getChampionIdByName } from './data/ddragon'
import { getSettings, saveSettings, getAvailablePatches } from './data/settings'
import { lcuManager } from './lcu/connector'
import { refreshAllMatchups, getScraperStatus } from './scraper/scheduler'
import { syncChampionPool } from './scraper/opgg'
import { scrapeMatchupBuild } from './scraper/opgg-build'
import { computeRecommendations } from './data/recommender'
import { sendMockDraft } from './dev-mock'
import { devMockEnabled } from './index'

const VALID_LANES = new Set(['top', 'jungle', 'mid', 'bottom', 'support'])

export function registerIpcHandlers(): void {
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:save', (_, settings) => {
    if (!settings || typeof settings !== 'object') return
    if (typeof settings.summonerName !== 'string') return
    if (typeof settings.region !== 'string') return
    saveSettings(settings)
  })

  ipcMain.handle('pool:get', () => {
    const db = getDb()
    return db.prepare('SELECT champion, lanes, mastery_points as masteryPoints, games_played as gamesPlayed, win_rate as winRate, kda FROM champion_pool').all()
  })

  ipcMain.handle('pool:add', (_, champion: string, lane: string) => {
    if (!champion || typeof champion !== 'string') return
    if (!VALID_LANES.has(lane)) return
    if (!getChampionIdByName(champion)) return

    const db = getDb()
    const existing = db.prepare('SELECT lanes FROM champion_pool WHERE summoner_id = ? AND champion = ?').get('local', champion) as { lanes: string } | undefined
    if (existing) {
      const currentLanes = existing.lanes.split(',')
      if (!currentLanes.includes(lane)) {
        const updated = [...currentLanes, lane].join(',')
        db.prepare('UPDATE champion_pool SET lanes = ? WHERE summoner_id = ? AND champion = ?').run(updated, 'local', champion)
      }
    } else {
      db.prepare('INSERT INTO champion_pool (summoner_id, champion, lanes, mastery_points, games_played) VALUES (?, ?, ?, 0, 0)')
        .run('local', champion, lane)
    }
  })

  ipcMain.handle('pool:remove', (_, champion: string) => {
    if (!champion || typeof champion !== 'string') return
    const db = getDb()
    db.prepare('DELETE FROM champion_pool WHERE summoner_id = ? AND champion = ?').run('local', champion)
  })

  ipcMain.handle('pool:sync', async () => {
    const settings = getSettings()
    if (settings.summonerName && settings.region) {
      await syncChampionPool(settings.summonerName, settings.tagline, settings.region)
    }
  })

  ipcMain.handle('champions:getAll', () => getAllChampions())

  ipcMain.handle('champions:roles', () => {
    const db = getDb()
    const rows = db.prepare('SELECT champion, lane, pick_rate as pickRate FROM champion_roles ORDER BY champion, pick_rate DESC').all() as { champion: string; lane: string; pickRate: number }[]
    const map: Record<string, { lane: string; pickRate: number }[]> = {}
    for (const row of rows) {
      if (!map[row.champion]) map[row.champion] = []
      map[row.champion].push({ lane: row.lane, pickRate: row.pickRate })
    }
    return map
  })
  ipcMain.handle('patch:get', () => getCurrentPatch())
  ipcMain.handle('patches:list', () => getAvailablePatches())

  ipcMain.handle('scraper:refresh', () => refreshAllMatchups())
  ipcMain.handle('scraper:status', () => getScraperStatus())

  ipcMain.handle('build:get', async (_, champion: string, opponent: string, lane: string) => {
    if (!champion || !opponent || !lane) return { runes: null, items: [] }
    return scrapeMatchupBuild(champion, opponent, lane)
  })

  ipcMain.handle('recommendations:recompute', (_, lane: string, enemies: { championId: number; championName: string }[], pickedNames: string[]) => {
    if (!lane || !Array.isArray(enemies) || enemies.length === 0) return []
    const picked = new Set(pickedNames ?? [])
    return computeRecommendations(lane, enemies, picked)
  })

  ipcMain.handle('lcu:connect', () => {
    if (devMockEnabled) return
    return lcuManager.connect()
  })
  ipcMain.handle('lcu:disconnect', () => lcuManager.disconnect())

  ipcMain.handle('dev:mockDraft', () => {
    if (devMockEnabled) sendMockDraft()
  })
}
