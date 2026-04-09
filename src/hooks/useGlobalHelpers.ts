import { useGlobalStore } from '@/store/global.store'
import { useAuthStore } from '@/store/auth.store'
import { STAGE_KEYS, STAGE_MATCHES, SUPER_ADMIN_UID } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'
import { getBonusStageKey } from '@/services/global.service'
import type { BonusBet } from '@/store/global.store'

export function useGlobalHelpers() {
  const globalData = useGlobalStore((s) => s.globalData)
  const getGlobal = useGlobalStore((s) => s.getGlobal)
  const currentUser = useAuthStore((s) => s.currentUser)

  function isSuperAdmin() {
    return currentUser?.uid === SUPER_ADMIN_UID
  }

  function hasStageResults(si: StageKey) {
    const r = getGlobal('results', {} as Record<string, Record<string, string> | null>)
    const stageR = r['stage' + si]
    if (!stageR) return false
    return Object.values(stageR).some((v) => v && v !== '')
  }

  function canBetOnStage(si: StageKey) {
    if (si === 0) return true
    if (si === '0b') return hasStageResults(0)
    if (si === 1) return hasStageResults('0b')
    const prev: Record<number, StageKey> = { 2: 1, 3: 2, 4: 3 }
    if (typeof si === 'number' && prev[si] !== undefined) return hasStageResults(prev[si])
    return true
  }

  function isSeriesLocked(si: StageKey, mk: string) {
    if (getGlobal('seriesLocked', {} as Record<string, boolean>)[si + '_' + mk]) return true
    const stageIdx = STAGE_KEYS.indexOf(si)
    if (stageIdx >= 0 && (getGlobal('stageLocked', [] as boolean[]))[stageIdx]) return true
    return false
  }

  function isBonusLocked(si: StageKey) {
    const lockIdx = si === 0 || si === '0b' ? 0 : STAGE_KEYS.indexOf(si)
    return (getGlobal('stageLocked', [] as boolean[]))[lockIdx] || false
  }

  function isSingleBonusLocked(si: StageKey, bonus: BonusBet) {
    if (bonus.seriesKey) return isSeriesLocked(si, bonus.seriesKey)
    return isBonusLocked(si)
  }

  function isPreBetsLocked() {
    const sl = getGlobal('seriesLocked', {} as Record<string, boolean>)
    return Object.keys(sl).some((k) => k.startsWith('1_') && sl[k])
  }

  function getSeriesWinner(si: StageKey, mk: string) {
    const r = getGlobal('results', {} as Record<string, Record<string, string> | null>)
    return (r['stage' + si] || {})?.[mk + '_winner'] || ''
  }

  function getAutoTeams(si: StageKey, mk: string): { home: string; away: string } | null {
    if (si === 2) {
      const map: Record<string, { home: string; away: string }> = {
        e1: { home: 'e1', away: 'e4' }, e2: { home: 'e2', away: 'e3' },
        w1: { home: 'w1', away: 'w4' }, w2: { home: 'w2', away: 'w3' },
      }
      if (map[mk]) {
        const home = getSeriesWinner(1, map[mk].home)
        const away = getSeriesWinner(1, map[mk].away)
        if (home || away) return { home, away }
      }
    }
    if (si === 3) {
      const map: Record<string, { home: string; away: string }> = {
        east: { home: 'e1', away: 'e2' }, west: { home: 'w1', away: 'w2' },
      }
      if (map[mk]) {
        const home = getSeriesWinner(2, map[mk].home)
        const away = getSeriesWinner(2, map[mk].away)
        if (home || away) return { home, away }
      }
    }
    if (si === 4 && mk === 'finals') {
      const home = getSeriesWinner(3, 'east')
      const away = getSeriesWinner(3, 'west')
      if (home || away) return { home, away }
    }
    return null
  }

  function getTeams(si: StageKey, mk: string): { home: string; away: string } {
    const auto = getAutoTeams(si, mk)
    if (auto && (auto.home || auto.away)) return auto
    const gt = getGlobal('teams', {} as Record<string, Record<string, { home: string; away: string }>>)
    const fromGlobal = (gt['stage' + si] || {})[mk]
    if (fromGlobal && (fromGlobal.home || fromGlobal.away)) return fromGlobal
    return { home: '', away: '' }
  }

  function teamLabel(si: StageKey, mk: string, fallback: string) {
    const t = getTeams(si, mk)
    return t.home && t.away ? `${t.home} מול ${t.away}` : fallback
  }

  function getPlayinFinalTeams(conf: string) {
    const r0 = (getGlobal('results', {} as Record<string, Record<string, string> | null>))['stage0'] || {}
    const t0 = (getGlobal('teams', {} as Record<string, Record<string, { home: string; away: string }>>))['stage0'] || {}
    const k78 = conf === 'east' ? 'e78' : 'w78'
    const k910 = conf === 'east' ? 'e910' : 'w910'
    const match78 = t0[k78] || { home: '', away: '' }
    const winner78 = ((r0 as Record<string, string>)[k78] || '').toLowerCase().trim()
    let loser78 = ''
    if (winner78 && match78.home && match78.away) {
      loser78 = winner78 === match78.home.toLowerCase().trim() ? match78.away : match78.home
    }
    const winner910 = (r0 as Record<string, string>)[k910] || ''
    return { home: loser78 || 'מפסידת #7מול8', away: winner910 || 'מנצחת #9מול10' }
  }

  function getBonusBets(si: StageKey): BonusBet[] {
    return (getGlobal('bonusBets', {} as Record<string, BonusBet[]>))[getBonusStageKey(si)] || []
  }

  function getBonusResults(si: StageKey): Record<string, string> {
    return (getGlobal('bonusResults', {} as Record<string, Record<string, string>>))[getBonusStageKey(si)] || {}
  }

  return {
    globalData,
    getGlobal,
    isSuperAdmin,
    hasStageResults,
    canBetOnStage,
    isSeriesLocked,
    isBonusLocked,
    isSingleBonusLocked,
    isPreBetsLocked,
    getTeams,
    teamLabel,
    getPlayinFinalTeams,
    getBonusBets,
    getBonusResults,
    getSeriesWinner,
  }
}
