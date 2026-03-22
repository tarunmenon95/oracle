import { getMainWindow } from './index'
import { getCurrentPatch, getChampionInternalId } from './data/ddragon'
import { computeRecommendations, filterEnemiesByLane, inferTeamPositions, laneToLcuPosition } from './data/recommender'
import { prefetchBuilds } from './scraper/opgg-build'

const DDRAGON = 'https://ddragon.leagueoflegends.com/cdn'

function icon(name: string): string {
  const patch = getCurrentPatch()
  const id = getChampionInternalId(name)
  return `${DDRAGON}/${patch}/img/champion/${id}.png`
}

interface MockScenario {
  label: string
  assignedPosition: string
  myTeam: any[]
  theirTeam: any[]
  myBans: number[]
  theirBans: number[]
  localPlayerCellId: number
}

const SCENARIOS: MockScenario[] = [
  {
    label: 'Mid — Zed mid + Lee Sin flex',
    assignedPosition: 'middle',
    localPlayerCellId: 2,
    myTeam: [
      { cellId: 0, championId: 86, championName: 'Garen', summonerId: 1, assignedPosition: 'top', championInternalId: 'Garen' },
      { cellId: 1, championId: 120, championName: 'Hecarim', summonerId: 2, assignedPosition: 'jungle', championInternalId: 'Hecarim' },
      { cellId: 2, championId: 0, championName: '', summonerId: 3, assignedPosition: 'middle', championInternalId: '' },
      { cellId: 3, championId: 51, championName: 'Caitlyn', summonerId: 4, assignedPosition: 'bottom', championInternalId: 'Caitlyn' },
      { cellId: 4, championId: 412, championName: 'Thresh', summonerId: 5, assignedPosition: 'utility', championInternalId: 'Thresh' }
    ],
    theirTeam: [
      { cellId: 5, championId: 39, championName: 'Irelia', summonerId: 6, assignedPosition: 'top', championInternalId: 'Irelia' },
      { cellId: 6, championId: 64, championName: 'Lee Sin', summonerId: 7, assignedPosition: 'jungle', championInternalId: 'LeeSin' },
      { cellId: 7, championId: 238, championName: 'Zed', summonerId: 8, assignedPosition: 'middle', championInternalId: 'Zed' },
      { cellId: 8, championId: 67, championName: 'Vayne', summonerId: 9, assignedPosition: 'bottom', championInternalId: 'Vayne' },
      { cellId: 9, championId: 0, championName: '', summonerId: 10, assignedPosition: 'utility', championInternalId: '' }
    ],
    myBans: [157, 777, 234, 55, 523],
    theirBans: [245, 131, 7, 84, 91]
  },
  {
    label: 'Mid — Ahri mid + Sylas jng flex',
    assignedPosition: 'middle',
    localPlayerCellId: 2,
    myTeam: [
      { cellId: 0, championId: 122, championName: 'Darius', summonerId: 1, assignedPosition: 'top', championInternalId: 'Darius' },
      { cellId: 1, championId: 254, championName: 'Vi', summonerId: 2, assignedPosition: 'jungle', championInternalId: 'Vi' },
      { cellId: 2, championId: 0, championName: '', summonerId: 3, assignedPosition: 'middle', championInternalId: '' },
      { cellId: 3, championId: 222, championName: 'Jinx', summonerId: 4, assignedPosition: 'bottom', championInternalId: 'Jinx' },
      { cellId: 4, championId: 117, championName: 'Lulu', summonerId: 5, assignedPosition: 'utility', championInternalId: 'Lulu' }
    ],
    theirTeam: [
      { cellId: 5, championId: 516, championName: 'Ornn', summonerId: 6, assignedPosition: 'top', championInternalId: 'Ornn' },
      { cellId: 6, championId: 517, championName: 'Sylas', summonerId: 7, assignedPosition: 'jungle', championInternalId: 'Sylas' },
      { cellId: 7, championId: 103, championName: 'Ahri', summonerId: 8, assignedPosition: 'middle', championInternalId: 'Ahri' },
      { cellId: 8, championId: 15, championName: 'Sivir', summonerId: 9, assignedPosition: 'bottom', championInternalId: 'Sivir' },
      { cellId: 9, championId: 497, championName: 'Rakan', summonerId: 10, assignedPosition: 'utility', championInternalId: 'Rakan' }
    ],
    myBans: [238, 55, 84, 39, 523],
    theirBans: [245, 131, 7, 157, 91]
  },
  {
    label: 'Top — Yone top + Irelia flex',
    assignedPosition: 'top',
    localPlayerCellId: 0,
    myTeam: [
      { cellId: 0, championId: 0, championName: '', summonerId: 1, assignedPosition: 'top', championInternalId: '' },
      { cellId: 1, championId: 121, championName: "Kha'Zix", summonerId: 2, assignedPosition: 'jungle', championInternalId: 'Khazix' },
      { cellId: 2, championId: 4, championName: 'Twisted Fate', summonerId: 3, assignedPosition: 'middle', championInternalId: 'TwistedFate' },
      { cellId: 3, championId: 236, championName: 'Lucian', summonerId: 4, assignedPosition: 'bottom', championInternalId: 'Lucian' },
      { cellId: 4, championId: 267, championName: 'Nami', summonerId: 5, assignedPosition: 'utility', championInternalId: 'Nami' }
    ],
    theirTeam: [
      { cellId: 5, championId: 164, championName: 'Camille', summonerId: 6, assignedPosition: 'top', championInternalId: 'Camille' },
      { cellId: 6, championId: 28, championName: 'Evelynn', summonerId: 7, assignedPosition: 'jungle', championInternalId: 'Evelynn' },
      { cellId: 7, championId: 39, championName: 'Irelia', summonerId: 8, assignedPosition: 'middle', championInternalId: 'Irelia' },
      { cellId: 8, championId: 81, championName: 'Ezreal', summonerId: 9, assignedPosition: 'bottom', championInternalId: 'Ezreal' },
      { cellId: 9, championId: 12, championName: 'Alistar', summonerId: 10, assignedPosition: 'utility', championInternalId: 'Alistar' }
    ],
    myBans: [92, 777, 234, 523, 157],
    theirBans: [86, 24, 420, 240, 58]
  },
  {
    label: 'Mid — Diana locked in vs Zed + Lee Sin',
    assignedPosition: 'middle',
    localPlayerCellId: 2,
    myTeam: [
      { cellId: 0, championId: 86, championName: 'Garen', summonerId: 1, assignedPosition: 'top', championInternalId: 'Garen' },
      { cellId: 1, championId: 120, championName: 'Hecarim', summonerId: 2, assignedPosition: 'jungle', championInternalId: 'Hecarim' },
      { cellId: 2, championId: 131, championName: 'Diana', summonerId: 3, assignedPosition: 'middle', championInternalId: 'Diana' },
      { cellId: 3, championId: 51, championName: 'Caitlyn', summonerId: 4, assignedPosition: 'bottom', championInternalId: 'Caitlyn' },
      { cellId: 4, championId: 412, championName: 'Thresh', summonerId: 5, assignedPosition: 'utility', championInternalId: 'Thresh' }
    ],
    theirTeam: [
      { cellId: 5, championId: 39, championName: 'Irelia', summonerId: 6, assignedPosition: 'top', championInternalId: 'Irelia' },
      { cellId: 6, championId: 64, championName: 'Lee Sin', summonerId: 7, assignedPosition: 'jungle', championInternalId: 'LeeSin' },
      { cellId: 7, championId: 238, championName: 'Zed', summonerId: 8, assignedPosition: 'middle', championInternalId: 'Zed' },
      { cellId: 8, championId: 67, championName: 'Vayne', summonerId: 9, assignedPosition: 'bottom', championInternalId: 'Vayne' },
      { cellId: 9, championId: 0, championName: '', summonerId: 10, assignedPosition: 'utility', championInternalId: '' }
    ],
    myBans: [157, 777, 234, 55, 523],
    theirBans: [245, 131, 7, 84, 91]
  },
  {
    label: 'ADC — Draven bot + Tristana flex',
    assignedPosition: 'bottom',
    localPlayerCellId: 3,
    myTeam: [
      { cellId: 0, championId: 58, championName: 'Renekton', summonerId: 1, assignedPosition: 'top', championInternalId: 'Renekton' },
      { cellId: 1, championId: 76, championName: 'Nidalee', summonerId: 2, assignedPosition: 'jungle', championInternalId: 'Nidalee' },
      { cellId: 2, championId: 61, championName: 'Orianna', summonerId: 3, assignedPosition: 'middle', championInternalId: 'Orianna' },
      { cellId: 3, championId: 0, championName: '', summonerId: 4, assignedPosition: 'bottom', championInternalId: '' },
      { cellId: 4, championId: 350, championName: 'Yuumi', summonerId: 5, assignedPosition: 'utility', championInternalId: 'Yuumi' }
    ],
    theirTeam: [
      { cellId: 5, championId: 54, championName: 'Malphite', summonerId: 6, assignedPosition: 'top', championInternalId: 'Malphite' },
      { cellId: 6, championId: 32, championName: 'Amumu', summonerId: 7, assignedPosition: 'jungle', championInternalId: 'Amumu' },
      { cellId: 7, championId: 18, championName: 'Tristana', summonerId: 8, assignedPosition: 'middle', championInternalId: 'Tristana' },
      { cellId: 8, championId: 119, championName: 'Draven', summonerId: 9, assignedPosition: 'bottom', championInternalId: 'Draven' },
      { cellId: 9, championId: 89, championName: 'Leona', summonerId: 10, assignedPosition: 'utility', championInternalId: 'Leona' }
    ],
    myBans: [412, 111, 555, 497, 53],
    theirBans: [222, 51, 236, 145, 67]
  }
]

