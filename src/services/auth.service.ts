import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  getDocs,
  query,
  collection,
  where,
  serverTimestamp,
} from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

export async function login(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  if (!cred.user.emailVerified) {
    await fbSignOut(auth)
    throw new Error('EMAIL_NOT_VERIFIED')
  }
  return cred.user
}

export async function register(
  name: string,
  username: string,
  email: string,
  password: string
) {
  const uQ = await getDocs(
    query(collection(db, 'users'), where('username', '==', username))
  )
  if (!uQ.empty) throw new Error('USERNAME_TAKEN')

  const cred = await createUserWithEmailAndPassword(auth, email, password)
  await updateProfile(cred.user, { displayName: name })
  await setDoc(doc(db, 'users', cred.user.uid), {
    uid: cred.user.uid,
    displayName: name,
    username,
    email,
    createdAt: serverTimestamp(),
  })
  await sendEmailVerification(cred.user)
  await fbSignOut(auth)
}

const googleProvider = new GoogleAuthProvider()

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export async function ensureGoogleUserDoc(user: User) {
  const base = (user.email || '').split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'user'
  let username = base
  let attempt = 0
  while (true) {
    const uQ = await getDocs(query(collection(db, 'users'), where('username', '==', username)))
    if (uQ.empty) break
    attempt++
    username = base + attempt
  }
  const data = {
    uid: user.uid,
    displayName: user.displayName || '',
    username,
    email: user.email || '',
    createdAt: serverTimestamp(),
    leagues: [],
  }
  await setDoc(doc(db, 'users', user.uid), data)
  return data
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email)
}

export async function resendVerification(email: string, password: string) {
  const cred = await signInWithEmailAndPassword(auth, email, password)
  if (cred.user.emailVerified) {
    await fbSignOut(auth)
    throw new Error('ALREADY_VERIFIED')
  }
  await sendEmailVerification(cred.user)
  await fbSignOut(auth)
}

export async function signOut() {
  await fbSignOut(auth)
}

export async function saveProfile(
  uid: string,
  name: string,
  username: string,
  currentUsername: string
) {
  if (username !== currentUsername) {
    const uQ = await getDocs(
      query(collection(db, 'users'), where('username', '==', username))
    )
    if (!uQ.empty) throw new Error('USERNAME_TAKEN')
  }
  const user = auth.currentUser
  if (!user) throw new Error('NOT_LOGGED_IN')
  await updateProfile(user, { displayName: name })
  await updateDoc(doc(db, 'users', uid), { displayName: name, username })
  // Update memberInfo in all leagues
  try {
    const leaguesSnap = await getDocs(
      query(collection(db, 'leagues'), where('members', 'array-contains', uid))
    )
    for (const ldoc of leaguesSnap.docs) {
      await updateDoc(ldoc.ref, {
        [`memberInfo.${uid}.username`]: username,
        [`memberInfo.${uid}.displayName`]: name,
      })
    }
  } catch {
    // non-critical
  }
}

export async function getUserDoc(uid: string) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

export async function changePassword(
  currentEmail: string,
  oldPassword: string,
  newPassword: string
) {
  const user = auth.currentUser
  if (!user) throw new Error('NOT_LOGGED_IN')
  const credential = EmailAuthProvider.credential(currentEmail, oldPassword)
  await reauthenticateWithCredential(user, credential)
  await updatePassword(user, newPassword)
}
