import { create } from 'zustand'
import type { BracketPick, BracketMvpPick } from './bracketConstants'

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
  mvpBets?: Record<string, BracketMvpPick>
  isGlobal?: boolean
  createdAt?: unknown
}

export interface BracketLeagueMeta {
  id: string
  name: string
  members: string[]
}

interface BracketLeagueState {
  currentBracketLeagueId: string | null
  currentBracketLeagueData: BracketLeagueData | null
  /** Always the bl_global league — bets and mvpBets live here */
  globalBracketLeagueData: BracketLeagueData | null
  /** Lightweight meta for the league selector (id, name, members) */
  myBracketLeaguesMeta: BracketLeagueMeta[] | null

  setBracketLeague: (id: string | null) => void
  setBracketLeagueData: (data: BracketLeagueData | null) => void
  setGlobalBracketLeagueData: (data: BracketLeagueData | null) => void
  setMyBracketLeaguesMeta: (meta: BracketLeagueMeta[] | null) => void
}

export const useBracketLeagueStore = create<BracketLeagueState>((set) => ({
  currentBracketLeagueId: null,
  currentBracketLeagueData: null,
  globalBracketLeagueData: null,
  myBracketLeaguesMeta: null,

  setBracketLeague: (id) => set({ currentBracketLeagueId: id }),
  setBracketLeagueData: (data) => set({ currentBracketLeagueData: data }),
  setGlobalBracketLeagueData: (data) => set({ globalBracketLeagueData: data }),
  setMyBracketLeaguesMeta: (meta) => set({ myBracketLeaguesMeta: meta }),
}))
