import { create } from 'zustand'

export interface MemberInfo {
  username: string
  displayName: string
}

export interface LeagueData {
  id: string
  name: string
  code: string
  adminUid: string
  members: string[]
  memberInfo: Record<string, MemberInfo>
  currentStage?: number | string
  stageLocked?: boolean[]
  teams?: Record<string, unknown>
  results?: Record<string, unknown>
  bonusBets?: Record<string, unknown>
  bonusResults?: Record<string, unknown>
  bets?: Record<string, Record<string, unknown>>
  createdAt?: unknown
}

interface LeagueState {
  currentLeagueId: string | null
  currentLeagueData: LeagueData | null
  setLeague: (id: string | null) => void
  setLeagueData: (data: LeagueData | null) => void
}

export const useLeagueStore = create<LeagueState>((set) => ({
  currentLeagueId: null,
  currentLeagueData: null,
  setLeague: (id) => set({ currentLeagueId: id }),
  setLeagueData: (data) => set({ currentLeagueData: data }),
}))
