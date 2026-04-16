import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { SUPER_ADMIN_UID } from '@/lib/constants'
import { ensureGlobalLeagueMember, GLOBAL_BRACKET_LEAGUE_ID } from './bracketLeague.service'
import { toast } from 'sonner'

export default function BracketHomePage() {
  const navigate = useNavigate()
  const userDoc = useAuthStore((s) => s.currentUserDoc)
  const currentUser = useAuthStore((s) => s.currentUser)
  const globalData = useGlobalStore((s) => s.globalData)
  const isSuperAdmin = currentUser?.uid === SUPER_ADMIN_UID
  const [joining, setJoining] = useState(false)

  // Redirect returning users who already started their bracket
  useEffect(() => {
    if (!userDoc) return
    const bracketLeagues: string[] = (userDoc as Record<string, unknown>).bracketLeagues as string[] || []
    if (bracketLeagues.includes(GLOBAL_BRACKET_LEAGUE_ID)) {
      navigate('/bracket/saved', { replace: true })
    }
  }, [userDoc]) // eslint-disable-line react-hooks/exhaustive-deps

  // Check if global R1 teams are set
  const teams = (globalData.teams as Record<string, Record<string, { home: string; away: string }>> | undefined) || {}
  const stage1Teams = teams['stage1'] || {}
  const teamsSet = Object.keys(stage1Teams).length >= 8

  async function handleStart() {
    if (!currentUser || !userDoc) return
    setJoining(true)
    try {
      await ensureGlobalLeagueMember(currentUser, userDoc)
      navigate(`/bracket/league/${GLOBAL_BRACKET_LEAGUE_ID}/my-bracket`)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
      setJoining(false)
    }
  }

  // Show spinner while user doc is loading (prevents flash of landing page for returning users)
  if (!userDoc) {
    return <div className="flex items-center justify-center py-16"><div className="spinner" /></div>
  }

  return (
    <div className="py-6">
      <div className="mb-4 text-lg font-bold">
        שלום, <span className="text-[var(--orange)]">{userDoc.username || ''}</span> 👋
      </div>
      <div className="mb-5 rounded-lg border border-[rgba(79,195,247,0.3)] bg-[rgba(79,195,247,0.06)] p-3 text-sm leading-relaxed text-[var(--blue)]">
        <strong>📊 טורניר הברקט:</strong> ניחשו את כל הפלייאוף לפני שמתחיל — ללא הזנת הימורים בין סיבובים.
        {!teamsSet && (
          <div className="mt-1 text-xs text-[var(--text2)]">⏳ ממתין לקביעת קבוצות הסיבוב הראשון על ידי המנהל</div>
        )}
      </div>

      <div className="home-grid">
        {/* Primary: Start Bracket */}
        <div
          className="home-card !border-[var(--orange)]"
          onClick={joining ? undefined : handleStart}
        >
          <div className="hc-icon">{joining ? '⏳' : '📊'}</div>
          <div className="hc-title">{joining ? 'מצטרף...' : 'התחל ברקט'}</div>
          <div className="hc-sub">{joining ? 'אנא המתן' : 'מלא את הברקט שלך לפלייאוף'}</div>
        </div>

        {/* Admin card — super admin only */}
        {isSuperAdmin && (
          <div className="home-card !border-[var(--orange)]" onClick={() => navigate('/bracket/admin')}>
            <div className="hc-icon">⚙️</div>
            <div className="hc-title">ניהול גלובלי</div>
            <div className="hc-sub">נעילה, תוצאות וניהול ליגות</div>
          </div>
        )}

        <div className="home-card" onClick={() => navigate('/bracket/leagues')}>
          <div className="hc-icon">🏆</div>
          <div className="hc-title">הליגות שלי</div>
          <div className="hc-sub">נהל ליגות פרטיות</div>
        </div>
      </div>
    </div>
  )
}
