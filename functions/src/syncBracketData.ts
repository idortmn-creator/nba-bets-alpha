import * as functions from 'firebase-functions'
import { getFirestore } from 'firebase-admin/firestore'
import { getRapidApiKey } from './secrets'
import { SUPER_ADMIN_UID } from './constants'
import { fetchSeasonGames } from './nbaApi'
import type { NBAGame } from './nbaApi'

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

// ── Team matching (mirrors teamMap.ts) ──────────────────────────────────────

function teamsMatch(apiName: string, firestoreName: string): boolean {
  if (!apiName || !firestoreName) return false
  const a = apiName.toLowerCase().trim()
  const f = firestoreName.toLowerCase().trim()
  if (a === f) return true
  if (a.includes(f) || f.includes(a)) return true
  const aLast = a.split(/\s+/).pop() ?? a
  const fLast = f.split(/\s+/).pop() ?? f
  return aLast === fLast
}

// ── Build state for one series ───────────────────────────────────────────────

function buildSeriesState(
  homeTeam: string,
  awayTeam: string,
  allGames: NBAGame[],
): BracketSeriesState {
  if (!homeTeam || !awayTeam) {
    return { homeTeam, awayTeam, homeWins: 0, awayWins: 0 }
  }

  const seriesGames = allGames.filter((g) =>
    (teamsMatch(g.teams.home.name, homeTeam) && teamsMatch(g.teams.visitors.name, awayTeam)) ||
    (teamsMatch(g.teams.home.name, awayTeam) && teamsMatch(g.teams.visitors.name, homeTeam)),
  )

  // Count wins from finished games by comparing points
  let homeWins = 0
  let awayWins = 0

  for (const g of seriesGames) {
    if (g.status.long !== 'Finished') continue
    const homeIsHome = teamsMatch(g.teams.home.name, homeTeam)
    const homePoints = g.scores.home.points ?? 0
    const awayPoints = g.scores.visitors.points ?? 0
    if (homePoints === 0 && awayPoints === 0) continue // no score data
    if (homePoints > awayPoints) {
      if (homeIsHome) homeWins++
      else awayWins++
    } else if (awayPoints > homePoints) {
      if (homeIsHome) awayWins++
      else homeWins++
    }
  }

  const finishedCount = seriesGames.filter((g) => g.status.long === 'Finished').length

  // Next scheduled game (earliest future game in this series)
  const upcomingGames = seriesGames
    .filter((g) => g.status.long === 'Not Started')
    .sort((a, b) => new Date(a.date.start).getTime() - new Date(b.date.start).getTime())
  const nextGame = upcomingGames[0]?.date.start

  const winner =
    homeWins === 4 ? homeTeam : awayWins === 4 ? awayTeam : undefined
  const result = winner
    ? homeWins === 4
      ? `4-${awayWins}`
      : `4-${homeWins}`
    : undefined

  const state: BracketSeriesState = {
    homeTeam,
    awayTeam,
    homeWins,
    awayWins,
  }
  if (winner) state.winner = winner
  if (result) state.result = result
  if (nextGame) state.nextGame = nextGame
  if (!winner && finishedCount > 0) state.gameNumber = finishedCount + 1

  return state
}

// ── Main: build full bracket series state ───────────────────────────────────

export function buildBracketSeriesState(
  allGames: NBAGame[],
  stage1Teams: Record<string, { home: string; away: string }>,
): BracketSeriesMap {
  const result: BracketSeriesMap = {}

  // R1 bracket key → stage1 match key
  const r1Map: Record<string, string> = {
    r1_e1: 'e1', r1_e4: 'e4', r1_e2: 'e2', r1_e3: 'e3',
    r1_w1: 'w1', r1_w4: 'w4', r1_w2: 'w2', r1_w3: 'w3',
  }

  // Round 1
  for (const [bracketKey, stageKey] of Object.entries(r1Map)) {
    const teams = stage1Teams[stageKey] || { home: '', away: '' }
    result[bracketKey] = buildSeriesState(teams.home, teams.away, allGames)
  }

  // Round 2 — teams derived from R1 winners
  const r2Pairs = [
    { key: 'r2_e1', from1: 'r1_e1', from2: 'r1_e4' },
    { key: 'r2_e2', from1: 'r1_e2', from2: 'r1_e3' },
    { key: 'r2_w1', from1: 'r1_w1', from2: 'r1_w4' },
    { key: 'r2_w2', from1: 'r1_w2', from2: 'r1_w3' },
  ]
  for (const { key, from1, from2 } of r2Pairs) {
    const home = result[from1]?.winner ?? ''
    const away = result[from2]?.winner ?? ''
    result[key] = buildSeriesState(home, away, allGames)
  }

  // Conference Finals — teams derived from R2 winners
  const cfPairs = [
    { key: 'cf_east', from1: 'r2_e1', from2: 'r2_e2' },
    { key: 'cf_west', from1: 'r2_w1', from2: 'r2_w2' },
  ]
  for (const { key, from1, from2 } of cfPairs) {
    const home = result[from1]?.winner ?? ''
    const away = result[from2]?.winner ?? ''
    result[key] = buildSeriesState(home, away, allGames)
  }

  // NBA Finals — East champ vs West champ
  const eastChamp = result['cf_east']?.winner ?? ''
  const westChamp = result['cf_west']?.winner ?? ''
  result['finals'] = buildSeriesState(eastChamp, westChamp, allGames)

  return result
}

// ── Callable Cloud Function ──────────────────────────────────────────────────

export const syncBracketData = functions.https.onCall(async (_, context) => {
  if (!context.auth?.uid) throw new functions.https.HttpsError('unauthenticated', 'Login required')
  if (context.auth.uid !== SUPER_ADMIN_UID) {
    throw new functions.https.HttpsError('permission-denied', 'Super admin only')
  }

  const db = getFirestore()
  const apiKey = getRapidApiKey()

  const settingsSnap = await db.doc('global/settings').get()
  if (!settingsSnap.exists) throw new functions.https.HttpsError('not-found', 'No settings doc')

  const settings = settingsSnap.data() as {
    teams?: Record<string, Record<string, { home: string; away: string }>>
  }
  const stage1Teams = settings.teams?.stage1 ?? {}

  // Fetch all games (finished + upcoming) for win counts and schedule data
  const allGames = await fetchSeasonGames(2025, apiKey)

  const bracketSeries = buildBracketSeriesState(allGames, stage1Teams)

  await db.doc('global/settings').update({ bracketSeries })

  return { ok: true, bracketSeries }
})
