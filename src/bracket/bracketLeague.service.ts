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

function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

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

export async function saveBracketBet(
  lid: string,
  uid: string,
  pick: BracketPick
): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', lid), {
    [`bets.${uid}`]: pick,
  })
}

export async function clearBracketBet(lid: string, uid: string): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', lid), {
    [`bets.${uid}`]: {},
  })
}

export async function saveMvpBet(
  lid: string,
  uid: string,
  seriesKey: 'cf_east' | 'cf_west' | 'finals',
  player: string,
): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', lid), {
    [`mvpBets.${uid}.${seriesKey}`]: player,
  })
}

export async function clearMvpBet(
  lid: string,
  uid: string,
  seriesKey: 'cf_east' | 'cf_west' | 'finals',
): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', lid), {
    [`mvpBets.${uid}.${seriesKey}`]: deleteField(),
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
    [`bets.${uid}`]: deleteField(),
    [`mvpBets.${uid}`]: deleteField(),
  })
  try {
    await updateDoc(doc(db, 'users', uid), { bracketLeagues: arrayRemove(lid) })
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

  await updateDoc(doc(db, 'bracket_leagues', lid), {
    members,
    memberInfo: remapKeys((data.memberInfo as Record<string, unknown>) || {}),
    bets: remapKeys((data.bets as Record<string, unknown>) || {}),
    mvpBets: remapKeys((data.mvpBets as Record<string, unknown>) || {}),
  })
}

export async function adminSaveBracketBet(lid: string, uid: string, pick: BracketPick): Promise<void> {
  await updateDoc(doc(db, 'bracket_leagues', lid), { [`bets.${uid}`]: pick })
}

export async function deleteBracketLeague(lid: string, memberUids: string[]): Promise<void> {
  await Promise.all(
    memberUids.map((uid) =>
      updateDoc(doc(db, 'users', uid), { bracketLeagues: arrayRemove(lid) })
    )
  )
  await deleteDoc(doc(db, 'bracket_leagues', lid))
}
