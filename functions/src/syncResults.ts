import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { onSchedule } from 'firebase-functions/v2/scheduler'
import { getFirestore } from 'firebase-admin/firestore'
import { RAPIDAPI_KEY } from './secrets'
import { SUPER_ADMIN_UID } from './constants'
import { fetchSeasonGames, fetchGamesByDate, filterPlayoffGames } from './nbaApi'
import type { NBAGame } from './nbaApi'
import { buildResultsPayload } from './teamMap'

// Maps our StageKey values to the Firestore teams key (teams.stageX)
type StageKeyInput = 0 | '0b' | 1 | 2 | 3 | 4

function stageKeyToStr(sk: StageKeyInput): string {
  return sk === '0b' ? 'stage0b' : `stage${sk}`
}

function isPlayInStage(sk: StageKeyInput): boolean {
  return sk === 0 || sk === '0b'
}

interface SyncResultsRequest {
  season: number
  stageKey: StageKeyInput
  fullSync?: boolean // true = fetch full season; false = fetch today only (faster)
}

async function runSync(
  season: number,
  stageKey: StageKeyInput,
  apiKey: string,
  fullSync: boolean,
): Promise<{ updated: string[]; skipped: string[]; resultsPayload: Record<string, string> }> {
  const db = getFirestore()

  // Read current teams from Firestore for this stage
  const settingsSnap = await db.doc('global/settings').get()
  if (!settingsSnap.exists) return { updated: [], skipped: ['no settings doc'], resultsPayload: {} }
  const settings = settingsSnap.data() as {
    teams?: Record<string, Record<string, { home: string; away: string }>>
  }

  const stageTeamsKey = stageKeyToStr(stageKey)
  const firestoreTeams = settings.teams?.[stageTeamsKey] ?? {}

  if (Object.keys(firestoreTeams).length === 0) {
    return {
      updated: [],
      skipped: [`No teams configured for ${stageTeamsKey}. Set teams first.`],
      resultsPayload: {},
    }
  }

  // Fetch games from API
  let games: NBAGame[]
  if (fullSync) {
    const allGames = await fetchSeasonGames(season, apiKey)
    games = filterPlayoffGames(allGames, season)
  } else {
    // Daily sync: fetch yesterday + today (covers late-night games)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const [todayGames, yesterdayGames] = await Promise.all([
      fetchGamesByDate(fmt(today), season, apiKey),
      fetchGamesByDate(fmt(yesterday), season, apiKey),
    ])
    const allDateGames = [...todayGames, ...yesterdayGames]
    games = filterPlayoffGames(allDateGames, season)
  }

  const isPlayIn = isPlayInStage(stageKey)
  const resultsPayload = buildResultsPayload(games, firestoreTeams, isPlayIn)

  // Track which match keys were updated
  const matchKeys = Object.keys(firestoreTeams)
  const updated: string[] = []
  const skipped: string[] = []

  for (const mk of matchKeys) {
    const hasResult = isPlayIn
      ? !!resultsPayload[mk]
      : !!resultsPayload[`${mk}_winner`]
    if (hasResult) updated.push(mk)
    else skipped.push(mk)
  }

  // Write to Firestore (merge with existing results)
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

// ── Callable (manual sync from admin panel) ───────────────────────────────

export const syncResults = onCall(
  { secrets: [RAPIDAPI_KEY], region: 'us-central1' },
  async (request) => {
    if (!request.auth?.uid) throw new HttpsError('unauthenticated', 'Login required')
    if (request.auth.uid !== SUPER_ADMIN_UID) throw new HttpsError('permission-denied', 'Super admin only')

    const { season = 2025, stageKey = 1, fullSync = true } =
      (request.data ?? {}) as SyncResultsRequest

    const apiKey = RAPIDAPI_KEY.value()
    const result = await runSync(season, stageKey as StageKeyInput, apiKey, fullSync)

    return { ok: true, ...result }
  }
)

// ── Scheduled (auto-runs daily at 23:30 UTC) ──────────────────────────────
// Fetches only today's + yesterday's completed games — one API call per date.

export const scheduledNBASync = onSchedule(
  { schedule: '30 23 * * *', timeZone: 'UTC', secrets: [RAPIDAPI_KEY] },
  async () => {
    const db = getFirestore()
    const settingsSnap = await db.doc('global/settings').get()
    if (!settingsSnap.exists) return

    const settings = settingsSnap.data() as {
      currentStage?: StageKeyInput
      stageLocked?: boolean[]
    }

    // Only sync if a stage is active (not locked)
    const currentStage = settings.currentStage ?? 1
    const stageOrder: StageKeyInput[] = [0, '0b', 1, 2, 3, 4]
    const stageIdx = stageOrder.indexOf(currentStage as StageKeyInput)
    if (stageIdx < 0) return

    const isLocked = (settings.stageLocked ?? [])[stageIdx] ?? false
    if (isLocked) return // stage already locked — nothing to sync

    await runSync(2025, currentStage as StageKeyInput, RAPIDAPI_KEY.value(), false)
  }
)
