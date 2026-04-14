import { doc, setDoc, updateDoc } from 'firebase/firestore'
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
  const updates: Record<string, unknown> = { stageLocked: newLocked }
  if (STAGE_MATCHES[stage]) {
    const curSL = globalData.seriesLocked || {}
    const newSL = { ...curSL }
    for (const m of STAGE_MATCHES[stage]) newSL[stage + '_' + m.key] = locking
    updates.seriesLocked = newSL
  }
  await setDoc(doc(db, 'global', 'settings'), updates, { merge: true })
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
  await setDoc(
    doc(db, 'global', 'settings'),
    { seriesLocked: { ...curSL, [lockKey]: newVal } },
    { merge: true }
  )
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

export async function addAutoLock(
  targetVal: string,
  timestamp: number,
  globalData: GlobalData
) {
  const curLocks = globalData.autoLocks || {}
  await setDoc(
    doc(db, 'global', 'settings'),
    { autoLocks: { ...curLocks, [targetVal]: timestamp } },
    { merge: true }
  )
}

export async function removeAutoLock(key: string, globalData: GlobalData) {
  const curLocks = { ...(globalData.autoLocks || {}) }
  delete curLocks[key]
  await setDoc(doc(db, 'global', 'settings'), { autoLocks: curLocks }, { merge: true })
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

export async function fetchESPNScores(dateVal: string) {
  const url = `https://corsproxy.io/?${encodeURIComponent(
    `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${dateVal}&limit=20`
  )}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error('Failed to fetch')
  const data = await resp.json()
  return (data.events || []).filter(
    (e: { status?: { type?: { completed?: boolean } } }) => e.status?.type?.completed
  )
}
