export interface LcuChampSelectSession {
  myTeam: LcuTeamMember[]
  theirTeam: LcuTeamMember[]
  bans: {
    myTeamBans: number[]
    theirTeamBans: number[]
    numBans: number
  }
  actions: LcuAction[][]
  localPlayerCellId: number
  timer: LcuTimer
}

export interface LcuTeamMember {
  cellId: number
  championId: number
  championPickIntent: number
  summonerId: number
  spell1Id: number
  spell2Id: number
  assignedPosition: string
  team: number
}

export interface LcuAction {
  actorCellId: number
  championId: number
  completed: boolean
  id: number
  pickTurn: number
  type: 'ban' | 'pick'
  isInProgress: boolean
}

export interface LcuTimer {
  phase: string
  timeLeftInPhase: number
  adjustedTimeLeftInPhaseInSec: number
  isInfinite: boolean
}

export interface ParsedDraftState {
  phase: string
  myTeam: ParsedTeamMember[]
  theirTeam: ParsedTeamMember[]
  myBans: number[]
  theirBans: number[]
  localPlayerCellId: number
  assignedPosition: string
}

export interface ParsedTeamMember {
  cellId: number
  championId: number
  championName: string
  summonerId: number
  assignedPosition: string
}
