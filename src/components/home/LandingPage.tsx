import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth.store'

export default function LandingPage() {
  const navigate = useNavigate()
  const userDoc = useAuthStore((s) => s.currentUserDoc)

  function handleNbaPlayoff() {
    const lastLeagueId = localStorage.getItem('lastLeagueId')
    if (lastLeagueId) {
      navigate(`/league/${lastLeagueId}`)
    } else {
      navigate('/home')
    }
  }

  return (
    <div className="py-6">
      <div className="mb-5 text-lg font-bold">
        שלום, <span className="text-[var(--orange)]">{userDoc?.username || ''}</span> 👋
      </div>

      <div className="landing-grid">
        {/* Card 1 — active */}
        <div className="home-card" onClick={handleNbaPlayoff}>
          <div className="hc-icon">🏀</div>
          <div className="hc-title">NBA Playoff</div>
          <div className="hc-sub">הימורי שלב-שלב</div>
        </div>

        {/* Card 2 — Bracket format */}
        <div className="home-card" onClick={() => navigate('/bracket')}>
          <div className="hc-icon">📊</div>
          <div className="hc-title">NBA Playoff Bracket</div>
          <div className="hc-sub">פלייאוף ברקט</div>
        </div>

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
