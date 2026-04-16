import { useNavigate } from 'react-router-dom'
import { GLOBAL_BRACKET_LEAGUE_ID } from './bracketLeague.service'

export default function BracketSavedPage() {
  const navigate = useNavigate()

  return (
    <div className="py-6">
      <div className="mb-5 rounded-lg border border-[rgba(100,220,130,0.35)] bg-[rgba(100,220,130,0.07)] p-4 text-center">
        <div className="mb-1 text-3xl">✅</div>
        <div className="font-bold text-[var(--green)]">הברקט נשמר!</div>
        <div className="mt-1 text-sm text-[var(--text2)]">עכשיו תוכל ליצור ליגה עם חברים או לצפות בברקט שלך</div>
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
        <div className="home-card !border-[var(--orange)]" onClick={() => navigate(`/bracket/league/${GLOBAL_BRACKET_LEAGUE_ID}`)}>
          <div className="hc-icon">📊</div>
          <div className="hc-title">הברקט שלי</div>
          <div className="hc-sub">כנס לברקט שלך בליגה הגלובלית</div>
        </div>
      </div>
    </div>
  )
}
