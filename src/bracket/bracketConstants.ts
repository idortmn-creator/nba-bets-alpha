// Bracket format constants — fully independent from the playoff betting format

export interface BracketSeriesDef {
  key: string
  conf: 'east' | 'west' | ''
  round: 1 | 2 | 3 | 4
  homeSource: TeamSource
  awaySource: TeamSource
  label: string
}

export type TeamSource =
  | { type: 'global'; mk: string; slot: 'home' | 'away' }
  | { type: 'winner'; from: string }

// Bracket order within each conf: e1(1v8), e4(4v5), e2(2v7), e3(3v6) top→bottom
// Winners bracket: (1v8 winner) vs (4v5 winner) → R2 top; (2v7 winner) vs (3v6 winner) → R2 bottom
export const BRACKET_SERIES: BracketSeriesDef[] = [
  // ── Round 1 East ──
  { key: 'r1_e1', conf: 'east', round: 1, label: 'מזרח #1 מול #8', homeSource: { type: 'global', mk: 'e1', slot: 'home' }, awaySource: { type: 'global', mk: 'e1', slot: 'away' } },
  { key: 'r1_e4', conf: 'east', round: 1, label: 'מזרח #4 מול #5', homeSource: { type: 'global', mk: 'e4', slot: 'home' }, awaySource: { type: 'global', mk: 'e4', slot: 'away' } },
  { key: 'r1_e2', conf: 'east', round: 1, label: 'מזרח #2 מול #7', homeSource: { type: 'global', mk: 'e2', slot: 'home' }, awaySource: { type: 'global', mk: 'e2', slot: 'away' } },
  { key: 'r1_e3', conf: 'east', round: 1, label: 'מזרח #3 מול #6', homeSource: { type: 'global', mk: 'e3', slot: 'home' }, awaySource: { type: 'global', mk: 'e3', slot: 'away' } },
  // ── Round 1 West ──
  { key: 'r1_w1', conf: 'west', round: 1, label: 'מערב #1 מול #8', homeSource: { type: 'global', mk: 'w1', slot: 'home' }, awaySource: { type: 'global', mk: 'w1', slot: 'away' } },
  { key: 'r1_w4', conf: 'west', round: 1, label: 'מערב #4 מול #5', homeSource: { type: 'global', mk: 'w4', slot: 'home' }, awaySource: { type: 'global', mk: 'w4', slot: 'away' } },
  { key: 'r1_w2', conf: 'west', round: 1, label: 'מערב #2 מול #7', homeSource: { type: 'global', mk: 'w2', slot: 'home' }, awaySource: { type: 'global', mk: 'w2', slot: 'away' } },
  { key: 'r1_w3', conf: 'west', round: 1, label: 'מערב #3 מול #6', homeSource: { type: 'global', mk: 'w3', slot: 'home' }, awaySource: { type: 'global', mk: 'w3', slot: 'away' } },
  // ── Round 2 East ──
  { key: 'r2_e1', conf: 'east', round: 2, label: "מזרח ס'2 (1)", homeSource: { type: 'winner', from: 'r1_e1' }, awaySource: { type: 'winner', from: 'r1_e4' } },
  { key: 'r2_e2', conf: 'east', round: 2, label: "מזרח ס'2 (2)", homeSource: { type: 'winner', from: 'r1_e2' }, awaySource: { type: 'winner', from: 'r1_e3' } },
  // ── Round 2 West ──
  { key: 'r2_w1', conf: 'west', round: 2, label: "מערב ס'2 (1)", homeSource: { type: 'winner', from: 'r1_w1' }, awaySource: { type: 'winner', from: 'r1_w4' } },
  { key: 'r2_w2', conf: 'west', round: 2, label: "מערב ס'2 (2)", homeSource: { type: 'winner', from: 'r1_w2' }, awaySource: { type: 'winner', from: 'r1_w3' } },
  // ── Conference Finals ──
  { key: 'cf_east', conf: 'east', round: 3, label: 'גמר מזרח', homeSource: { type: 'winner', from: 'r2_e1' }, awaySource: { type: 'winner', from: 'r2_e2' } },
  { key: 'cf_west', conf: 'west', round: 3, label: 'גמר מערב', homeSource: { type: 'winner', from: 'r2_w1' }, awaySource: { type: 'winner', from: 'r2_w2' } },
  // ── Finals ──
  { key: 'finals', conf: '', round: 4, label: 'גמר NBA', homeSource: { type: 'winner', from: 'cf_east' }, awaySource: { type: 'winner', from: 'cf_west' } },
]

