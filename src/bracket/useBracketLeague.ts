import { useRef, useCallback } from 'react'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useBracketLeagueStore } from './bracketLeague.store'
import { GLOBAL_BRACKET_LEAGUE_ID } from './bracketLeague.service'
import type { BracketLeagueData } from './bracketLeague.store'

export function useBracketLeague() {
  const {
    setBracketLeague,
    setBracketLeagueData,
    setGlobalBracketLeagueData,
  } = useBracketLeagueStore()

  const unsubRef       = useRef<(() => void) | null>(null)
  const unsubGlobalRef = useRef<(() => void) | null>(null)

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

  /** Subscribe to the global league (bl_global) for bets/mvpBets. */
  const openGlobalBracketLeague = useCallback(() => {
    if (unsubGlobalRef.current) return // already subscribed
    unsubGlobalRef.current = onSnapshot(
      doc(db, 'bracket_leagues', GLOBAL_BRACKET_LEAGUE_ID),
      (snap) => {
        if (!snap.exists()) {
          setGlobalBracketLeagueData(null)
          return
        }
        setGlobalBracketLeagueData({ id: snap.id, ...snap.data() } as BracketLeagueData)
      }
    )
  }, [setGlobalBracketLeagueData])

  const closeGlobalBracketLeague = useCallback(() => {
    if (unsubGlobalRef.current) {
      unsubGlobalRef.current()
      unsubGlobalRef.current = null
    }
    setGlobalBracketLeagueData(null)
  }, [setGlobalBracketLeagueData])

  return {
    openBracketLeague,
    closeBracketLeague,
    openGlobalBracketLeague,
    closeGlobalBracketLeague,
  }
}
