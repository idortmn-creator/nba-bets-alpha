import { STAGE_MATCHES, STAGE_KEYS } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'
import type { GlobalData, BonusBet } from '@/store/global.store'
import type { LeagueData } from '@/store/league.store'
import { getBonusStageKey } from './global.service'

function getGlobal<T>(globalData: GlobalData, key: string, fallback: T): T {
  const val = globalData[key]
  return val !== undefined ? (val as T) : fallback
}

function getBonusBets(globalData: GlobalData, si: StageKey): BonusBet[] {
  return (getGlobal(globalData, 'bonusBets', {} as Record<string, BonusBet[]>))[getBonusStageKey(si)] || []
}

function getBonusResults(globalData: GlobalData, si: StageKey): Record<string, string> {
  return (getGlobal(globalData, 'bonusResults', {} as Record<string, Record<string, string>>))[getBonusStageKey(si)] || {}
}

export function scoreStage(
  uid: string,
  si: StageKey,
  leagueData: LeagueData,
  globalData: GlobalData
): number {
  const siKey = String(si)
  const bet = (leagueData.bets || {})[uid]?.['stage' + siKey] || {}
  const result = (getGlobal(globalData, 'results', {} as Record<string, Record<string, string> | null>))['stage' + siKey]
  let pts = 0
  if (result) {
    const matches = STAGE_MATCHES[si]
    if (si === 0) {
      for (const m of matches) {
        const b = (bet[m.key] || '').toLowerCase().trim()
        const r = (result[m.key] || '').toLowerCase().trim()
        if (b && r && b === r) pts++
      }
    } else if (si === '0b') {
      for (const m of matches) {
        const b = (bet[m.key] || '').toLowerCase().trim()
        const r = (result[m.key] || '').toLowerCase().trim()
        if (b && r && b === r) pts++
      }
      const bet0 = (leagueData.bets || {})[uid]?.['stage0'] || {}
      const result0 = (getGlobal(globalData, 'results', {} as Record<string, Record<string, string> | null>))['stage0'] || {}
      const allMatches = [...STAGE_MATCHES[0], ...STAGE_MATCHES['0b']]
      let eCAll = 0, wCAll = 0, totAll = 0
      for (const m of allMatches) {
        const bSrc = STAGE_MATCHES[0].find((x) => x.key === m.key) ? bet0 : bet
        const rSrc = STAGE_MATCHES[0].find((x) => x.key === m.key) ? result0 : result
        const b = (bSrc[m.key] || '').toLowerCase().trim()
        const r = ((rSrc as Record<string, string>)[m.key] || '').toLowerCase().trim()
        if (b && r && b === r) {
          totAll++
          if (m.conf === 'east') eCAll++
          else wCAll++
        }
      }
      if (eCAll === 3) pts += 1
      if (wCAll === 3) pts += 1
      if (totAll === 6) pts += 1
    } else if (si === 1) {
      const eK = ['e1', 'e2', 'e3', 'e4']
      let eW = 0, wW = 0, aW = 0, eX = 0, wX = 0, aX = 0
      for (const m of matches) {
        const bW = (bet[m.key + '_winner'] || '').toLowerCase().trim()
        const rW = (result[m.key + '_winner'] || '').toLowerCase().trim()
        const bR = bet[m.key + '_result'] || ''
        const rR = result[m.key + '_result'] || ''
        if (bW && rW && bW === rW) {
          if (bR && rR && bR === rR) { pts += 4; aX++; if (eK.includes(m.key)) eX++; else wX++ } else { pts += 2 }
          aW++; if (eK.includes(m.key)) eW++; else wW++
        }
      }
      if (aW === 8) { pts += (aX === 8 ? 14 : 7) }
      else { if (eW === 4) pts += (eX === 4 ? 6 : 3); if (wW === 4) pts += (wX === 4 ? 6 : 3) }
      const bc = (bet.champion || '').toLowerCase(), rc = (result.champion || '').toLowerCase()
      if (bc && rc && bc === rc) pts += 10
      const be = (bet.east_champ || '').toLowerCase(), re = (result.east_champ || '').toLowerCase()
      if (be && re && be === re) pts += 3
      const bw = (bet.west_champ || '').toLowerCase(), rw = (result.west_champ || '').toLowerCase()
      if (bw && rw && bw === rw) pts += 3
      const bF = [bet.east_champ, bet.west_champ].filter(Boolean).map((x: string) => x.toLowerCase()).sort().join('|')
      const rF = [result.east_champ, result.west_champ].filter(Boolean).map((x: string) => x.toLowerCase()).sort().join('|')
      if (bF && rF && bF === rF) pts += 3
    } else if (si === 2) {
      const eK = ['e1', 'e2']
      let eW = 0, wW = 0, aW = 0, eX = 0, wX = 0, aX = 0
      for (const m of matches) {
        const bW = (bet[m.key + '_winner'] || '').toLowerCase().trim()
        const rW = (result[m.key + '_winner'] || '').toLowerCase().trim()
        const bR = bet[m.key + '_result'] || ''
        const rR = result[m.key + '_result'] || ''
        if (bW && rW && bW === rW) {
          if (bR && rR && bR === rR) { pts += 6; aX++; if (eK.includes(m.key)) eX++; else wX++ } else { pts += 3 }
          aW++; if (eK.includes(m.key)) eW++; else wW++
        }
      }
      if (aW === 4) { pts += (aX === 4 ? 14 : 7) }
      else { pts += (eX === 2 ? 6 : eW === 2 ? 3 : 0) + (wX === 2 ? 6 : wW === 2 ? 3 : 0) }
    } else if (si === 3) {
      let bW2 = true, bX2 = true
      for (const m of matches) {
        const bW = (bet[m.key + '_winner'] || '').toLowerCase().trim()
        const rW = (result[m.key + '_winner'] || '').toLowerCase().trim()
        const bR = bet[m.key + '_result'] || ''
        const rR = result[m.key + '_result'] || ''
        const w = !!(bW && rW && bW === rW)
        const x = !!(bR && rR && bR === rR)
        if (w) { if (x) pts += 8; else pts += 4 } else bW2 = false
        if (!x) bX2 = false
        const bM = (bet[m.key + '_mvp'] || '').toLowerCase()
        const rM = (result[m.key + '_mvp'] || '').toLowerCase()
        if (bM && rM && bM === rM) pts += 1
      }
      if (bW2) pts += (bX2 ? 6 : 3)
    } else if (si === 4) {
      const m = matches[0]
      const bW = (bet[m.key + '_winner'] || '').toLowerCase()
      const rW = (result[m.key + '_winner'] || '').toLowerCase()
      const s4exact = (bet[m.key + '_result'] || '') === (result[m.key + '_result'] || '')
      if (bW && rW && bW === rW) { if (s4exact) pts += 10; else pts += 5 }
      const bM = (bet[m.key + '_mvp'] || '').toLowerCase()
      const rM = (result[m.key + '_mvp'] || '').toLowerCase()
      if (bM && rM && bM === rM) pts += 2
    }
  }
  // Bonus bets scoring
  if (si === '0b') {
    const bonuses = getBonusBets(globalData, 0)
    const bonusRes = getBonusResults(globalData, 0)
    const bet0 = (leagueData.bets || {})[uid]?.['stage0'] || {}
    const bet0b = (leagueData.bets || {})[uid]?.['stage0b'] || {}
    for (const b of bonuses) {
      const userAns = (bet0['bonus_' + b.id] || bet0b['bonus_' + b.id] || '').toLowerCase().trim()
      const correctAns = (bonusRes[b.id] || '').toLowerCase().trim()
      if (userAns && correctAns && userAns === correctAns) pts += b.points
    }
  } else if (si !== 0) {
    const bonuses = getBonusBets(globalData, si)
    const bonusRes = getBonusResults(globalData, si)
    const bet = (leagueData.bets || {})[uid]?.['stage' + si] || {}
    for (const b of bonuses) {
      const userAns = (bet['bonus_' + b.id] || '').toLowerCase().trim()
      const correctAns = (bonusRes[b.id] || '').toLowerCase().trim()
      if (userAns && correctAns && userAns === correctAns) pts += b.points
    }
  }
  return pts
}

