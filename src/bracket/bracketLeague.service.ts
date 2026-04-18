import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  deleteDoc,
  deleteField,
  query,
  collection,
  where,
  arrayUnion,
  arrayRemove,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UserDoc } from '@/store/auth.store'
import type { BracketPick, BracketMvpPick } from './bracketConstants'

export const GLOBAL_BRACKET_LEAGUE_ID = 'bl_global'

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// ── Global league ─────────────────────────────────────────────────────────────

/**
 * Idempotently enroll the user in the global bracket league.
 * Creates the league document if it does not exist yet.
 */
export async function ensureGlobalLeagueMember(
  user: { uid: string },
  userDoc: UserDoc,
): Promise<void> {
  const ref = doc(db, 'bracket_leagues', GLOBAL_BRACKET_LEAGUE_ID)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      id: GLOBAL_BRACKET_LEAGUE_ID,
      name: 'ליגה גלובלית',
      code: 'GLOBAL',
      adminUid: user.uid,  // must equal request.auth.uid for create rule
      members: [user.uid],
      memberInfo: {
        [user.uid]: { username: userDoc.username, displayName: userDoc.displayName },
      },
      bets: {},
      isGlobal: true,
      createdAt: serverTimestamp(),
    })
  } else {
    const data = snap.data()
    if (!(data.members as string[]).includes(user.uid)) {
      await updateDoc(ref, {
        members: arrayUnion(user.uid),
        [`memberInfo.${user.uid}`]: { username: userDoc.username, displayName: userDoc.displayName },
      })
    }
  }
  await updateDoc(doc(db, 'users', user.uid), {
    bracketLeagues: arrayUnion(GLOBAL_BRACKET_LEAGUE_ID),
  })
}

// ── Private leagues ───────────────────────────────────────────────────────────

export async function createBracketLeague(
  name: string,
  user: { uid: string },
  userDoc: UserDoc
): Promise<{ lid: string; code: string }> {
  let code = ''
  let tries = 0
  do {
    code = generateCode()
    const s = await getDocs(
      query(collection(db, 'bracket_leagues'), where('code', '==', code))
    )
    if (s.empty) break
    tries++
  } while (tries < 10)

  const lid = `bl_${Date.now()}_${user.uid.slice(0, 6)}`
  await setDoc(doc(db, 'bracket_leagues', lid), {
    id: lid,
    name,
    code,
    adminUid: user.uid,
    members: [user.uid],
    memberInfo: {
      [user.uid]: { username: userDoc.username, displayName: userDoc.displayName },
    },
    bets: {},
    createdAt: serverTimestamp(),
  })
  await updateDoc(doc(db, 'users', user.uid), { bracketLeagues: arrayUnion(lid) })
  return { lid, code }
}

export async function joinBracketLeague(
  code: string,
  user: { uid: string },
  userDoc: UserDoc
): Promise<string> {
  const snap = await getDocs(
    query(collection(db, 'bracket_leagues'), where('code', '==', code))
  )
  if (snap.empty) throw new Error('LEAGUE_NOT_FOUND')
  const leagueDoc = snap.docs[0]
  const ld = leagueDoc.data()
  const lid = leagueDoc.id
  if (!ld.members.includes(user.uid)) {
    await updateDoc(doc(db, 'bracket_leagues', lid), {
      members: arrayUnion(user.uid),
      [`memberInfo.${user.uid}`]: { username: userDoc.username, displayName: userDoc.displayName },
    })
    await updateDoc(doc(db, 'users', user.uid), { bracketLeagues: arrayUnion(lid) })
  }
  return lid
}

export async function loadMyBracketLeagues(uid: string): Promise<Record<string, unknown>[]> {
  const uSnap = await getDoc(doc(db, 'users', uid))
  const ids: string[] = uSnap.data()?.bracketLeagues || []
  if (!ids.length) return []
  const docs = await Promise.all(ids.map((id) => getDoc(doc(db, 'bracket_leagues', id))))
  return docs.filter((d) => d.exists()).map((d) => ({ id: d.id, ...d.data() }))
}

/**
 * Load lightweight league metadata (id, name, members only) for the league selector.
 * Always ensures the global league is included as the first entry.
 */