// Which downstream series must be cleared when a winner changes
export const BRACKET_DOWNSTREAM: Record<string, string[]> = {
  r1_e1: ['r2_e1', 'cf_east', 'finals'],
  r1_e4: ['r2_e1', 'cf_east', 'finals'],
  r1_e2: ['r2_e2', 'cf_east', 'finals'],
  r1_e3: ['r2_e2', 'cf_east', 'finals'],
  r1_w1: ['r2_w1', 'cf_west', 'finals'],
  r1_w4: ['r2_w1', 'cf_west', 'finals'],
  r1_w2: ['r2_w2', 'cf_west', 'finals'],
  r1_w3: ['r2_w2', 'cf_west', 'finals'],
  r2_e1: ['cf_east', 'finals'],
  r2_e2: ['cf_east', 'finals'],
  r2_w1: ['cf_west', 'finals'],
  r2_w2: ['cf_west', 'finals'],
  cf_east: ['finals'],
  cf_west: ['finals'],
  finals: [],
}

export type BracketPick = Record<string, { homeWins: number; awayWins: number }>

// ── Actual series state (populated from NBA API sync) ──

export interface BracketSeriesState {
  homeTeam: string
  awayTeam: string
  homeWins: number
  awayWins: number
  winner?: string
  result?: string    // "4-2"
  nextGame?: string  // ISO timestamp (UTC)
  gameNumber?: number
}

export type BracketSeriesMap = Record<string, BracketSeriesState>

// ── Team resolution helpers ──

export function getBracketTeams(
  seriesKey: string,
  pick: BracketPick,
  globalR1: Record<string, { home: string; away: string }>
): { home: string; away: string } {
  const def = BRACKET_SERIES.find((s) => s.key === seriesKey)
  if (!def) return { home: '', away: '' }
  const resolve = (src: TeamSource): string => {
    if (src.type === 'global') return (globalR1[src.mk] || {})[src.slot] || ''
    return getBracketWinner(src.from, pick, globalR1)
  }
  return { home: resolve(def.homeSource), away: resolve(def.awaySource) }
}

export function getBracketWinner(
  seriesKey: string,
  pick: BracketPick,
  globalR1: Record<string, { home: string; away: string }>
): string {
  const teams = getBracketTeams(seriesKey, pick, globalR1)
  const p = pick[seriesKey]
  if (!p || !teams.home || !teams.away) return ''
  if (p.homeWins === 4) return teams.home
  if (p.awayWins === 4) return teams.away
  return ''
}

export function clearDownstreamPicks(seriesKey: string, picks: BracketPick): BracketPick {
  const newPicks = { ...picks }
  for (const k of BRACKET_DOWNSTREAM[seriesKey] || []) delete newPicks[k]
  return newPicks
}

/**
 * Resolve teams for a series — uses actual API results (bracketSeries) as the
 * authoritative source for R2+ teams, falling back to user-pick-based resolution
 * when actual data is not yet available.
 */
export function getBracketTeamsWithActual(
  seriesKey: string,
  pick: BracketPick,
  globalR1: Record<string, { home: string; away: string }>,
  bracketSeries?: BracketSeriesMap,
): { home: string; away: string } {
  if (bracketSeries?.[seriesKey]) {
    const actual = bracketSeries[seriesKey]
    if (actual.homeTeam || actual.awayTeam) {
      return { home: actual.homeTeam, away: actual.awayTeam }
    }
  }
  return getBracketTeams(seriesKey, pick, globalR1)
}

