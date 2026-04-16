import { useBracketLeagueStore } from '../bracketLeague.store'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { scoreBracketAll } from '../bracketScoring'
import type { BracketSeriesMap, BracketMvpPick } from '../bracketConstants'

function useBracketSeries(): BracketSeriesMap {
  return (useGlobalStore((s) => s.globalData).bracketSeries as BracketSeriesMap | undefined) || {}
}

function useActualMvp(): BracketMvpPick {
  return (useGlobalStore((s) => s.globalData).bracketActualMvp as BracketMvpPick | undefined) || {}
}

export default function BracketHomeTab({ onViewRules }: { onViewRules?: () => void }) {
  // currentBracketLeagueData drives the member list (league-specific)
  // globalBracketLeagueData drives the actual bet data (shared across leagues)
  const leagueData       = useBracketLeagueStore((s) => s.currentBracketLeagueData)
  const globalLeagueData = useBracketLeagueStore((s) => s.globalBracketLeagueData)
  const currentUser      = useAuthStore((s) => s.currentUser)
  const bracketSeries    = useBracketSeries()
  const actualMvp        = useActualMvp()

  if (!leagueData || !currentUser) return null

  const myUid      = currentUser.uid
  const members    = leagueData.members || []

  // Use global league for bets — falls back to current league for the global league page itself
  const source     = globalLeagueData ?? leagueData
  const memberInfo = source.memberInfo || {}
  const bets       = source.bets       || {}
  const mvpBets    = source.mvpBets    || {}

  const scores  = scoreBracketAll(members, bets, mvpBets, bracketSeries, actualMvp)
  const myRank  = scores.findIndex((s) => s.uid === myUid) + 1
  const top5    = scores.slice(0, 5)
  const showMyRow = myRank > 5
  const myEntry = scores.find((s) => s.uid === myUid)

  const medal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : String(r)

  const myPick        = bets[myUid] || {}
  const completedCount = Object.keys(myPick).filter((k) => {
    const p = myPick[k]; return p && (p.homeWins === 4 || p.awayWins === 4)
  }).length
  const totalSeries   = 15
  const allSubmitted  = completedCount === totalSeries

  return (
    <div className="lh-wrap">
      {/* Mini Standings */}
      <div className="lh-card">
        <div className="lh-card-title">🏆 טבלת מובילים</div>
        <div className="lh-standings">
          {top5.map((s, i) => {
            const rank = i + 1
            const isMe = s.uid === myUid
            const info = memberInfo[s.uid] || { username: s.uid, displayName: '' }
            return (
              <div key={s.uid} className={`lh-row${isMe ? ' lh-row-me' : ''}`}>
                <span className="lh-row-rank">{medal(rank)}</span>
                <span className="lh-row-name">{info.username || s.uid}</span>
                <span className="lh-row-pts">{s.total} נק'</span>
              </div>
            )
          })}
          {showMyRow && myEntry && (
            <>
              <div className="lh-row-sep">⋯</div>
              <div className="lh-row lh-row-me">
                <span className="lh-row-rank">{myRank}</span>
                <span className="lh-row-name">{(memberInfo[myUid] || { username: myUid }).username}</span>
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
              {allSubmitted ? 'הוגש!' : `${completedCount}/${totalSeries} סדרות`}
            </div>
          </div>
        </div>
        <div className="lh-stat-card">
          <div className="lh-stat-icon">👥</div>
          <div className="lh-stat-body">
            <div className="lh-stat-label">הגישו ברקט</div>
            <div className="lh-stat-value">
              {members.filter((uid) => {
                const p = bets[uid] || {}
                return Object.keys(p).filter((k) => p[k]?.homeWins === 4 || p[k]?.awayWins === 4).length === totalSeries
              }).length}/{members.length}
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
