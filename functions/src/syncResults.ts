import * as functions from 'firebase-functions'
import { getFirestore } from 'firebase-admin/firestore'
import { getRapidApiKey } from './secrets'
import { SUPER_ADMIN_UID } from './constants'
import { fetchSeasonGames, fetchGamesByDate, filterPlayoffGames } from './nbaApi'
import type { NBAGame } from './nbaApi'
import { buildResultsPayload } from './teamMap'

type StageKeyInput = 0 | '0b' | 1 | 2 | 3 | 4

function stageKeyToStr(sk: StageKeyInput): string {
  return sk === '0b' ? 'stage0b' : `stage${sk}`
}

function isPlayInStage(sk: StageKeyInput): boolean {
  return sk === 0 || sk === '0b'
}

async function runSync(
  season: number,
  stageKey: StageKeyInput,
  apiKey: string,
  fullSync: boolean,
): Promise<{ updated: string[]; skipped: string[]; resultsPayload: Record<string, string> }> {
  const db = getFirestore()

  const settingsSnap = await db.doc('global/settings').get()
  if (!settingsSnap.exists) return { updated: [], skipped: ['no settings doc'], resultsPayload: {} }
  const settings = settingsSnap.data() as {
    teams?: Record<string, Record<string, { home: string; away: string }>>
  }

  const stageTeamsKey = stageKeyToStr(stageKey)
  const firestoreTeams = settings.teams?.[stageTeamsKey] ?? {}

  if (Object.keys(firestoreTeams).length === 0) {
    return { updated: [], skipped: [`No teams configured for ${stageTeamsKey}. Set teams first.`], resultsPayload: {} }
  }

  let games: NBAGame[]
  if (fullSync) {
    const allGames = await fetchSeasonGames(season, apiKey)
    games = filterPlayoffGames(allGames, season)
  } else {
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    const [todayGames, yesterdayGames] = await Promise.all([
      fetchGamesByDate(fmt(today), season, apiKey),
      fetchGamesByDate(fmt(yesterday), season, apiKey),
    ])
    games = filterPlayoffGames([...todayGames, ...yesterdayGames], season)
  }

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
    const existingResults =
      (settingsSnap.data() as { results?: Record<string, Record<string, string> | null> })
        .results?.[stageTeamsKey] ?? {}
    await db.doc('global/settings').update({
      [`results.${stageTeamsKey}`]: { ...(existingResults as Record<string, string>), ...resultsPayload },
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

export const scheduledNBASync = functions.pubsub
  .schedule('30 23 * * *')
  .timeZone('UTC')
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
    if (isLocked) return

    const apiKey = getRapidApiKey()
    await runSync(2025, currentStage as StageKeyInput, apiKey, false)
  })
