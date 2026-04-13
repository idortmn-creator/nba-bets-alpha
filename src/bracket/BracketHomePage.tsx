import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { SUPER_ADMIN_UID } from '@/lib/constants'

export default function BracketHomePage() {
  const navigate = useNavigate()
  const userDoc = useAuthStore((s) => s.currentUserDoc)
  const currentUser = useAuthStore((s) => s.currentUser)
  const globalData = useGlobalStore((s) => s.globalData)
  const isSuperAdmin = currentUser?.uid === SUPER_ADMIN_UID

  // Check if global R1 teams are set (bracket requires teams to be entered)
  const teams = (globalData.teams as Record<string, Record<string, { home: string; away: string }>> | undefined) || {}
  const stage1Teams = teams['stage1'] || {}
  const teamsSet = Object.keys(stage1Teams).length >= 8

  return (
    <div className="py-6">
      <div className="mb-4 text-lg font-bold">
        שלום, <span className="text-[var(--orange)]">{userDoc?.username || ''}</span> 👋
      </div>
      <div className="mb-4 rounded-lg border border-[rgba(79,195,247,0.3)] bg-[rgba(79,195,247,0.06)] p-3 text-sm leading-relaxed text-[var(--blue)]">
        <strong>📊 טורניר הברקט:</strong> ניחשו את כל הפלייאוף לפני שמתחיל — ללא הזנת הימורים בין סיבובים.
        {!teamsSet && (
          <div className="mt-1 text-xs text-[var(--text2)]">⏳ ממתין לקביעת קבוצות הסיבוב הראשון על ידי המנהל</div>
        )}
      </div>
      <div className="home-grid">
        <div className="home-card" onClick={() => navigate('/bracket/create')}>
          <div className="hc-icon">➕</div>
          <div className="hc-title">צור ליגה חדשה</div>
          <div className="hc-sub">פתח ליגת ברקט ושלח לחברים</div>
        </div>
        <div className="home-card" onClick={() => navigate('/bracket/join')}>
          <div className="hc-icon">🔗</div>
          <div className="hc-title">הצטרף לליגה</div>
          <div className="hc-sub">הכנס קוד ליגת ברקט</div>
        </div>
        <div className="home-card" onClick={() => navigate('/bracket/leagues')}>
          <div className="hc-icon">🏆</div>
          <div className="hc-title">הליגות שלי</div>
          <div className="hc-sub">ליגות הברקט שלך</div>
        </div>
        {isSuperAdmin && (
          <div className="home-card !border-[var(--orange)]" onClick={() => navigate('/admin')}>
            <div className="hc-icon">⚙️</div>
            <div className="hc-title">ניהול גלובלי</div>
            <div className="hc-sub">ניהול שלבים ותוצאות</div>
          </div>
        )}
      </div>
    </div>
  )
}
