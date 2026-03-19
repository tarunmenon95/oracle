const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn'
const CDRAGON_POSITIONS = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-clash/global/default/assets/images/position-selector/positions'

const LANE_TO_POSITION: Record<string, string> = {
  top: 'top',
  jungle: 'jungle',
  mid: 'middle',
  middle: 'middle',
  bottom: 'bottom',
  adc: 'bottom',
  support: 'utility',
  utility: 'utility'
}

export function laneIcon(lane: string): string {
  const pos = LANE_TO_POSITION[lane.toLowerCase()] || lane.toLowerCase()
  return `${CDRAGON_POSITIONS}/icon-position-${pos}.png`
}

let cachedPatch = '15.6.1'

export async function loadPatch(): Promise<string> {
  try {
    cachedPatch = await window.api.getPatch()
  } catch { /* keep fallback */ }
  return cachedPatch
}

export function getPatch(): string {
  return cachedPatch
}

export function championIcon(internalId: string): string {
  if (!internalId) return ''
  return `${DDRAGON}/${cachedPatch}/img/champion/${internalId}.png`
}

export function championSplash(internalId: string, skin = 0): string {
  if (!internalId) return ''
  return `${DDRAGON}/img/champion/splash/${internalId}_${skin}.jpg`
}

export function championLoading(internalId: string, skin = 0): string {
  if (!internalId) return ''
  return `${DDRAGON}/img/champion/loading/${internalId}_${skin}.jpg`
}

const INTERNAL_ID_MAP: Record<string, string> = {
  "Dr. Mundo": "DrMundo",
  "Kai'Sa": "Kaisa",
  "Kha'Zix": "Khazix",
  "Cho'Gath": "Chogath",
  "Kog'Maw": "KogMaw",
  "Rek'Sai": "RekSai",
  "Vel'Koz": "VelKoz",
  "Bel'Veth": "Belveth",
  "K'Sante": "KSante",
  "Lee Sin": "LeeSin",
  "Master Yi": "MasterYi",
  "Miss Fortune": "MissFortune",
  "Tahm Kench": "TahmKench",
  "Twisted Fate": "TwistedFate",
  "Xin Zhao": "XinZhao",
  "Jarvan IV": "JarvanIV",
  "Aurelion Sol": "AurelionSol",
  "Renata Glasc": "Renata",
  "Nunu & Willump": "Nunu",
  "Wukong": "MonkeyKing"
}

export function nameToInternalId(name: string): string {
  if (!name || name === '?') return ''
  if (INTERNAL_ID_MAP[name]) return INTERNAL_ID_MAP[name]
  return name.replace(/[^a-zA-Z]/g, '')
}
