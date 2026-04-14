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
export const getLiveGames = functions.https.onCall(async (_data, _context) => {
  // DIAGNOSTIC: hardcoded response — no API calls. If this still errors, code is not deploying.
  return { ok: true, games: [], date: 'diagnostic-v5', version: 'v5' }
})