export interface StageDetail {
  seriesPoints: Record<string, number>
  bonusRows: { label: string; pts: number }[]
  bonusBetPoints: Record<string, number>
}

export function scoreStageDetail(
  uid: string,
  si: StageKey,
  leagueData: LeagueData,
  globalData: GlobalData
): StageDetail {
  const detail: StageDetail = { seriesPoints: {}, bonusRows: [], bonusBetPoints: {} }
  const siKey = String(si)
  const bet = (leagueData.bets || {})[uid]?.['stage' + siKey] || {}
  const result = (getGlobal(globalData, 'results', {} as Record<string, Record<string, string> | null>))['stage' + siKey]
  if (!result) return detail
  const matches = STAGE_MATCHES[si]
  if (!matches) return detail

  if (si === 0) {
    for (const m of matches) {
      const b = (bet[m.key] || '').toLowerCase().trim()
      const r = (result[m.key] || '').toLowerCase().trim()
      if (b && r && b === r) detail.seriesPoints[m.key] = 1
    }
  } else if (si === '0b') {
    for (const m of matches) {
      const b = (bet[m.key] || '').toLowerCase().trim()
      const r = (result[m.key] || '').toLowerCase().trim()
      if (b && r && b === r) detail.seriesPoints[m.key] = 1
    }
    const bet0 = (leagueData.bets || {})[uid]?.['stage0'] || {}
    const result0 = (getGlobal(globalData, 'results', {} as Record<string, Record<string, string> | null>))['stage0'] || {}
    const allMatches = [...STAGE_MATCHES[0], ...(STAGE_MATCHES['0b'] || [])]
    let eCAll = 0, wCAll = 0, totAll = 0
    for (const m of allMatches) {
      const bSrc = STAGE_MATCHES[0].find((x) => x.key === m.key) ? bet0 : bet
      const rSrc = STAGE_MATCHES[0].find((x) => x.key === m.key) ? result0 : result
      const b = (bSrc[m.key] || '').toLowerCase().trim()
      const r = ((rSrc as Record<string, string>)[m.key] || '').toLowerCase().trim()
      if (b && r && b === r) { totAll++; if (m.conf === 'east') eCAll++; else wCAll++ }
    }
    if (eCAll === 3) detail.bonusRows.push({ label: 'כל מנצחות המזרח', pts: 1 })
    if (wCAll === 3) detail.bonusRows.push({ label: 'כל מנצחות המערב', pts: 1 })
    if (totAll === 6) detail.bonusRows.push({ label: 'כל 6 המשחקים נכונים', pts: 1 })
  } else if (si === 1) {
    const eK = ['e1', 'e2', 'e3', 'e4']
    let eW = 0, wW = 0, aW = 0, eX = 0, wX = 0, aX = 0
    for (const m of matches) {
      const bW = (bet[m.key + '_winner'] || '').toLowerCase().trim()
      const rW = (result[m.key + '_winner'] || '').toLowerCase().trim()
      const bR = bet[m.key + '_result'] || ''
      const rR = result[m.key + '_result'] || ''
      if (bW && rW && bW === rW) {
        const exact = !!(bR && rR && bR === rR)
        detail.seriesPoints[m.key] = exact ? 4 : 2
        if (exact) { aX++; if (eK.includes(m.key)) eX++; else wX++ }
        aW++; if (eK.includes(m.key)) eW++; else wW++
      }
    }
    if (aW === 8) {
      if (aX === 8) detail.bonusRows.push({ label: 'כל 8 התוצאות מדויקות', pts: 14 })
      else detail.bonusRows.push({ label: 'כל 8 המנצחות נכונות', pts: 7 })
    } else {
      if (eW === 4) detail.bonusRows.push({ label: eX === 4 ? '4 מנצחות מזרח + מדויק' : '4 מנצחות מזרח נכונות', pts: eX === 4 ? 6 : 3 })
      if (wW === 4) detail.bonusRows.push({ label: wX === 4 ? '4 מנצחות מערב + מדויק' : '4 מנצחות מערב נכונות', pts: wX === 4 ? 6 : 3 })
    }
    const bc = (bet.champion || '').toLowerCase(), rc = (result.champion || '').toLowerCase()
    if (bc && rc && bc === rc) detail.bonusRows.push({ label: '🏆 אלוף NBA נכון', pts: 10 })
    const be = (bet.east_champ || '').toLowerCase(), re = (result.east_champ || '').toLowerCase()
    if (be && re && be === re) detail.bonusRows.push({ label: '🔵 אלופת המזרח נכונה', pts: 3 })
    const bw = (bet.west_champ || '').toLowerCase(), rw = (result.west_champ || '').toLowerCase()
    if (bw && rw && bw === rw) detail.bonusRows.push({ label: '🔴 אלופת המערב נכונה', pts: 3 })
    const bF = [bet.east_champ, bet.west_champ].filter(Boolean).map((x: string) => x.toLowerCase()).sort().join('|')
    const rF = [result.east_champ, result.west_champ].filter(Boolean).map((x: string) => x.toLowerCase()).sort().join('|')
    if (bF && rF && bF === rF) detail.bonusRows.push({ label: 'שתי האלופות נכונות', pts: 3 })
  } else if (si === 2) {
    const eK = ['e1', 'e2']
    let eW = 0, wW = 0, aW = 0, eX = 0, wX = 0, aX = 0
    for (const m of matches) {
      const bW = (bet[m.key + '_winner'] || '').toLowerCase().trim()
      const rW = (result[m.key + '_winner'] || '').toLowerCase().trim()
      const bR = bet[m.key + '_result'] || ''
      const rR = result[m.key + '_result'] || ''
      if (bW && rW && bW === rW) {
        const exact = !!(bR && rR && bR === rR)
        detail.seriesPoints[m.key] = exact ? 6 : 3
        if (exact) { aX++; if (eK.includes(m.key)) eX++; else wX++ }
        aW++; if (eK.includes(m.key)) eW++; else wW++
      }
    }
    if (aW === 4) {
      if (aX === 4) detail.bonusRows.push({ label: 'כל 4 התוצאות מדויקות', pts: 14 })
      else detail.bonusRows.push({ label: 'כל 4 המנצחות נכונות', pts: 7 })
    } else {
      if (eW === 2) detail.bonusRows.push({ label: eX === 2 ? '2 מנצחות מזרח + מדויק' : '2 מנצחות מזרח נכונות', pts: eX === 2 ? 6 : 3 })
      if (wW === 2) detail.bonusRows.push({ label: wX === 2 ? '2 מנצחות מערב + מדויק' : '2 מנצחות מערב נכונות', pts: wX === 2 ? 6 : 3 })
    }
  } else if (si === 3) {
    let bW2 = true, bX2 = true
    for (const m of matches) {
      const bW = (bet[m.key + '_winner'] || '').toLowerCase().trim()
      const rW = (result[m.key + '_winner'] || '').toLowerCase().trim()
      const bR = bet[m.key + '_result'] || ''
      const rR = result[m.key + '_result'] || ''
      const w = !!(bW && rW && bW === rW)
      const x = !!(bR && rR && bR === rR)
      if (w) detail.seriesPoints[m.key] = x ? 8 : 4; else bW2 = false
      if (!x) bX2 = false
      const bM = (bet[m.key + '_mvp'] || '').toLowerCase()
      const rM = (result[m.key + '_mvp'] || '').toLowerCase()
      if (bM && rM && bM === rM) detail.bonusRows.push({ label: `MVP ${m.label} נכון`, pts: 1 })
    }
    if (bW2) detail.bonusRows.push({ label: bX2 ? 'שתי התוצאות מדויקות' : 'שתי המנצחות נכונות', pts: bX2 ? 6 : 3 })
  } else if (si === 4) {
    const m = matches[0]
    if (m) {
      const bW = (bet[m.key + '_winner'] || '').toLowerCase()
      const rW = (result[m.key + '_winner'] || '').toLowerCase()
      const exact = (bet[m.key + '_result'] || '') === (result[m.key + '_result'] || '')
      if (bW && rW && bW === rW) detail.seriesPoints[m.key] = exact ? 10 : 5
      const bM = (bet[m.key + '_mvp'] || '').toLowerCase()
      const rM = (result[m.key + '_mvp'] || '').toLowerCase()
      if (bM && rM && bM === rM) detail.bonusRows.push({ label: 'MVP הגמר נכון', pts: 2 })
    }
  }
  // Bonus bets
  if (si === '0b') {
    const bonuses = getBonusBets(globalData, 0)
    const bonusRes = getBonusResults(globalData, 0)
    const bet0 = (leagueData.bets || {})[uid]?.['stage0'] || {}
    for (const b of bonuses) {
      const userAns = (bet0['bonus_' + b.id] || bet['bonus_' + b.id] || '').toLowerCase().trim()
      const correctAns = (bonusRes[b.id] || '').toLowerCase().trim()
      if (userAns && correctAns && userAns === correctAns) detail.bonusBetPoints[b.id] = b.points
    }
  } else if (si !== 0) {
    const bonuses = getBonusBets(globalData, si)
    const bonusRes = getBonusResults(globalData, si)
    for (const b of bonuses) {
      const userAns = (bet['bonus_' + b.id] || '').toLowerCase().trim()
      const correctAns = (bonusRes[b.id] || '').toLowerCase().trim()
      if (userAns && correctAns && userAns === correctAns) detail.bonusBetPoints[b.id] = b.points
    }
  }
  return detail
}
