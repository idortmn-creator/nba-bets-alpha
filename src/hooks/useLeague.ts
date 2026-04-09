import { useRef, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useLeagueStore } from '@/store/league.store'
import type { LeagueData } from '@/store/league.store'

export function useLeague() {
  const { setLeague, setLeagueData } = useLeagueStore()
  const unsubRef = useRef<(() => void) | null>(null)

  const openLeague = useCallback(
    (lid: string) => {
      if (unsubRef.current) unsubRef.current()
      setLeague(lid)
      unsubRef.current = onSnapshot(doc(db, 'leagues', lid), (snap) => {
        if (!snap.exists()) {
          setLeague(null)
          setLeagueData(null)
          return
        }
        setLeagueData({ id: snap.id, ...snap.data() } as LeagueData)
      })
    },
    [setLeague, setLeagueData]
  )

  const closeLeague = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
    setLeague(null)
    setLeagueData(null)
  }, [setLeague, setLeagueData])

  return { openLeague, closeLeague }
}
