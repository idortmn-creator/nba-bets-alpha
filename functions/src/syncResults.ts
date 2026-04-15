import * as functions from 'firebase-functions'
import { getFirestore } from 'firebase-admin/firestore'
import { getRapidApiKey } from './secrets'
import { SUPER_ADMIN_UID } from './constants'
import { fetchSeasonGames, fetchGamesByDate, filterPlayoffGames } from './nbaApi'
import type { NBAGame } from './nbaApi'
import { buildResultsPayload, buildTeamsPayload } from './teamMap'
import { buildBracketSeriesState } from './syncBracketData'

type StageKeyInput = 0 | '0b' | 1 | 2 | 3 | 4

function stageKeyToStr(sk: StageKeyInput): string {
  return sk === '0b' ? 'stage0b' : `stage${sk}`
}

function isPlayInStage(sk: StageKeyInput): boolean {
  return sk === 0 || sk === '0b'
}

/**
 * Resolve which games to use for results processing.
 *
 * @param prefetchedGames  If provided (scheduled sync), use these directly to
 *                         avoid a second set of API calls for the same data.
 * @param fullSync         When true (and no prefetch), fetch the full season;
 *                         when false, fetch only yesterday + today (cheaper).
 */
async function resolveGames(
  season: number,
  apiKey: string,
  fullSync: boolean,
  prefetchedGames?: NBAGame[],
): Promise<NBAGame[]> {
  if (prefetchedGames) return prefetchedGames

  if (fullSync) {
    const all = await fetchSeasonGames(season, apiKey)
    return filterPlayoffGames(all, season)
  }

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setUTCDate(yesterday.getUTCDate() - 1)
  const fmt = (d: Date) => d.toISOString().slice(0, 10)
  const [todayGames, yesterdayGames] = await Promise.all([
    fetchGamesByDate(fmt(today), season, apiKey),
    fetchGamesByDate(fmt(yesterday), season, apiKey),
  ])
  return filterPlayoffGames([...todayGames, ...yesterdayGames], season)
}

async function runSync(
  season: number,
  stageKey: StageKeyInput,
  apiKey: string,
  fullSync: boolean,
  prefetchedGames?: NBAGame[],
): Promise<{ updated: string[]; skipped: string[]; resultsPayload: Record<string, string> }> {
  const db = getFirestore()

  const settingsSnap = await db.doc('global/settings').get()
  if (!settingsSnap.exists) return { updated: [], skipped: ['no settings doc'], resultsPayload: {} }
  const settings = settingsSnap.data() as {
    teams?: Record<string, Record<string, { home: string; away: string }>>
    results?: Record<string, Record<string, string> | null>
  }

  const stageTeamsKey = stageKeyToStr(stageKey)
  const firestoreTeams = settings.teams?.[stageTeamsKey] ?? {}

  if (Object.keys(firestoreTeams).length === 0) {
    return { updated: [], skipped: [`No teams configured for ${stageTeamsKey}. Set teams first.`], resultsPayload: {} }
  }

  const games = await resolveGames(season, apiKey, fullSync, prefetchedGames)

  const isPlayIn = isPlayInStage(stageKey)
  const resultsPayload = buildResultsPayload(games, firestoreTeams, isPlayIn)

  const matchKeys = Object.keys(firestoreTeams)
  const updated: string[] = []
  const skipped: string[] = []

  for (const mk of matchKeys) {
    const hasResult = isPlayIn ? !!resultsPayload[mk] : !!resultsPayload[`${mk}_winner`]
    if (hasResult) updated.push(mk)
    else skipped.push(mk)
  }

  if (updated.length > 0) {
    const existingResults = (settings.results?.[stageTeamsKey] ?? {}) as Record<string, string>
    await db.doc('global/settings').update({
      [`results.${stageTeamsKey}`]: { ...existingResults, ...resultsPayload },
    })
  }

  return { updated, skipped, resultsPayload }
}

