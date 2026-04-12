import { useLeagueStore } from '@/store/league.store'
import { useGlobalStore } from '@/store/global.store'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { scoreStage } from '@/services/scoring'
import { STAGE_KEYS, STAGE_SHORT } from '@/lib/constants'

export default function LeagueHomeTab({ onViewRules }: { onViewRules?: () => void }) {
  const leagueData = useLeagueStore((s) => s.currentLeagueData)
  const globalData = useGlobalStore((s) => s.globalData)
  const currentUser = useAuthStore((s) => s.currentUser)
  const { getGlobal, canBetOnStage } = useGlobalHelpers()

  if (!leagueData || !currentUser) return null

  const myUid = currentUser.uid
  const members = leagueData.members || []
  const memberInfo = leagueData.memberInfo || {}

  // Compute total scores for all members
  const scores = members
    .map((uid) => {
      let total = 0
      for (const sk of STAGE_KEYS) total += scoreStage(uid, sk, leagueData, globalData)
      return { uid, total, info: memberInfo[uid] || { username: uid, displayName: '' } }
    })
    .sort((a, b) => b.total - a.total)

  const myRank = scores.findIndex((s) => s.uid === myUid) + 1
  const myScore = scores.find((s) => s.uid === myUid)
  const top5 = scores.slice(0, 5)
  const showMyRow = myRank > 5

  const medal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : String(r)

  // Detect stages with no bets submitted but open for betting
  const stageLocks = getGlobal('stageLocked', [] as boolean[])
  const openBetStages: string[] = []
  for (let i = 0; i < STAGE_KEYS.length; i++) {
    const sk = STAGE_KEYS[i]
    const isLocked = stageLocks[i] || false
    if (!isLocked && canBetOnStage(sk)) {
      const stageBets = ((leagueData.bets || {})[myUid] || {})['stage' + sk] || {}
      if (Object.keys(stageBets).length === 0) openBetStages.push(STAGE_SHORT[i])
    }
  }

  // Find last stage with results and user's points for it
  const results = getGlobal('results', {} as Record<string, Record<string, string> | null>)
  let lastStageName = ''
  let lastStagePoints: number | null = null
  for (let i = STAGE_KEYS.length - 1; i >= 0; i--) {
    const sk = STAGE_KEYS[i]
    const r = results['stage' + sk]
    if (r && Object.keys(r).length > 0) {
      lastStageName = STAGE_SHORT[i]
      lastStagePoints = scoreStage(myUid, sk, leagueData, globalData)
      break
    }
  }

  const hasOpenBets = openBetStages.length > 0

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
          {showMyRow && myScore && (
            <>
              <div className="lh-row-sep">⋯</div>
              <div className="lh-row lh-row-me">
                <span className="lh-row-rank">{myRank}</span>
                <span className="lh-row-name">{myScore.info.username || myUid}</span>
                <span className="lh-row-pts">{myScore.total} נק'</span>
              </div>
            </>
          )}
          {scores.length === 0 && (
            <div className="lh-empty">אין משתתפים עדיין</div>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="lh-stats-grid">
        {/* Open bets status */}
        <div className={`lh-stat-card${hasOpenBets ? ' lh-stat-warn' : ' lh-stat-ok'}`}>
          <div className="lh-stat-icon">{hasOpenBets ? '⚠️' : '✅'}</div>
          <div className="lh-stat-body">
            <div className="lh-stat-label">הימורים פתוחים</div>
            <div className="lh-stat-value">
              {hasOpenBets
                ? openBetStages.join(', ')
                : 'הכל הוגש'}
            </div>
          </div>
        </div>

        {/* Last stage points */}
        <div className="lh-stat-card">
          <div className="lh-stat-icon">📊</div>
          <div className="lh-stat-body">
            <div className="lh-stat-label">נקודות אחרונות</div>
            <div className="lh-stat-value">
              {lastStagePoints !== null
                ? <><strong className="lh-pts-num">+{lastStagePoints}</strong>{' '}<span className="lh-pts-stage">{lastStageName}</span></>
                : <span className="lh-empty-val">—</span>}
            </div>
          </div>
        </div>
      </div>

      {/* Rules link */}
      {onViewRules && (
        <button className="lh-rules-link" onClick={onViewRules}>
          📖 שיטת הניקוד ושובר השוויון ←
        </button>
      )}
    </div>
  )
}
