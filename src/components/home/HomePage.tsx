import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'

export default function HomePage() {
  const navigate = useNavigate()
  const userDoc = useAuthStore((s) => s.currentUserDoc)
  const { isSuperAdmin } = useGlobalHelpers()

  return (
    <div className="py-6">
<div className="mb-4 text-lg font-bold">
        שלום, <span className="text-[var(--orange)]">{userDoc?.username || ''}</span> 👋
      </div>
      <div className="home-grid">
        <div className="home-card" onClick={() => navigate('/create-league')}>
          <div className="hc-icon">➕</div>
          <div className="hc-title">צור ליגה חדשה</div>
          <div className="hc-sub">פתח ליגה ושלח לחברים</div>
        </div>
        <div className="home-card" onClick={() => navigate('/join-league')}>
          <div className="hc-icon">🔗</div>
          <div className="hc-title">הצטרף לליגה</div>
          <div className="hc-sub">הכנס קוד ליגה</div>
        </div>
        <div className="home-card" onClick={() => navigate('/leagues')}>
          <div className="hc-icon">🏆</div>
          <div className="hc-title">הליגות שלי</div>
          <div className="hc-sub">כל הליגות שלך</div>
        </div>
        {isSuperAdmin() && (
          <div
            className="home-card !border-[var(--orange)]"
            onClick={() => navigate('/admin')}
          >
            <div className="hc-icon">⚙️</div>
            <div className="hc-title">ניהול גלובלי</div>
            <div className="hc-sub">ניהול שלבים ותוצאות</div>
          </div>
        )}
      </div>
    </div>
  )
}
