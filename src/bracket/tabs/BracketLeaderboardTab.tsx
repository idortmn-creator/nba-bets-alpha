import { useBracketLeagueStore } from '../bracketLeague.store'
import { useAuthStore } from '@/store/auth.store'
import { Card } from '@/components/ui/card'

export default function BracketLeaderboardTab() {
  const leagueData = useBracketLeagueStore((s) => s.currentBracketLeagueData)
  const currentUser = useAuthStore((s) => s.currentUser)

  if (!leagueData) return null

  const myUid = currentUser?.uid || ''
  const members = leagueData.members || []
  const memberInfo = leagueData.memberInfo || {}

  // Placeholder: no scoring logic yet — all 0
  const scores = members
    .map((uid) => ({ uid, total: 0, info: memberInfo[uid] || { username: uid, displayName: '' } }))
    .sort((a, b) => b.total - a.total)

  return (
    <Card>
      <div className="mb-3 font-oswald text-lg text-[var(--orange)]">🏆 טבלת ניקוד</div>
      <div className="mb-3 rounded-lg border border-[rgba(255,215,0,0.25)] bg-[rgba(255,215,0,0.06)] p-3 text-xs text-[var(--gold)]">
        ⏳ ניקוד יתעדכן עם התקדמות הפלייאוף
      </div>
      <div className="flex flex-col gap-1.5">
        {scores.length === 0 ? (
          <div className="py-8 text-center text-[var(--text2)]"><div className="mb-2 text-3xl">📊</div><p>אין משתתפים</p></div>
        ) : scores.map(({ uid, total, info }, i) => {
          const rank = i + 1
          const isMe = uid === myUid
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank)
          return (
            <div key={uid} className={`lb-row${isMe ? ' lb-row-me' : ''} rank-${rank}`}>
              <div className="lb-rank">{medal}</div>
              <div className="lb-info">
                <div className="lb-username">{info.username || uid}</div>
                {info.displayName && <div className="lb-displayname">{info.displayName}</div>}
              </div>
              <div className="lb-score">{total} נק'</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
