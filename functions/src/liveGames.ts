import * as functions from 'firebase-functions'
import { getRapidApiKey } from './secrets'
import { fetchGamesByDate } from './nbaApi'
import type { NBAGame } from './nbaApi'

/**
 * Filter for playoff / play-in games regardless of game status.
 * Unlike filterPlayoffGames(), this keeps scheduled and in-progress games too.
 */
function filterPlayoffByDate(games: NBAGame[], season: number): NBAGame[] {
  const playoffStart = new Date(`${season + 1}-04-01T00:00:00Z`)
  return games.filter((g) => {
    if (!g.date?.start) return false
    return new Date(g.date.start) >= playoffStart
  })
}

/**
 * Callable: returns today's NBA playoff games (all statuses).
 * Used by the Live Results tab in the frontend.
 */
export const getLiveGames = functions.https.onCall(async (data, _context) => {
  try {
    const { season = 2025, date } = (data ?? {}) as { season?: number; date?: string }
    const apiKey = getRapidApiKey()
    const targetDate = date ?? new Date().toISOString().slice(0, 10)
    const allGames = await fetchGamesByDate(targetDate, season, apiKey)
    const playoffGames = filterPlayoffByDate(allGames, season)
    return { ok: true, games: playoffGames, date: targetDate }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[getLiveGames] error:', msg)
    throw new functions.https.HttpsError('internal', msg)
  }
})
