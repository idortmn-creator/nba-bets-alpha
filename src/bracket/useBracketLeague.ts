import { useRef, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useBracketLeagueStore } from './bracketLeague.store'
import type { BracketLeagueData } from './bracketLeague.store'

export function useBracketLeague() {
  const { setBracketLeague, setBracketLeagueData } = useBracketLeagueStore()
  const unsubRef = useRef<(() => void) | null>(null)

  const openBracketLeague = useCallback(
    (lid: string) => {
      if (unsubRef.current) unsubRef.current()
      setBracketLeague(lid)
      unsubRef.current = onSnapshot(doc(db, 'bracket_leagues', lid), (snap) => {
        if (!snap.exists()) {
          setBracketLeague(null)
          setBracketLeagueData(null)
          return
        }
        setBracketLeagueData({ id: snap.id, ...snap.data() } as BracketLeagueData)
      })
    },
    [setBracketLeague, setBracketLeagueData]
  )

  const closeBracketLeague = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current()
      unsubRef.current = null
    }
    setBracketLeague(null)
    setBracketLeagueData(null)
  }, [setBracketLeague, setBracketLeagueData])

  return { openBracketLeague, closeBracketLeague }
}
