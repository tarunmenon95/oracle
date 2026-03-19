import { contextBridge, ipcRenderer } from 'electron'

export type DraftState = {
  phase: string
  myTeam: TeamMember[]
  theirTeam: TeamMember[]
  myBans: number[]
  theirBans: number[]
  localPlayerCellId: number
  assignedPosition: string
}

export type TeamMember = {
  cellId: number
  championId: number
  championName: string
  championInternalId?: string
  summonerId: number
  assignedPosition: string
}

export type Recommendation = {
  championId: number
  championName: string
  championIcon: string
  championInternalId?: string
  score: number
  matchups: MatchupDetail[]
  personalWinRate: number | null
  personalGames: number
  personalKda: number | null
}

export type MatchupDetail = {
  enemyChampionId: number
  enemyChampionName: string
  enemyInternalId?: string
  winRate: number
  laneKillRate?: number | null
  goldAdv15?: number | null
  gamesPlayed: number
  source: string
}

export type ChampionPoolEntry = {
  champion: string
  lanes: string
  masteryPoints: number
  gamesPlayed: number
  winRate: number | null
  kda: number | null
}

export type AppSettings = {
  summonerName: string
  tagline: string
  region: string
  selectedPatch: string
  onboardingComplete: boolean
}

export type ConnectionStatus = 'disconnected' | 'connected' | 'in-champ-select'

const api = {
  isDev: process.env.NODE_ENV === 'development' || !!process.env['ELECTRON_RENDERER_URL'],
  platform: process.platform as 'darwin' | 'win32' | 'linux',


  onDraftUpdate: (callback: (state: DraftState) => void) => {
    const sub = (_: Electron.IpcRendererEvent, state: DraftState) => callback(state)
    ipcRenderer.on('draft:update', sub)
    return () => ipcRenderer.removeListener('draft:update', sub)
  },

  onRecommendations: (callback: (recs: Recommendation[]) => void) => {
    const sub = (_: Electron.IpcRendererEvent, recs: Recommendation[]) => callback(recs)
    ipcRenderer.on('recommendations:update', sub)
    return () => ipcRenderer.removeListener('recommendations:update', sub)
  },

  onConnectionStatus: (callback: (status: ConnectionStatus) => void) => {
    const sub = (_: Electron.IpcRendererEvent, status: ConnectionStatus) => callback(status)
    ipcRenderer.on('connection:status', sub)
    return () => ipcRenderer.removeListener('connection:status', sub)
  },

  onScraperProgress: (callback: (progress: { current: number; total: number; champion: string }) => void) => {
    const sub = (_: Electron.IpcRendererEvent, progress: { current: number; total: number; champion: string }) => callback(progress)
    ipcRenderer.on('scraper:progress', sub)
    return () => ipcRenderer.removeListener('scraper:progress', sub)
  },

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: AppSettings): Promise<void> => ipcRenderer.invoke('settings:save', settings),

  getChampionPool: (): Promise<ChampionPoolEntry[]> => ipcRenderer.invoke('pool:get'),
  addToPool: (champion: string, lane: string): Promise<void> => ipcRenderer.invoke('pool:add', champion, lane),
  removeFromPool: (champion: string): Promise<void> => ipcRenderer.invoke('pool:remove', champion),
  syncPoolFromOpgg: (): Promise<void> => ipcRenderer.invoke('pool:sync'),

  getAllChampions: (): Promise<{ id: number; name: string; icon: string }[]> => ipcRenderer.invoke('champions:getAll'),
  getChampionRolesMap: (): Promise<Record<string, { lane: string; pickRate: number }[]>> => ipcRenderer.invoke('champions:roles'),
  getPatch: (): Promise<string> => ipcRenderer.invoke('patch:get'),
  getAvailablePatches: (): Promise<string[]> => ipcRenderer.invoke('patches:list'),

  refreshMatchupData: (): Promise<void> => ipcRenderer.invoke('scraper:refresh'),
  getScraperStatus: (): Promise<{ lastRefresh: number | null; isRunning: boolean }> => ipcRenderer.invoke('scraper:status'),

  connectToLcu: (): Promise<void> => ipcRenderer.invoke('lcu:connect'),
  disconnectFromLcu: (): Promise<void> => ipcRenderer.invoke('lcu:disconnect'),

  triggerMockDraft: (): Promise<void> => ipcRenderer.invoke('dev:mockDraft')
}

contextBridge.exposeInMainWorld('api', api)

export type ElectronAPI = typeof api
