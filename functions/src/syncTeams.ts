import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { RAPIDAPI_KEY } from './secrets'
import { SUPER_ADMIN_UID } from './constants'
import { fetchSeasonGames, filterPlayoffGames } from './nbaApi'
import { buildTeamsPayload, TEAM_CONF_SEED } from './teamMap'

export interface SyncTeamsRequest {
  season: number
  dryRun?: boolean
}

export const syncTeams = onCall(
  { secrets: [RAPIDAPI_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login required')
    if (request.auth.uid !== SUPER_ADMIN_UID) throw new HttpsError('permission-denied', 'Super admin only')

    if (Object.keys(TEAM_CONF_SEED).length === 0) {
      throw new HttpsError(
        'failed-precondition',
        'TEAM_CONF_SEED is empty. Edit functions/src/teamMap.ts with the current season playoff teams, then redeploy.'
      )
    }

    const { season = 2025, dryRun = false } = (request.data ?? {}) as SyncTeamsRequest
    const apiKey = RAPIDAPI_KEY.value()

    const allGames = await fetchSeasonGames(season, apiKey)
    const playoffGames = filterPlayoffGames(allGames, season)
    const teamsPayload = buildTeamsPayload(playoffGames)

    const matchesFound = Object.values(teamsPayload)
      .flatMap((s) => Object.keys(s ?? {}))

    if (!dryRun && matchesFound.length > 0) {
      const db = getFirestore()
      const updates: Record<string, unknown> = {}
      for (const [stageKey, stageTeams] of Object.entries(teamsPayload)) {
        updates[`teams.${stageKey}`] = stageTeams
      }
      await db.doc('global/settings').update(updates)
    }

    return {
      ok: true,
      dryRun,
      matchesFound,
      teamsPayload,
      totalPlayoffGamesScanned: playoffGames.length,
    }
  }
)
