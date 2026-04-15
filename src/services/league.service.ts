import {
  doc,
  getDoc,
  getDocFromServer,
  setDoc,
  updateDoc,
  getDocs,
  getDocsFromServer,
  deleteDoc,
  query,
  collection,
  where,
  arrayUnion,
  arrayRemove,
  deleteField,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import type { UserDoc } from '@/store/auth.store'

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function createLeague(name: string, user: { uid: string }, userDoc: UserDoc) {
  let code = ''
  let tries = 0
  do {
    code = generateCode()
    const s = await getDocs(
      query(collection(db, 'leagues'), where('code', '==', code))
    )
    if (s.empty) break
    tries++
  } while (tries < 10)

  const lid = `league_${Date.now()}_${user.uid.slice(0, 6)}`
  const ld = {
    id: lid,
    name,
    code,
    adminUid: user.uid,
    members: [user.uid],
    memberInfo: {
      [user.uid]: {
        username: userDoc.username,
        displayName: userDoc.displayName,
      },
    },
    currentStage: 0,
    stageLocked: [false, false, false, false, false, false],
    teams: {
      stage0: {},
      stage0b: {},
      stage1: {},
      stage2: {},
      stage3: {},
      stage4: {},
    },
    results: {
      stage0: null,
      stage0b: null,
      stage1: null,
      stage2: null,
      stage3: null,
      stage4: null,
    },
    bonusBets: { stage0: [] },
    bonusResults: { stage0: {} },
    bets: {},
    createdAt: serverTimestamp(),
  }
  await setDoc(doc(db, 'leagues', lid), ld)
  await updateDoc(doc(db, 'users', user.uid), { leagues: arrayUnion(lid) })
  return { lid, code }
}

export async function joinLeague(
  code: string,
  user: { uid: string },
  userDoc: UserDoc
) {
  const snap = await getDocs(
    query(collection(db, 'leagues'), where('code', '==', code))
  )
  if (snap.empty) throw new Error('LEAGUE_NOT_FOUND')
  const leagueDoc = snap.docs[0]
  const ld = leagueDoc.data()
  const lid = leagueDoc.id
  if (!ld.members.includes(user.uid)) {
    await updateDoc(doc(db, 'leagues', lid), {
      members: arrayUnion(user.uid),
      [`memberInfo.${user.uid}`]: {
        username: userDoc.username,
        displayName: userDoc.displayName,
      },
    })
    await updateDoc(doc(db, 'users', user.uid), { leagues: arrayUnion(lid) })
  }
  return lid
}

export async function loadMyLeagues(uid: string) {
  const uSnap = await getDoc(doc(db, 'users', uid))
  const ids: string[] = uSnap.data()?.leagues || []
  if (!ids.length) return []
  const docs = await Promise.all(ids.map((id) => getDoc(doc(db, 'leagues', id))))
  return docs.filter((d) => d.exists()).map((d) => ({ id: d.id, ...d.data() }))
}

export async function openLeague(lid: string) {
  const snap = await getDoc(doc(db, 'leagues', lid))
  if (!snap.exists()) throw new Error('LEAGUE_NOT_FOUND')
  return { id: snap.id, ...snap.data() }
}

export async function loadAllLeagues() {
  // Force a server read so the admin always sees live data, not IndexedDB cache.
  // With persistentLocalCache, getDocs() can return stale cached data which would
  // cause the bet editor to show empty fields and then wipe real bets on save.
  const snap = await getDocsFromServer(collection(db, 'leagues'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

/** Read a single league document direct from the server (bypasses local cache). */
export async function getLeagueFromServer(lid: string) {
  const snap = await getDocFromServer(doc(db, 'leagues', lid))
  if (!snap.exists()) throw new Error('ליגה לא נמצאה')
  return { id: snap.id, ...snap.data() }
}

export async function deleteLeague(lid: string, memberUids: string[]) {
  await Promise.all(
    memberUids.map((uid) =>
      updateDoc(doc(db, 'users', uid), { leagues: arrayRemove(lid) })
    )
  )
  await deleteDoc(doc(db, 'leagues', lid))
}

export async function removeUserFromLeague(lid: string, uid: string) {
  await updateDoc(doc(db, 'leagues', lid), {
    members: arrayRemove(uid),
    [`memberInfo.${uid}`]: deleteField(),
    [`bets.${uid}`]: deleteField(),
  })
  await updateDoc(doc(db, 'users', uid), { leagues: arrayRemove(lid) })
}

/**
 * League-admin variant: only updates the league doc.
 * Does NOT update users/{uid}.leagues because Firestore rules
 * prevent a league admin from writing to other users' docs.
 * The removed user's leagues array is not cleaned up client-side;
 * they will no longer appear as a member of the league.
 */
export async function removeLeagueMemberByAdmin(lid: string, uid: string) {
  await updateDoc(doc(db, 'leagues', lid), {
    members: arrayRemove(uid),
    [`memberInfo.${uid}`]: deleteField(),
    [`bets.${uid}`]: deleteField(),
  })
}

/**
 * Super-admin operation: replace all references to `oldUid` with `newUid` in
 * a league document (members[], memberInfo map, bets map).
 *
 * Use when a participant's Firebase Auth UID changed (account re-created or
 * different auth provider) so their current UID is no longer in members[].
 */
export async function relinkLeagueMember(
  lid: string,
  oldUid: string,
  newUid: string
) {
  const snap = await getDoc(doc(db, 'leagues', lid))
  if (!snap.exists()) throw new Error('ליגה לא נמצאה')
  const data = snap.data()

  const members: string[] = data.members || []
  if (!members.includes(oldUid)) throw new Error('ה-UID הישן לא נמצא ב-members')
  if (members.includes(newUid)) throw new Error('ה-UID החדש כבר קיים ב-members')

  const memberInfo = data.memberInfo || {}
  const bets = data.bets || {}
  const newMembers = members.map((uid) => (uid === oldUid ? newUid : uid))

  await updateDoc(doc(db, 'leagues', lid), {
    members: newMembers,
    // memberInfo: copy entry to new key, delete old
    [`memberInfo.${newUid}`]: memberInfo[oldUid] ?? {},
    [`memberInfo.${oldUid}`]: deleteField(),
    // bets: copy all stage bets to new key, delete old
    [`bets.${newUid}`]: bets[oldUid] ?? {},
    [`bets.${oldUid}`]: deleteField(),
  })

  // Best-effort: add league to the new user's leagues list
  try {
    await updateDoc(doc(db, 'users', newUid), { leagues: arrayUnion(lid) })
  } catch {
    // New user doc may not exist yet — harmless, they can still bet
  }
}
