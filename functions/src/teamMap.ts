import type { NBAGame } from './nbaApi'

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE THIS MAP BEFORE EACH SEASON'S PLAYOFFS / PLAY-IN BEGINS.
//
// Fill in all 20 teams: 8 East playoff seeds, 8 West playoff seeds,
// plus 4 play-in teams per conference (seeds 7-10).
// Use the exact team names that the NBA API returns (full city + nickname).
//
// After updating, run: cd functions && npm run build
// Then: firebase deploy --only functions
// ─────────────────────────────────────────────────────────────────────────────
export const TEAM_CONF_SEED: Record<string, { conf: 'east' | 'west'; seed: number }> = {
  // ── EAST (2025-26 season) ─────────────────────────────────────────────────
  'Detroit Pistons':        { conf: 'east', seed: 1 },
  'Boston Celtics':         { conf: 'east', seed: 2 },
  'New York Knicks':        { conf: 'east', seed: 3 },
  'Cleveland Cavaliers':    { conf: 'east', seed: 4 },
  'Toronto Raptors':        { conf: 'east', seed: 5 },
  'Atlanta Hawks':          { conf: 'east', seed: 6 },
  'Philadelphia 76ers':     { conf: 'east', seed: 7 },  // play-in
  'Orlando Magic':          { conf: 'east', seed: 8 },  // play-in
  'Charlotte Hornets':      { conf: 'east', seed: 9 },  // play-in
  'Miami Heat':             { conf: 'east', seed: 10 }, // play-in

  // ── WEST (2025-26 season) ─────────────────────────────────────────────────
  'Oklahoma City Thunder':  { conf: 'west', seed: 1 },
  'San Antonio Spurs':      { conf: 'west', seed: 2 },
  'Denver Nuggets':         { conf: 'west', seed: 3 },
  'Los Angeles Lakers':     { conf: 'west', seed: 4 },
  'Houston Rockets':        { conf: 'west', seed: 5 },
  'Minnesota Timberwolves': { conf: 'west', seed: 6 },
  'Phoenix Suns':           { conf: 'west', seed: 7 },  // play-in
  'Portland Trail Blazers': { conf: 'west', seed: 8 },  // play-in
  'Los Angeles Clippers':   { conf: 'west', seed: 9 },  // play-in
  'Golden State Warriors':  { conf: 'west', seed: 10 }, // play-in
}

// ── Lookup helpers ─────────────────────────────────────────────────────────

function lookupTeam(name: string): { conf: 'east' | 'west'; seed: number } | null {
  if (TEAM_CONF_SEED[name]) return TEAM_CONF_SEED[name]
  const lower = name.toLowerCase().trim()
  for (const [key, val] of Object.entries(TEAM_CONF_SEED)) {
    if (key.toLowerCase().trim() === lower) return val
    // Nickname match (last word: "Warriors", "Celtics", etc.)
    const keyLast = key.toLowerCase().split(/\s+/).pop()
    const nameLast = lower.split(/\s+/).pop()
    if (keyLast && nameLast && keyLast === nameLast) return val
  }
  return null
}

function r1MatchKey(conf: 'east' | 'west', seedA: number, seedB: number): string | null {
  const p = conf === 'east' ? 'e' : 'w'
  const lo = Math.min(seedA, seedB)
  const hi = Math.max(seedA, seedB)
  if (lo === 1 && hi === 8) return `${p}1`
  if (lo === 2 && hi === 7) return `${p}2`
  if (lo === 3 && hi === 6) return `${p}3`
  if (lo === 4 && hi === 5) return `${p}4`
  return null
}

function playInMatchKey(conf: 'east' | 'west', seedA: number, seedB: number): string | null {
  const p = conf === 'east' ? 'e' : 'w'
  const lo = Math.min(seedA, seedB)
  const hi = Math.max(seedA, seedB)
  if (lo === 7 && hi === 8) return `${p}78`
  if (lo === 9 && hi === 10) return `${p}910`
  return null // Play-in finals (7-10 cross matchups) can't be derived from seeds alone
}

// ── Public: build teams payload ────────────────────────────────────────────

export interface TeamsPayload {
  stage0?: Record<string, { home: string; away: string }>
  stage1?: Record<string, { home: string; away: string }>
}

/**
 * Derive stage 0 (play-in round 1) and stage 1 (first round) team matchups
 * from API game data, using the TEAM_CONF_SEED map.
 */