export async function loadMyBracketLeaguesMeta(
  uid: string,
): Promise<{ id: string; name: string; members: string[] }[]> {
  const uSnap = await getDoc(doc(db, 'users', uid))
  const ids: string[] = uSnap.data()?.bracketLeagues || []

  // Always include global league even if not yet in user's list
  const allIds = ids.includes(GLOBAL_BRACKET_LEAGUE_ID)
    ? ids
    : [GLOBAL_BRACKET_LEAGUE_ID, ...ids]

  const docs = await Promise.all(allIds.map((id) => getDoc(doc(db, 'bracket_leagues', id))))
  const results = docs
    .filter((d) => d.exists())
    .map((d) => ({
      id: d.id,
      name: d.id === GLOBAL_BRACKET_LEAGUE_ID ? 'ליגה גלובלית' : (d.data()!.name as string),
      members: (d.data()!.members as string[]) || [],
    }))

  // Sort: global league first
  return [
    ...results.filter((r) => r.id === GLOBAL_BRACKET_LEAGUE_ID),
    ...results.filter((r) => r.id !== GLOBAL_BRACKET_LEAGUE_ID),
  ]
}

// ── Bet operations (always target global league) ──────────────────────────────

export async function saveBracketBet(
  uid: string,
  pick: BracketPick
): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', GLOBAL_BRACKET_LEAGUE_ID), {
    [`bets.${uid}`]: pick,
  })
}

export async function clearBracketBet(uid: string): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', GLOBAL_BRACKET_LEAGUE_ID), {
    [`bets.${uid}`]: {},
  })
}

export async function saveMvpBet(
  uid: string,
  seriesKey: 'cf_east' | 'cf_west' | 'finals',
  player: string,
): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', GLOBAL_BRACKET_LEAGUE_ID), {
    [`mvpBets.${uid}.${seriesKey}`]: player,
  })
}

export async function clearMvpBet(
  uid: string,
  seriesKey: 'cf_east' | 'cf_west' | 'finals',
): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', GLOBAL_BRACKET_LEAGUE_ID), {
    [`mvpBets.${uid}.${seriesKey}`]: deleteField(),
  })
}

export async function saveTiebreakerBet(uid: string, answer: number | null): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', GLOBAL_BRACKET_LEAGUE_ID), {
    [`tiebreakerBets.${uid}`]: answer,
  })
}

// ── Admin functions ───────────────────────────────────────────────────────────

export async function loadAllBracketLeagues(): Promise<Record<string, unknown>[]> {
  const snap = await getDocs(collection(db, 'bracket_leagues'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getBracketLeagueFromServer(lid: string): Promise<Record<string, unknown> | null> {
  const snap = await getDoc(doc(db, 'bracket_leagues', lid))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export async function removeBracketLeagueMember(lid: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', lid), {
    members: arrayRemove(uid),
    [`memberInfo.${uid}`]: deleteField(),
  })
  // Remove bets from global league when removed from private league only if also removed from global
  // (member removal from private league should not affect their global bets)
  try {
    await updateDoc(doc(db, 'users', uid), { bracketLeagues: arrayRemove(lid) })
  } catch { /* user doc may not exist */ }
}

export async function removeMemberFromGlobalLeague(uid: string): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', GLOBAL_BRACKET_LEAGUE_ID), {
    members: arrayRemove(uid),
    [`memberInfo.${uid}`]: deleteField(),
    [`bets.${uid}`]: deleteField(),
    [`mvpBets.${uid}`]: deleteField(),
  })
  try {
    await updateDoc(doc(db, 'users', uid), {
      bracketLeagues: arrayRemove(GLOBAL_BRACKET_LEAGUE_ID),
    })
  } catch { /* user doc may not exist */ }
}

export async function relinkBracketLeagueMember(
  lid: string,
  oldUid: string,
  newUid: string,
): Promise<void> {
  const snap = await getDoc(doc(db, 'bracket_leagues', lid))
  if (!snap.exists()) throw new Error('Bracket league not found')
  const data = snap.data() as Record<string, unknown>

  const members = ((data.members as string[]) || []).map((u) => (u === oldUid ? newUid : u))

  function remapKeys(obj: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) out[k === oldUid ? newUid : k] = v
    return out
  }

  const update: Record<string, unknown> = {
    members,
    memberInfo: remapKeys((data.memberInfo as Record<string, unknown>) || {}),
  }
  // Only remap bets if this is the global league
  if (lid === GLOBAL_BRACKET_LEAGUE_ID) {
    update.bets = remapKeys((data.bets as Record<string, unknown>) || {})
    update.mvpBets = remapKeys((data.mvpBets as Record<string, unknown>) || {})
  }

  await updateDoc(doc(db, 'bracket_leagues', lid), update)
}

/** Admin: save a user's bracket pick to the global league */
export async function adminSaveBracketBet(uid: string, pick: BracketPick): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', GLOBAL_BRACKET_LEAGUE_ID), {
    [`bets.${uid}`]: pick,
  })
}

export async function deleteBracketLeague(lid: string, memberUids: string[]): Promise<void> {
  await Promise.all(
    memberUids.map((uid) =>
      updateDoc(doc(db, 'users', uid), { bracketLeagues: arrayRemove(lid) })
    )
  )
  await deleteDoc(doc(db, 'bracket_leagues', lid))
}
