import { create } from 'zustand'

export interface GlobalData {
  currentStage?: number | string
  stageLocked?: boolean[]
  seriesLocked?: Record<string, boolean>
  teams?: Record<string, Record<string, { home: string; away: string }>>
  results?: Record<string, Record<string, string> | null>
  bonusBets?: Record<string, BonusBet[]>
  bonusResults?: Record<string, Record<string, string>>
  autoLocks?: Record<string, number>
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
