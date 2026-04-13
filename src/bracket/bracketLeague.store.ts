import { create } from 'zustand'
import type { BracketPick } from './bracketConstants'

export interface BracketMemberInfo {
  username: string
  displayName: string
}

export interface BracketLeagueData {
  id: string
  name: string
  code: string
  adminUid: string
  members: string[]
  memberInfo: Record<string, BracketMemberInfo>
  bets: Record<string, BracketPick>
  createdAt?: unknown
}

interface BracketLeagueState {
  currentBracketLeagueId: string | null
  currentBracketLeagueData: BracketLeagueData | null
  setBracketLeague: (id: string | null) => void
  setBracketLeagueData: (data: BracketLeagueData | null) => void
}

export const useBracketLeagueStore = create<BracketLeagueState>((set) => ({
  currentBracketLeagueId: null,
  currentBracketLeagueData: null,
  setBracketLeague: (id) => set({ currentBracketLeagueId: id }),
  setBracketLeagueData: (data) => set({ currentBracketLeagueData: data }),
}))
