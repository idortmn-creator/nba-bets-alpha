import { useLeagueStore } from '@/store/league.store'
import { useGlobalStore } from '@/store/global.store'
import { scoreStage } from '@/services/scoring'
import { STAGE_KEYS, STAGE_SHORT } from '@/lib/constants'
import { Card } from '@/components/ui/card'

export default function LeaderboardTab() {
  const leagueData = useLeagueStore((s) => s.currentLeagueData)
  const globalData = useGlobalStore((s) => s.globalData)
  if (!leagueData) return null

  const members = leagueData.members || []
  const memberInfo = leagueData.memberInfo || {}
  const scores = members
    .map((uid) => {
      let total = 0
      const bd: Record<string, number> = {}
      for (const sk of STAGE_KEYS) {
        const p = scoreStage(uid, sk, leagueData, globalData)
        bd['s' + String(sk)] = p
        total += p
      }
      return { uid, total, bd, info: memberInfo[uid] || { username: uid, displayName: '' } }
    })
    .sort((a, b) => b.total - a.total)

  return (
    <Card>
      <div className="mb-3">
        <div className="font-oswald text-lg text-[var(--orange)]">🏆 טבלת ניקוד</div>
      </div>
      <div className="flex flex-col gap-1.5">
        {scores.length === 0 ? (
          <div className="py-8 text-center text-[var(--text2)]">
            <div className="mb-2 text-3xl">🏀</div><p>אין משתתפים</p>
          </div>
        ) : scores.map(({ uid, total, bd, info }, i) => {
          const rank = i + 1
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank)
          const breakdown = STAGE_SHORT
            .map((s, idx) => {
              const k = String(STAGE_KEYS[idx])
              return bd['s' + k] > 0 ? `${s}: ${bd['s' + k]}` : null
            })
            .filter(Boolean)
            .join(' | ')
          return (
            <div key={uid} className={`lb-row rank-${rank}`}>
              <div className="lb-rank">{medal}</div>
              <div className="lb-info">
                <div className="lb-username">{info.username || uid}</div>
                <div className="lb-displayname">{info.displayName || ''}</div>
                {breakdown && <div className="lb-breakdown">{breakdown}</div>}
              </div>
              <div className="lb-score">{total} נק'</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
