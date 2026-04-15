import { doc, getDoc, setDoc, updateDoc, deleteField, runTransaction } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { STAGE_KEYS, STAGE_MATCHES } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'
import type { GlobalData } from '@/store/global.store'

export async function saveTiebreakerQuestion(question: string) {
  await setDoc(doc(db, 'global', 'settings'), { tiebreakerQuestion: question }, { merge: true })
}

export async function saveTiebreakerAnswer(answer: number | null) {
  await setDoc(doc(db, 'global', 'settings'), { tiebreakerAnswer: answer }, { merge: true })
}

export async function setCurrentStage(stage: StageKey) {
  await setDoc(doc(db, 'global', 'settings'), { currentStage: stage }, { merge: true })
}

export async function toggleStageLock(
  stage: StageKey,
  globalData: GlobalData
) {
  const sIdx = STAGE_KEYS.indexOf(stage)
  const newLocked = [...(globalData.stageLocked || [false, false, false, false, false, false])]
  while (newLocked.length < 6) newLocked.push(false)
  const locking = !newLocked[sIdx]
  newLocked[sIdx] = locking
  // Use updateDoc so the write is an atomic patch:
  // - stageLocked array is written whole (Firestore has no array-element dot-notation)
  // - each seriesLocked entry is written with its own dot-notation path so concurrent
  //   writes to *different* series keys never overwrite each other
  const updates: Record<string, unknown> = { stageLocked: newLocked }
  if (STAGE_MATCHES[stage]) {
    for (const m of STAGE_MATCHES[stage]) {
      updates[`seriesLocked.${stage}_${m.key}`] = locking
    }
  }
  await updateDoc(doc(db, 'global', 'settings'), updates)
  return locking
}

export async function toggleSeriesLock(
  stage: StageKey,
  matchKey: string,
  globalData: GlobalData
) {
  const curSL = globalData.seriesLocked || {}
  const lockKey = stage + '_' + matchKey
  const newVal = !curSL[lockKey]
  // Atomic dot-notation write — only touches this one key.
  // The old setDoc+spread pattern replaced the entire seriesLocked map, causing
  // concurrent calls (e.g. multiple auto-locks firing at the same tick) to
  // overwrite each other and produce random lock/unlock side effects.
  await updateDoc(doc(db, 'global', 'settings'), {
    [`seriesLocked.${lockKey}`]: newVal,
  })
  return newVal
}

export async function saveTeams(
  stage: StageKey,
  stageTeams: Record<string, { home: string; away: string }>,
  globalData: GlobalData
) {
  const currentTeams = globalData.teams || {}
  const newTeams = { ...currentTeams, [`stage${stage}`]: stageTeams }
  await setDoc(doc(db, 'global', 'settings'), { teams: newTeams }, { merge: true })
}

export async function saveResults(
  stage: StageKey,
  result: Record<string, string> | null,
  bonusBetsList: { id: string }[],
  bonusResults: Record<string, string>,
  globalData: GlobalData
) {
  const bKey = getBonusStageKey(stage)
  const savePayload: Record<string, unknown> = {
    results: { [`stage${stage}`]: result },
  }
  if (bonusBetsList.length) {
    const bonusResultsToSave: Record<string, string> = {}
    for (const b of bonusBetsList) {
      if (bonusResults[b.id]) bonusResultsToSave[b.id] = bonusResults[b.id]
    }
    savePayload.bonusResults = { [bKey]: bonusResultsToSave }
  }
  await setDoc(doc(db, 'global', 'settings'), savePayload, { merge: true })

  // Auto-lock the stage when results saved
  if (result) {
    const sIdx = STAGE_KEYS.indexOf(stage)
    if (sIdx >= 0) {
      const newLocked = [
        ...(globalData.stageLocked || [false, false, false, false, false, false]),
      ]
      while (newLocked.length < 6) newLocked.push(false)
      newLocked[sIdx] = true
      await setDoc(doc(db, 'global', 'settings'), { stageLocked: newLocked }, { merge: true })
    }
  }
}

export async function resetStageResults(stage: StageKey) {
  const bKey = getBonusStageKey(stage)
  await setDoc(
    doc(db, 'global', 'settings'),
    { results: { [`stage${stage}`]: null }, bonusResults: { [bKey]: {} } },
    { merge: true }
  )
}

export async function savePreBetResults(
  resultUpdates: Record<string, string>,
  globalData: GlobalData
) {
  const existing1 = (globalData.results || {})['stage1'] || {}
  await setDoc(
    doc(db, 'global', 'settings'),
    { results: { stage1: { ...existing1, ...resultUpdates } } },
    { merge: true }
  )
}

export async function saveBonusBets(
  stage: StageKey,
  bonuses: unknown[]
) {
  const bKey = getBonusStageKey(stage)
  await setDoc(
    doc(db, 'global', 'settings'),
    { bonusBets: { [bKey]: bonuses } },
    { merge: true }
  )
}

