import * as functions from 'firebase-functions'
import { getFirestore } from 'firebase-admin/firestore'
import { getRapidApiKey } from './secrets'
import { SUPER_ADMIN_UID } from './constants'
import { fetchSeasonGames, filterPlayoffGames } from './nbaApi'
import { buildTeamsPayload, TEAM_CONF_SEED } from './teamMap'

export const syncTeams = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functions.https.HttpsError('unauthenticated', 'Login required')
  if (context.auth.uid !== SUPER_ADMIN_UID) throw new functions.https.HttpsError('permission-denied', 'Super admin only')

  if (Object.keys(TEAM_CONF_SEED).length === 0) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'TEAM_CONF_SEED is empty. Edit functions/src/teamMap.ts with the current season playoff teams, then redeploy.'
    )
  }

  const { season = 2025, dryRun = false } = (data ?? {}) as { season?: number; dryRun?: boolean }
  const apiKey = getRapidApiKey()

  const allGames = await fetchSeasonGames(season, apiKey)
  const playoffGames = filterPlayoffGames(allGames, season)
  const teamsPayload = buildTeamsPayload(playoffGames)

  const matchesFound = Object.values(teamsPayload).flatMap((s) => Object.keys(s ?? {}))

  if (!dryRun && matchesFound.length > 0) {
    const db = getFirestore()
    const updates: Record<string, unknown> = {}
    for (const [stageKey, stageTeams] of Object.entries(teamsPayload)) {
      updates[`teams.${stageKey}`] = stageTeams
    }
    await db.doc('global/settings').update(updates)
  }

  return { ok: true, dryRun, matchesFound, teamsPayload, totalPlayoffGamesScanned: playoffGames.length }
})