export const syncResults = functions.https.onCall(async (data, context) => {
  if (!context.auth?.uid) throw new functions.https.HttpsError('unauthenticated', 'Login required')
  if (context.auth.uid !== SUPER_ADMIN_UID) throw new functions.https.HttpsError('permission-denied', 'Super admin only')

  const { season = 2025, stageKey = 1, fullSync = true } =
    (data ?? {}) as { season?: number; stageKey?: StageKeyInput; fullSync?: boolean }

  const apiKey = getRapidApiKey()
  const result = await runSync(season, stageKey as StageKeyInput, apiKey, fullSync)
  return { ok: true, ...result }
})

/**
 * Automatic hourly sync — runs 09:00–23:00 Israel time every day.
 *
 * Games in the NBA playoffs are typically played 19:30–04:00 Israel time, so
 * results from overnight games are ready when the 09:00 run fires. Subsequent
 * hourly runs pick up any in-progress series that finish during the day.
 *
 * A single fetchSeasonGames() call is made per run and its output is shared
 * between the team sync, results sync, and bracket sync steps — no duplicate
 * API calls within the same run.
 */
export const scheduledNBASync = functions.pubsub
  .schedule('0 9-23 * * *')
  .timeZone('Asia/Jerusalem')
  .onRun(async () => {
    const db = getFirestore()
    const settingsSnap = await db.doc('global/settings').get()
    if (!settingsSnap.exists) return

    const settings = settingsSnap.data() as {
      currentStage?: StageKeyInput
      stageLocked?: boolean[]
    }

    const currentStage = settings.currentStage ?? 1
    const stageOrder: StageKeyInput[] = [0, '0b', 1, 2, 3, 4]
    const stageIdx = stageOrder.indexOf(currentStage as StageKeyInput)
    if (stageIdx < 0) return

    const isLocked = (settings.stageLocked ?? [])[stageIdx] ?? false
    const apiKey = getRapidApiKey()

    // Fetch all season games once — shared across all three steps below.
    // allGames: every game regardless of status (needed for bracket schedule).
    // playoffGames: finished playoff games only (needed for teams + results).
    let allGames: NBAGame[] = []
    let playoffGames: NBAGame[] = []
    try {
      allGames = await fetchSeasonGames(2025, apiKey)
      playoffGames = filterPlayoffGames(allGames, 2025)
      console.log(`scheduledNBASync: fetched ${allGames.length} total games, ${playoffGames.length} finished playoffs`)
    } catch (err) {
      console.error('scheduledNBASync: game fetch failed', err)
      return
    }

    // 1. Sync stage-by-stage teams from finished games
    try {
      const teamsPayload = buildTeamsPayload(playoffGames)
      if (Object.keys(teamsPayload).length > 0) {
        const updates: Record<string, unknown> = {}
        for (const [stageKey, stageTeams] of Object.entries(teamsPayload)) {
          updates[`teams.${stageKey}`] = stageTeams
        }
        await db.doc('global/settings').update(updates)
        console.log('scheduledNBASync: teams updated for', Object.keys(teamsPayload).join(', '))
      }
    } catch (err) {
      console.error('scheduledNBASync: team sync failed', err)
    }

    // 2. Sync results for current stage — pass the already-fetched playoffGames
    //    so no second API call is needed.
    if (!isLocked) {
      try {
        const result = await runSync(2025, currentStage as StageKeyInput, apiKey, true, playoffGames)
        if (result.updated.length > 0) {
          console.log('scheduledNBASync: results updated for', result.updated.join(', '))
        } else {
          console.log('scheduledNBASync: no new results for stage', currentStage, '— skipped:', result.skipped.join(', '))
        }
      } catch (err) {
        console.error('scheduledNBASync: results sync failed', err)
      }
    } else {
      console.log('scheduledNBASync: stage', currentStage, 'is locked — skipping results sync')
    }

    // 3. Sync bracket data — uses ALL games (finished + upcoming) for win counts + schedule.
    //    Re-read settings so bracket gets the teams written in step 1.
    try {
      const settingsForBracket = (await db.doc('global/settings').get()).data() as {
        teams?: Record<string, Record<string, { home: string; away: string }>>
      }
      const stage1Teams = settingsForBracket?.teams?.stage1 ?? {}
      const bracketSeries = buildBracketSeriesState(allGames, stage1Teams)
      await db.doc('global/settings').update({ bracketSeries })
    } catch (err) {
      console.error('scheduledNBASync: bracket sync failed', err)
    }
  })
