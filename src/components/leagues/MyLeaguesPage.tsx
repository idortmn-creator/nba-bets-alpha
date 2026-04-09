import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { loadMyLeagues } from '@/services/league.service'
import { STAGE_NAMES, STAGE_KEYS } from '@/lib/constants'

export default function MyLeaguesPage() {
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)
  const { getGlobal } = useGlobalHelpers()
  const [leagues, setLeagues] = useState<Record<string, unknown>[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentUser) return
    loadMyLeagues(currentUser.uid)
      .then((l) => setLeagues(l))
      .catch(() => setLeagues([]))
      .finally(() => setLoading(false))
  }, [currentUser])

  const csIdx = STAGE_KEYS.indexOf(getGlobal('currentStage', 0))

  return (
    <div className="py-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-lg font-bold">🏆 הליגות שלי</div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/')}>← חזור</Button>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="spinner" /></div>
      ) : leagues.length === 0 ? (
        <div className="py-12 text-center text-[var(--text2)]">
          <div className="mb-2 text-4xl">🏀</div>
          <p>אין ליגות עדיין</p>
        </div>
      ) : (
        leagues.map((ld: Record<string, unknown>) => {
          const isAdmin = (ld as { adminUid?: string }).adminUid === currentUser?.uid
          return (
            <div
              key={ld.id as string}
              className="league-row"
              onClick={() => navigate(`/league/${ld.id}`)}
            >
              <div>
                <div className="lr-name">{ld.name as string} {isAdmin ? '👑' : ''}</div>
                <div className="lr-meta">
                  {(ld.members as string[])?.length || 0} משתתפים | קוד: {ld.code as string} | {STAGE_NAMES[csIdx] || ''}
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