export async function addAutoLock(targetVal: string, timestamp: number) {
  await updateDoc(doc(db, 'global', 'settings'), {
    [`autoLocks.${targetVal}`]: timestamp,
  })
}

export async function removeAutoLock(key: string) {
  // Use deleteField() on the specific map key — avoids the read-modify-write
  // race condition and correctly removes the entry even if globalData is stale.
  await updateDoc(doc(db, 'global', 'settings'), {
    [`autoLocks.${key}`]: deleteField(),
  })
}

export async function initGlobalSettingsIfNeeded(globalData: GlobalData) {
  if (!globalData.stageLocked) {
    await setDoc(
      doc(db, 'global', 'settings'),
      {
        currentStage: 0,
        stageLocked: [false, false, false, false, false, false],
        seriesLocked: {},
        teams: { stage0: {}, stage0b: {}, stage1: {}, stage2: {}, stage3: {}, stage4: {} },
        results: { stage0: null, stage0b: null, stage1: null, stage2: null, stage3: null, stage4: null },
        bonusBets: { stage0: [] },
        bonusResults: { stage0: {} },
      },
      { merge: true }
    )
  }
}

export async function saveBet(
  leagueId: string,
  uid: string,
  stage: StageKey,
  betData: Record<string, string>
) {
  await updateDoc(doc(db, 'leagues', leagueId), {
    [`bets.${uid}.stage${stage}`]: betData,
  })
}

/**
 * Admin-only bet override.
 *
 * Uses a Firestore transaction that reads the full league document, merges the
 * new bets for this user+stage, and writes back the entire `bets` map as a
 * plain top-level field (no dot-notation at all).
 *
 * This is the most reliable approach because:
 * - Dot-notation paths (bets.uid or bets.uid.stageN) fail when any intermediate
 *   field is null, missing, or a non-map type (old app data, corrupted data).
 * - Writing `bets` as a whole top-level field bypasses all path resolution.
 * - The transaction prevents races if any other client writes concurrently.
 * - Returns the verified post-write bets data so the caller can confirm the write.
 */
export async function adminSaveBet(
  leagueId: string,
  uid: string,
  stage: StageKey,
  betData: Record<string, string>
): Promise<Record<string, unknown>> {
  const ref = doc(db, 'leagues', leagueId)

  let writtenUserBets: Record<string, unknown> = {}

  await runTransaction(db, async (t) => {
    const snap = await t.get(ref)
    if (!snap.exists()) throw new Error('ליגה לא נמצאה')
    const d = snap.data()

    // Clone the entire bets map so we don't mutate Firestore snapshot data
    const allBets: Record<string, unknown> = { ...(d.bets ?? {}) }

    // Normalize this user's slot — discard non-map values (null, string, array)
    // that would cause nested dot-notation writes to fail
    const rawUserBets = allBets[uid]
    const currentUserBets: Record<string, unknown> =
      rawUserBets !== null &&
      rawUserBets !== undefined &&
      typeof rawUserBets === 'object' &&
      !Array.isArray(rawUserBets)
        ? { ...(rawUserBets as Record<string, unknown>) }
        : {}

    // MERGE new data into the existing stage bets — do NOT replace the whole stage.
    // Replacing would wipe fields the admin didn't touch (e.g. the admin edits e4_winner
    // but all other series' bets should survive unchanged).
    const existingStage = currentUserBets[`stage${stage}`]
    const existingStageSafe: Record<string, unknown> =
      existingStage !== null && existingStage !== undefined &&
      typeof existingStage === 'object' && !Array.isArray(existingStage)
        ? { ...(existingStage as Record<string, unknown>) }
        : {}
    currentUserBets[`stage${stage}`] = { ...existingStageSafe, ...betData }
    allBets[uid] = currentUserBets
    writtenUserBets = currentUserBets

    // Write bets as a whole top-level field — NO dot-notation, no path issues
    t.update(ref, { bets: allBets })
  })

  return writtenUserBets
}

export async function clearBet(leagueId: string, uid: string, stage: StageKey) {
  await updateDoc(doc(db, 'leagues', leagueId), {
    [`bets.${uid}.stage${stage}`]: null,
  })
}

export function getBonusStageKey(si: StageKey): string {
  return si === 0 || si === '0b' ? 'stage0' : `stage${si}`
}

export async function saveEmailJSSettings(serviceId: string, templateId: string, publicKey: string) {
  await setDoc(doc(db, 'global', 'settings'), {
    emailjsServiceId: serviceId,
    emailjsTemplateId: templateId,
    emailjsPublicKey: publicKey,
  }, { merge: true })
}

export async function saveTiebreakerLocked(locked: boolean) {
  await setDoc(doc(db, 'global', 'settings'), { tiebreakerLocked: locked }, { merge: true })
}
