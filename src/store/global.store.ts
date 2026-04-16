import { create } from 'zustand'
import type { BracketSeriesMap, BracketMvpPick } from '@/bracket/bracketConstants'

export interface GlobalData {
  currentStage?: number | string
  stageLocked?: boolean[]
  seriesLocked?: Record<string, boolean>
  teams?: Record<string, Record<string, { home: string; away: string }>>
  results?: Record<string, Record<string, string> | null>
  bonusBets?: Record<string, BonusBet[]>
  bonusResults?: Record<string, Record<string, string>>
  autoLocks?: Record<string, number>
  tiebreakerQuestion?: string
  tiebreakerAnswer?: number | null
  tiebreakerLocked?: boolean
  bracketSeries?: BracketSeriesMap
  /** Actual MVP for each eligible bracket series — set by admin */
  bracketActualMvp?: BracketMvpPick
  /** Bracket format lock (manual) */
  bracketLocked?: boolean
  /** Bracket format scheduled auto-lock (Unix ms timestamp) */
  bracketAutoLock?: number
  /** Bracket tiebreaker */
  bracketTiebreakerQuestion?: string
  bracketTiebreakerAnswer?: number | null
  bracketTiebreakerLocked?: boolean
  [key: string]: unknown
}

export interface BonusBet {
  id: string
  question: string
  points: number
  answers: string[]
  seriesKey?: string
}

interface GlobalState {
  globalData: GlobalData
  setGlobalData: (data: GlobalData) => void
  getGlobal: <T>(key: string, fallback: T) => T
}

export const useGlobalStore = create<GlobalState>((set, get) => ({
  globalData: {},
  setGlobalData: (data) => set({ globalData: data }),
  getGlobal: <T>(key: string, fallback: T): T => {
    const val = get().globalData[key]
    return val !== undefined ? (val as T) : fallback
  },
}))
