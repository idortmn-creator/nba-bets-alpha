import { useBracketLeagueStore } from '../bracketLeague.store'
import { useAuthStore } from '@/store/auth.store'

export default function BracketHomeTab({ onViewRules }: { onViewRules?: () => void }) {
  const leagueData = useBracketLeagueStore((s) => s.currentBracketLeagueData)
  const currentUser = useAuthStore((s) => s.currentUser)

  if (!leagueData || !currentUser) return null

  const myUid = currentUser.uid
  const members = leagueData.members || []
  const memberInfo = leagueData.memberInfo || {}
  const bets = leagueData.bets || {}

  // Placeholder scores (all 0 until scoring logic is added)
  const scores = members
    .map((uid) => ({ uid, total: 0, info: memberInfo[uid] || { username: uid, displayName: '' } }))
    .sort((a, b) => b.total - a.total)

  const myRank = scores.findIndex((s) => s.uid === myUid) + 1
  const top5 = scores.slice(0, 5)
  const showMyRow = myRank > 5
  const myEntry = scores.find((s) => s.uid === myUid)

  const medal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : String(r)

  // Check if user submitted bracket
  const myPick = bets[myUid] || {}
  const submittedCount = Object.keys(myPick).length
  const totalSeries = 15
  const allSubmitted = submittedCount === totalSeries

  return (
    <div className="lh-wrap">
      {/* Mini Standings */}
      <div className="lh-card">
        <div className="lh-card-title">🏆 טבלת מובילים</div>
        <div className="lh-standings">
          {top5.map((s, i) => {
            const rank = i + 1
            const isMe = s.uid === myUid
            return (
              <div key={s.uid} className={`lh-row${isMe ? ' lh-row-me' : ''}`}>
                <span className="lh-row-rank">{medal(rank)}</span>
                <span className="lh-row-name">{s.info.username || s.uid}</span>
                <span className="lh-row-pts">{s.total} נק'</span>
              </div>
            )
          })}
          {showMyRow && myEntry && (
            <>
              <div className="lh-row-sep">⋯</div>
              <div className="lh-row lh-row-me">
                <span className="lh-row-rank">{myRank}</span>
                <span className="lh-row-name">{myEntry.info.username || myUid}</span>
                <span className="lh-row-pts">{myEntry.total} נק'</span>
              </div>
            </>
          )}
          {scores.length === 0 && <div className="lh-empty">אין משתתפים עדיין</div>}
        </div>
      </div>

      {/* Bracket submission status */}
      <div className="lh-stats-grid">
        <div className={`lh-stat-card${allSubmitted ? ' lh-stat-ok' : ' lh-stat-warn'}`}>
          <div className="lh-stat-icon">{allSubmitted ? '✅' : '⚠️'}</div>
          <div className="lh-stat-body">
            <div className="lh-stat-label">ברקט שלי</div>
            <div className="lh-stat-value">
              {allSubmitted ? 'הוגש!' : `${submittedCount}/${totalSeries} סדרות`}
            </div>
          </div>
        </div>
        <div className="lh-stat-card">
          <div className="lh-stat-icon">👥</div>
          <div className="lh-stat-body">
            <div className="lh-stat-label">הגישו ברקט</div>
            <div className="lh-stat-value">
              {members.filter((uid) => Object.keys(bets[uid] || {}).length === totalSeries).length}/{members.length}
            </div>
          </div>
        </div>
      </div>

      {onViewRules && (
        <button className="lh-rules-link" onClick={onViewRules}>
          📖 שיטת הניקוד ←
        </button>
      )}
    </div>
  )
}
