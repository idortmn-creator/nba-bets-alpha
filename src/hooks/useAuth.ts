import { useEffect, useRef } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
import { doc, onSnapshot } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { getUserDoc, ensureGoogleUserDoc } from '@/services/auth.service'
import { STAGE_KEYS } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

export function useAuth() {
  const { setUser, setUserDoc } = useAuthStore()
  const { setGlobalData, globalData } = useGlobalStore()
  const globalUnsub = useRef<(() => void) | null>(null)
  const autoLockInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUser(user)
        const udoc = await getUserDoc(user.uid)
        if (udoc) {
          setUserDoc({
            uid: user.uid,
            displayName: udoc.displayName || user.displayName || '',
            username: udoc.username || user.email || '',
            email: udoc.email || user.email || '',
            leagues: udoc.leagues,
          })
        } else if (user.providerData.some((p) => p.providerId === 'google.com')) {
          // First Google sign-in — create the user doc
          const created = await ensureGoogleUserDoc(user)
          setUserDoc({
            uid: user.uid,
            displayName: created.displayName,
            username: created.username,
            email: created.email,
            leagues: [],
          })
        }
        // Start global listener
        if (!globalUnsub.current) {
          globalUnsub.current = onSnapshot(doc(db, 'global', 'settings'), (snap) => {
            setGlobalData(snap.exists() ? (snap.data() as Record<string, unknown>) : {})
          })
        }
        // Start auto-lock checker
        startAutoLockChecker()
      } else {
        setUser(null)
        setUserDoc(null)
        if (globalUnsub.current) {
          globalUnsub.current()
          globalUnsub.current = null
        }
        stopAutoLockChecker()
      }
    })

    return () => {
      unsub()
      if (globalUnsub.current) globalUnsub.current()
      stopAutoLockChecker()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startAutoLockChecker() {
    if (autoLockInterval.current) return
    autoLockInterval.current = setInterval(() => {
      const gd = useGlobalStore.getState().globalData
      const locks = gd.autoLocks || {}
      const now = Date.now()
      for (const [key, ts] of Object.entries(locks)) {
        if (typeof ts !== 'number' || ts > now) continue
        // Check if already locked
        if (key.startsWith('series_')) {
          const parts = key.split('_')
          const si = parseInt(parts[1]) as StageKey
          const mk = parts[2]
          const sl = gd.seriesLocked || {}
          if (sl[si + '_' + mk]) continue
          // Lock it
          import('@/services/global.service').then((svc) =>
            svc.toggleSeriesLock(si, mk, gd)
          )
        } else {
          const normKey = key === '0b' ? '0b' : (parseInt(key) as StageKey)
          const sIdx = STAGE_KEYS.indexOf(normKey)
          const sl = gd.stageLocked || []
          if (sl[sIdx]) continue
          import('@/services/global.service').then((svc) =>
            svc.toggleStageLock(normKey, gd)
          )
        }
      }
    }, 30000)
  }

  function stopAutoLockChecker() {
    if (autoLockInterval.current) {
      clearInterval(autoLockInterval.current)
      autoLockInterval.current = null
    }
  }

  return useAuthStore()
}
