import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'
import { SUPER_ADMIN_UID } from '@/lib/constants'

export default function LandingPage() {
  const navigate = useNavigate()
  const userDoc = useAuthStore((s) => s.currentUserDoc)
  const currentUser = useAuthStore((s) => s.currentUser)
  const isSuperAdmin = currentUser?.uid === SUPER_ADMIN_UID

  return (
    <div className="py-6">
      <div className="mb-5 text-lg font-bold">
        שלום, <span className="text-[var(--orange)]">{userDoc?.username || ''}</span> 👋
      </div>

      <div className="landing-grid">
        {/* Card 1 — active */}
        <div className="home-card" onClick={() => navigate('/home')}>
          <div className="hc-icon">🏀</div>
          <div className="hc-title">NBA Playoff</div>
          <div className="hc-sub">הימורי שלב-שלב</div>
        </div>

        {/* Card 2 — Bracket format (super-admin only for now) */}
        {isSuperAdmin ? (
          <div className="home-card" onClick={() => navigate('/bracket')}>
            <div className="hc-icon">📊</div>
            <div className="hc-title">NBA Playoff Bracket</div>
            <div className="hc-sub">פלייאוף ברקט</div>
          </div>
        ) : (
          <div className="home-card home-card-soon">
            <div className="hc-icon">📊</div>
            <div className="hc-title">NBA Playoff Bracket</div>
            <div className="hc-sub coming-soon-label">בקרוב</div>
          </div>
        )}

        {/* Card 3 — coming soon */}
        <div className="home-card home-card-soon">
          <div className="hc-icon">🌍</div>
          <div className="hc-title">World Cup 2026</div>
          <div className="hc-sub coming-soon-label">בקרוב</div>
        </div>
      </div>
    </div>
  )
}