let scenarioIndex = 0

export function sendMockDraft(): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return

  const scenario = SCENARIOS[scenarioIndex % SCENARIOS.length]
  scenarioIndex++

  console.log(`Mock draft: ${scenario.label} (scenario ${scenarioIndex}/${SCENARIOS.length})`)

  win.webContents.send('connection:status', 'in-champ-select')

  const theirTeam = scenario.theirTeam.map((m: any) => ({ ...m }))
  const enemyPosMap = inferTeamPositions(theirTeam)
  for (const m of theirTeam) {
    const inferred = enemyPosMap.get(m.championName)
    if (inferred) m.assignedPosition = laneToLcuPosition(inferred)
  }

  win.webContents.send('draft:update', {
    phase: 'BAN_PICK',
    myTeam: scenario.myTeam,
    theirTeam,
    myBans: scenario.myBans,
    theirBans: scenario.theirBans,
    localPlayerCellId: scenario.localPlayerCellId,
    assignedPosition: scenario.assignedPosition
  })

  const lane = scenario.assignedPosition
  const enemyPicks = filterEnemiesByLane(theirTeam, lane)
  const pickedNames = new Set<string>()
  for (const m of [...scenario.myTeam, ...theirTeam]) {
    if (m.cellId === scenario.localPlayerCellId) continue
    if (m.championId > 0 && m.championName) pickedNames.add(m.championName)
  }
  const recs = computeRecommendations(lane, enemyPicks, pickedNames)

  win.webContents.send('recommendations:update', recs)

  const topRecs = recs.slice(0, 3)
  const matchups = topRecs.flatMap((r) =>
    r.matchups.map((m) => ({ champion: r.championName, opponent: m.enemyChampionName, lane }))
  )
  if (matchups.length > 0) prefetchBuilds(matchups)
}

export function startDevMock(): void {
  setTimeout(() => {
    sendMockDraft()
  }, 1500)
}
