// Pure scoring logic for the bracket format
// No React imports — safe to use anywhere

import { BRACKET_SERIES } from './bracketConstants'
import type { BracketPick, BracketMvpPick, BracketSeriesMap } from './bracketConstants'

// ── Points table ─────────────────────────────────────────────────────────────

/** Points for correctly predicting the winner of a series, by round */
const WINNER_PTS: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 8 }

/** Points for correctly predicting winner AND exact game count, by round */
const EXACT_PTS: Record<number, number>  = { 1: 2, 2: 4, 3: 8, 4: 16 }

/** Points for correctly predicting the series MVP */
const MVP_PTS: Record<string, number> = { cf_east: 2, cf_west: 2, finals: 5 }

// ── Types ─────────────────────────────────────────────────────────────────────

export type SeriesResult = 'exact' | 'winner' | 'wrong' | 'pending' | 'unpicked'

export interface BracketSeriesScore {
  points: number
  result: SeriesResult
}

export interface BracketMvpScore {
  points: number
  correct: boolean
  /** false when the actual MVP hasn't been set yet by admin */
  hasActual: boolean
}

export interface BracketScoreBreakdown {
  total: number
  seriesPts: number
  mvpPts: number
  /** Points earned per round (keys: 1–4) */
  byRound: Record<number, number>
  /** Per-series scoring result */
  bySeries: Record<string, BracketSeriesScore>
  /** Per-MVP series scoring result */
  byMvp: Record<string, BracketMvpScore>
}

// ── Core scoring function ─────────────────────────────────────────────────────

export function scoreBracket(
  pick: BracketPick,
  mvpPick: BracketMvpPick,
  bracketSeries: BracketSeriesMap,
  actualMvp: BracketMvpPick,
): BracketScoreBreakdown {
  let seriesPts = 0
  let mvpPts = 0
  const byRound: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0 }
  const bySeries: Record<string, BracketSeriesScore> = {}
  const byMvp: Record<string, BracketMvpScore> = {}

  // ── Series scoring ──
  for (const seriesDef of BRACKET_SERIES) {
    const key = seriesDef.key
    const actual = bracketSeries[key]

    // Series hasn't finished yet — no result to score against
    if (!actual?.winner) {
      bySeries[key] = { points: 0, result: 'pending' }
      continue
    }

    const p = pick[key]
    // User didn't pick a winner for this series
    if (!p || (p.homeWins !== 4 && p.awayWins !== 4)) {
      bySeries[key] = { points: 0, result: 'unpicked' }
      continue
    }

    const round = seriesDef.round
    const userPickedHome = p.homeWins === 4
    const actualHomeWon  = actual.winner === actual.homeTeam

    if (userPickedHome !== actualHomeWon) {
      bySeries[key] = { points: 0, result: 'wrong' }
      continue
    }

    // Correct winner — check if game count also matches
    const exactMatch = p.homeWins === actual.homeWins && p.awayWins === actual.awayWins
    const pts    = exactMatch ? EXACT_PTS[round] : WINNER_PTS[round]
    const result: SeriesResult = exactMatch ? 'exact' : 'winner'

    bySeries[key] = { points: pts, result }
    byRound[round] += pts
    seriesPts += pts
  }

  // ── MVP scoring ──
  for (const key of ['cf_east', 'cf_west', 'finals'] as const) {
    const actual   = actualMvp[key]
    const userPick = mvpPick[key]

    if (!actual) {
      byMvp[key] = { points: 0, correct: false, hasActual: false }
      continue
    }
    if (!userPick) {
      byMvp[key] = { points: 0, correct: false, hasActual: true }
      continue
    }

    const correct = userPick === actual
    const pts = correct ? MVP_PTS[key] : 0
    byMvp[key] = { points: pts, correct, hasActual: true }
    mvpPts += pts
  }

  return {
    total: seriesPts + mvpPts,
    seriesPts,
    mvpPts,
    byRound,
    bySeries,
    byMvp,
  }
}

// ── Convenience: score every member ──────────────────────────────────────────

export function scoreBracketAll(
  members: string[],
  bets: Record<string, BracketPick>,
  mvpBets: Record<string, BracketMvpPick>,
  bracketSeries: BracketSeriesMap,
  actualMvp: BracketMvpPick,
): Array<{ uid: string; total: number; breakdown: BracketScoreBreakdown }> {
  return members
    .map((uid) => {
      const breakdown = scoreBracket(
        bets[uid]    || {},
        mvpBets[uid] || {},
        bracketSeries,
        actualMvp,
      )
      return { uid, total: breakdown.total, breakdown }
    })
    .sort((a, b) => b.total - a.total || a.uid.localeCompare(b.uid))
}
