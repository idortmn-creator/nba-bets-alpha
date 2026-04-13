import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { loadMyBracketLeagues } from './bracketLeague.service'

export default function BracketMyLeaguesPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)
  const [leagues, setLeagues] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    loadMyBracketLeagues(currentUser.uid)
      .then((l) => setLeagues(l))
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false))
  }, [currentUser])

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-bold">🏆 ליגות הברקט שלי</div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/bracket')}>← חזור</Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="spinner" /></div>
      ) : leagues.length === 0 ? (
        <div className="py-12 text-center text-[var(--text2)]">
          <div className="mb-2 text-4xl">📊</div>
          <p>אין ליגות ברקט עדיין</p>
        </div>
      ) : (
        leagues.map((ld) => {
          const isAdmin = (ld as { adminUid?: string }).adminUid === currentUser?.uid
          return (
            <div
              key={ld.id as string}
              className="league-row"
              onClick={() => navigate(`/bracket/league/${ld.id}`)}
            >
              <div>
                <div className="lr-name">{ld.name as string} {isAdmin ? '👑' : ''}</div>
                <div className="lr-meta">
                  {(ld.members as string[])?.length || 0} משתתפים | קוד: {ld.code as string}
                </div>
              </div>
              <span className="text-lg text-[var(--orange)]">←</span>
            </div>
          )
        })
      )}
    </div>
  )
}