// ── Visual layout constants ──

// Card dimensions
export const CARD_W = 148
export const CARD_H = 80
export const TOTAL_H = 356   // max container height
export const TOTAL_W = 1156  // 7 cols × 148 + 6 gaps × 20

// Series pixel positions { x (left edge), y (top edge) }
export const BRACKET_POSITIONS: Record<string, { x: number; y: number }> = {
  // West R1 (col x=0)
  r1_w1: { x: 0,    y: 0   },
  r1_w4: { x: 0,    y: 88  },
  r1_w2: { x: 0,    y: 188 },
  r1_w3: { x: 0,    y: 276 },
  // West R2 (col x=168)
  r2_w1: { x: 168,  y: 44  },
  r2_w2: { x: 168,  y: 232 },
  // West CF (col x=336)
  cf_west: { x: 336, y: 138 },
  // Finals (col x=504)
  finals:  { x: 504, y: 138 },
  // East CF (col x=672)
  cf_east: { x: 672, y: 138 },
  // East R2 (col x=840)
  r2_e1: { x: 840,  y: 44  },
  r2_e2: { x: 840,  y: 232 },
  // East R1 (col x=1008)
  r1_e1: { x: 1008, y: 0   },
  r1_e4: { x: 1008, y: 88  },
  r1_e2: { x: 1008, y: 188 },
  r1_e3: { x: 1008, y: 276 },
}

// SVG connector line segments [x1, y1, x2, y2]
// Each pair of R1 series feeds one R2 series via a bracket "hook"
// Convention: cy = y + CARD_H/2 = card center y
type Line = [number, number, number, number]

function makePairLines(
  topY: number, botY: number, parentCY: number,
  cardLeftX: number, midX: number, parentRightX: number
): Line[] {
  const topCY = topY + CARD_H / 2
  const botCY = botY + CARD_H / 2
  return [
    [cardLeftX, topCY, midX, topCY],    // horizontal from top card left to midX
    [midX, topCY, midX, botCY],          // vertical connecting top and bottom
    [cardLeftX, botCY, midX, botCY],    // horizontal from bot card left to midX
    [midX, parentCY, parentRightX, parentCY], // horizontal to parent card
  ]
}

// East connectors (lines go LEFT from East R1 toward Finals)
const eastR1R2Top = makePairLines(0, 88, 84, 1008, 998, 988)
const eastR1R2Bot = makePairLines(188, 276, 272, 1008, 998, 988)
const eastR2CF = makePairLines(44, 232, 178, 840, 830, 820)
const eastCFFinalsLine: Line[] = [[672, 178, 652, 178]]

// West connectors (lines go RIGHT from West R1 toward Finals)
function makeWestPairLines(
  topY: number, botY: number, parentCY: number,
  cardRightX: number, midX: number, parentLeftX: number
): Line[] {
  const topCY = topY + CARD_H / 2
  const botCY = botY + CARD_H / 2
  return [
    [cardRightX, topCY, midX, topCY],
    [midX, topCY, midX, botCY],
    [cardRightX, botCY, midX, botCY],
    [midX, parentCY, parentLeftX, parentCY],
  ]
}
const westR1R2Top = makeWestPairLines(0, 88, 84, 148, 158, 168)
const westR1R2Bot = makeWestPairLines(188, 276, 272, 148, 158, 168)
const westR2CF = makeWestPairLines(44, 232, 178, 316, 326, 336)
const westCFFinalsLine: Line[] = [[484, 178, 504, 178]]

export const BRACKET_CONNECTOR_LINES: Line[] = [
  ...eastR1R2Top, ...eastR1R2Bot, ...eastR2CF, ...eastCFFinalsLine,
  ...westR1R2Top, ...westR1R2Bot, ...westR2CF, ...westCFFinalsLine,
]
