// RapidAPI — API-NBA (api-sports.io)
// Host: api-nba-v1.p.rapidapi.com
// Docs: https://rapidapi.com/api-sports/api/api-nba

export interface NBAGame {
  id: number
  date: { start: string; end: string | null }
  stage: number
  status: { clock: string | null; halftime: boolean; short: number; long: string }
  teams: {
    home: { id: number; name: string; nickname: string; code: string }
    visitors: { id: number; name: string; nickname: string; code: string }
  }
  scores: {
    home: { series: { win: number; loss: number } | null; points: number | null }
    visitors: { series: { win: number; loss: number } | null; points: number | null }
  }
}

const API_HOST = 'api-nba-v1.p.rapidapi.com'

async function apiFetch(path: string, apiKey: string): Promise<NBAGame[]> {
  const url = `https://${API_HOST}${path}`
  const resp = await fetch(url, {
    headers: {
      'x-rapidapi-key': apiKey,
      'x-rapidapi-host': API_HOST,
    },
  })
  if (!resp.ok) {
    const body = await resp.text()
    throw new Error(`RapidAPI ${resp.status}: ${body.slice(0, 300)}`)
  }
  const data = await resp.json() as { response?: NBAGame[]; errors?: Record<string, string> }
  if (data.errors && Object.keys(data.errors).length > 0) {
    throw new Error('RapidAPI error: ' + JSON.stringify(data.errors))
  }
  return data.response ?? []
}

/** Fetch every game for the season (regular season + playoffs). Used for full syncs. */
export async function fetchSeasonGames(season: number, apiKey: string): Promise<NBAGame[]> {
  return apiFetch(`/games?season=${season}&league=standard`, apiKey)
}

/** Fetch games for a specific date (YYYY-MM-DD). Used by the scheduled daily sync. */
export async function fetchGamesByDate(date: string, season: number, apiKey: string): Promise<NBAGame[]> {
  return apiFetch(`/games?date=${date}&season=${season}&league=standard`, apiKey)
}

/**
 * Filter for completed playoff / play-in games only.
 * Playoff season starts ~April 1 of the year after the season started.
 * e.g. season=2025 → playoffs start 2026-04-01.
 */
export function filterPlayoffGames(games: NBAGame[], season: number): NBAGame[] {
  const playoffStart = new Date(`${season + 1}-04-01T00:00:00Z`)
  return games.filter((g) => {
    if (!g.date?.start) return false
    if (g.status.long !== 'Finished') return false
    return new Date(g.date.start) >= playoffStart
  })
}
