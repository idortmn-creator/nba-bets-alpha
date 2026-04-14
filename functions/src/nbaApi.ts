// API-BASKETBALL (NBA) — api-basketball-nba.p.rapidapi.com
// Endpoint: GET /nbaschedule?year=YYYY&month=MM&day=DD

// ── Public interface (unchanged — consumed by syncResults, syncTeams, liveGames) ──

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

// ── Internal types from the new API ─────────────────────────────────────────────

interface ScheduleCompetitor {
  id: string
  abbrev: string
  displayName: string
  shortDisplayName: string
  isHome: boolean
  score: number
  winner?: boolean
}

interface ScheduleGame {
  id: string
  date: string        // ISO string e.g. "2026-04-13T00:00Z"
  completed: boolean
  tbd: boolean
  competitors: ScheduleCompetitor[]
}

const API_HOST = 'api-basketball-nba.p.rapidapi.com'

// ── Low-level fetch ──────────────────────────────────────────────────────────────

async function fetchScheduleRaw(
  year: number,
  month: number,
  day: number | null,
  apiKey: string,
): Promise<ScheduleGame[]> {
  const mm = String(month).padStart(2, '0')
  const dd = day !== null ? `&day=${String(day).padStart(2, '0')}` : ''
  const url = `https://${API_HOST}/nbaschedule?year=${year}&month=${mm}${dd}`

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

  const data = await resp.json() as { schedule?: Record<string, ScheduleGame[]> }
  const schedule = data.schedule ?? {}

  // When a specific day was requested, only return games for that exact date key
  // (the API sometimes returns multiple date keys in a single response, which causes
  // duplicates when the caller fetches consecutive dates)
  if (day !== null) {
    const dateKey = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}`
    return schedule[dateKey] ?? []
  }

  // Full-month fetch (day === null) — flatten all date keys
  const games: ScheduleGame[] = []
  for (const dayGames of Object.values(schedule)) {
    if (Array.isArray(dayGames)) games.push(...dayGames)
  }
  return games
}

// ── Mapping: ScheduleGame → NBAGame ─────────────────────────────────────────────

function mapGame(g: ScheduleGame): NBAGame {
  const home = g.competitors.find(c => c.isHome)
  const away = g.competitors.find(c => !c.isHome)

  let statusShort: number
  let statusLong: string

  if (g.completed) {
    statusShort = 3
    statusLong = 'Finished'
  } else if (new Date() > new Date(g.date)) {
    statusShort = 2
    statusLong = 'In Play'
  } else {
    statusShort = 1
    statusLong = 'Not Started'
  }

  const showScore = statusShort === 3 || statusShort === 2

  return {
    id: parseInt(g.id, 10) || 0,
    date: { start: g.date, end: null },
    stage: 0,
    status: { clock: null, halftime: false, short: statusShort, long: statusLong },
    teams: {
      home: {
        id: parseInt(home?.id ?? '0', 10),
        name: home?.displayName ?? '',
        nickname: home?.shortDisplayName ?? '',
        code: home?.abbrev ?? '',
      },
      visitors: {
        id: parseInt(away?.id ?? '0', 10),
        name: away?.displayName ?? '',
        nickname: away?.shortDisplayName ?? '',
        code: away?.abbrev ?? '',
      },
    },
    scores: {
      home: { series: null, points: showScore ? (home?.score ?? null) : null },
      visitors: { series: null, points: showScore ? (away?.score ?? null) : null },
    },
  }
}

// ── Public API ───────────────────────────────────────────────────────────────────

/** Fetch games for a specific date (YYYY-MM-DD). Used by getLiveGames. */
export async function fetchGamesByDate(date: string, _season: number, apiKey: string): Promise<NBAGame[]> {
  const [year, month, day] = date.split('-').map(Number)
  const games = await fetchScheduleRaw(year, month, day, apiKey)
  return games.map(mapGame)
}

/**
 * Fetch all games for the season. Fetches playoff months (Apr–Jun of season+1).
 * Used by syncResults / syncTeams for full-season syncs.
 */
export async function fetchSeasonGames(season: number, apiKey: string): Promise<NBAGame[]> {
  const playoffMonths = [
    { year: season + 1, month: 4 },
    { year: season + 1, month: 5 },
    { year: season + 1, month: 6 },
  ]

  const all: NBAGame[] = []
  for (const { year, month } of playoffMonths) {
    try {
      const games = await fetchScheduleRaw(year, month, null, apiKey)
      all.push(...games.map(mapGame))
    } catch (err) {
      console.warn(`fetchSeasonGames: skipped ${year}-${month}:`, err)
    }
  }
  return all
}

/**
 * Filter for completed playoff / play-in games only.
 * Playoff season starts ~April 1 of the year after the season started.
 */
export function filterPlayoffGames(games: NBAGame[], season: number): NBAGame[] {
  const playoffStart = new Date(`${season + 1}-04-01T00:00:00Z`)
  return games.filter((g) => {
    if (!g.date?.start) return false
    if (g.status.long !== 'Finished') return false
    return new Date(g.date.start) >= playoffStart
  })
}