export function buildTeamsPayload(games: NBAGame[]): TeamsPayload {
  const stage0: Record<string, { home: string; away: string }> = {}
  const stage1: Record<string, { home: string; away: string }> = {}

  for (const g of games) {
    const homeName = g.teams.home.name
    const awayName = g.teams.visitors.name
    const homeInfo = lookupTeam(homeName)
    const awayInfo = lookupTeam(awayName)
    if (!homeInfo || !awayInfo) continue
    if (homeInfo.conf !== awayInfo.conf) continue

    const conf = homeInfo.conf
    const sA = homeInfo.seed
    const sB = awayInfo.seed

    if (sA <= 8 && sB <= 8) {
      const mk = r1MatchKey(conf, sA, sB)
      if (mk && !stage1[mk]) stage1[mk] = { home: homeName, away: awayName }
    } else if (sA >= 7 && sA <= 10 && sB >= 7 && sB <= 10) {
      const mk = playInMatchKey(conf, sA, sB)
      if (mk && !stage0[mk]) stage0[mk] = { home: homeName, away: awayName }
    }
  }

  const payload: TeamsPayload = {}
  if (Object.keys(stage0).length) payload.stage0 = stage0
  if (Object.keys(stage1).length) payload.stage1 = stage1
  return payload
}

// ── Public: build results payload ─────────────────────────────────────────

export interface SeriesState {
  homeName: string
  awayName: string
  homeWins: number
  awayWins: number
}

/** Group finished games by team pair and take the state from the most advanced game. */
function buildSeriesMap(games: NBAGame[]): Map<string, SeriesState> {
  const map = new Map<string, SeriesState>()
  for (const g of games) {
    const homeName = g.teams.home.name
    const awayName = g.teams.visitors.name
    const [a, b] = [homeName, awayName].sort()
    const key = `${a}|||${b}`

    const homeWins = g.scores.home.series?.win ?? 0
    const awayWins = g.scores.visitors.series?.win ?? 0
    const existing = map.get(key)
    if (!existing || homeWins + awayWins > existing.homeWins + existing.awayWins) {
      map.set(key, { homeName, awayName, homeWins, awayWins })
    }
  }
  return map
}

function teamsMatch(apiName: string, firestoreName: string): boolean {
  const a = apiName.toLowerCase().trim()
  const f = firestoreName.toLowerCase().trim()
  if (a === f) return true
  if (a.includes(f) || f.includes(a)) return true
  const aLast = a.split(/\s+/).pop() ?? a
  const fLast = f.split(/\s+/).pop() ?? f
  return aLast === fLast
}

function findSeries(
  seriesMap: Map<string, SeriesState>,
  teamHome: string,
  teamAway: string,
): SeriesState | null {
  for (const series of seriesMap.values()) {
    if (teamsMatch(series.homeName, teamHome) && teamsMatch(series.awayName, teamAway)) return series
    if (teamsMatch(series.homeName, teamAway) && teamsMatch(series.awayName, teamHome)) {
      // Swap so the "home" in result matches Firestore's home
      return { homeName: series.awayName, awayName: series.homeName, homeWins: series.awayWins, awayWins: series.homeWins }
    }
  }
  return null
}

/**
 * Build Firestore results map for a given stage by matching API series to
 * the team names already stored in Firestore (firestoreTeams).
 *
 * isPlayIn=true  → result is { "e78": "Team Name" }
 * isPlayIn=false → result is { "e1_winner": "X", "e1_result": "4-2" }
 */
export function buildResultsPayload(
  games: NBAGame[],
  firestoreTeams: Record<string, { home: string; away: string }>,
  isPlayIn: boolean,
): Record<string, string> {
  const seriesMap = buildSeriesMap(games)
  const results: Record<string, string> = {}

  for (const [mk, teams] of Object.entries(firestoreTeams)) {
    if (!teams.home || !teams.away) continue
    const s = findSeries(seriesMap, teams.home, teams.away)
    if (!s) continue

    if (isPlayIn) {
      // Play-in single game: winner is whoever scored more points in the finished game
      // series.win won't be 4 for single games — just use whichever team won the game
      if (s.homeWins + s.awayWins >= 1) {
        results[mk] = s.homeWins > s.awayWins ? s.homeName : s.awayName
      }
    } else {
      if (s.homeWins === 4) {
        results[`${mk}_winner`] = s.homeName
        results[`${mk}_result`] = `4-${s.awayWins}`
      } else if (s.awayWins === 4) {
        results[`${mk}_winner`] = s.awayName
        results[`${mk}_result`] = `4-${s.homeWins}`
      }
    }
  }

  return results
}
