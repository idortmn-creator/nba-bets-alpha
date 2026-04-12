import { useState, useEffect, useRef } from 'react'
import { useLeagueStore } from '@/store/league.store'
import { useGlobalStore } from '@/store/global.store'
import { useAuthStore } from '@/store/auth.store'
import { scoreStage } from '@/services/scoring'
import { STAGE_KEYS, STAGE_SHORT } from '@/lib/constants'
import { Card } from '@/components/ui/card'

function TrendBadge({ uid, rank, prevRanks }: { uid: string; rank: number; prevRanks: Record<string, number> }) {
  const prev = prevRanks[uid]
  if (!prev || prev === rank) return <span className="lb-trend lb-trend-same">—</span>
  if (prev > rank) return <span className="lb-trend lb-trend-up">↑</span>
  return <span className="lb-trend lb-trend-down">↓</span>
}

export default function LeaderboardTab() {
  const leagueData = useLeagueStore((s) => s.currentLeagueData)
  const globalData = useGlobalStore((s) => s.globalData)
  const currentUser = useAuthStore((s) => s.currentUser)
  const [prevRanks, setPrevRanks] = useState<Record<string, number>>({})
  const [showSticky, setShowSticky] = useState(false)
  const myRowRef = useRef<HTMLDivElement>(null)

  const myUid = currentUser?.uid || ''

  // Compute scores (safe when leagueData is null — produces empty array)
  const scores = (leagueData?.members || [])
    .map((uid) => {
      let total = 0
      const bd: Record<string, number> = {}
      for (const sk of STAGE_KEYS) {
        const p = leagueData ? scoreStage(uid, sk, leagueData, globalData) : 0
        bd['s' + String(sk)] = p
        total += p
      }
      return { uid, total, bd, info: (leagueData?.memberInfo || {})[uid] || { username: uid, displayName: '' } }
    })
    .sort((a, b) => b.total - a.total)

  const totalPoints = scores.reduce((s, x) => s + x.total, 0)
  const myIdx = scores.findIndex((s) => s.uid === myUid)
  const myScoreEntry = myIdx >= 0 ? scores[myIdx] : null

  // Trend snapshot: compare current ranking against last-known-different ranking
  useEffect(() => {
    if (!leagueData || scores.length === 0) return
    const key = `lb_snap_${leagueData.id}`
    const curRanks: Record<string, number> = {}
    scores.forEach((s, i) => { curRanks[s.uid] = i + 1 })
    try {
      const stored = JSON.parse(localStorage.getItem(key) || 'null') as { total: number; ranks: Record<string, number> } | null
      if (!stored) {
        localStorage.setItem(key, JSON.stringify({ total: totalPoints, ranks: curRanks }))
      } else if (stored.total !== totalPoints) {
        setPrevRanks(stored.ranks || {})
        localStorage.setItem(key, JSON.stringify({ total: totalPoints, ranks: curRanks }))
      } else {
        setPrevRanks(stored.ranks || {})
      }
    } catch { /* localStorage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leagueData?.id, totalPoints])

  // Show sticky row when user's own row is scrolled out of view
  useEffect(() => {
    const el = myRowRef.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => setShowSticky(!entry.isIntersecting),
      { threshold: 0.5 }
    )
    obs.observe(el)
    return () => obs.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [myIdx])

  if (!leagueData) return null

  return (
    <>
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
            const isMe = uid === myUid
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank)
            const breakdown = STAGE_SHORT
              .map((s, idx) => {
                const k = String(STAGE_KEYS[idx])
                return bd['s' + k] > 0 ? `${s}: ${bd['s' + k]}` : null
              })
              .filter(Boolean)
              .join(' | ')
            return (
              <div
                key={uid}
                ref={isMe ? myRowRef : undefined}
                className={`lb-row rank-${rank}${isMe ? ' lb-row-me' : ''}`}
              >
                <div className="lb-rank">{medal}</div>
                <div className="lb-info">
                  <div className="lb-username">{info.username || uid}</div>
                  <div className="lb-displayname">{info.displayName || ''}</div>
                  {breakdown && <div className="lb-breakdown">{breakdown}</div>}
                </div>
                <TrendBadge uid={uid} rank={rank} prevRanks={prevRanks} />
                <div className="lb-score">{total} נק'</div>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Sticky pinned row — visible only when user's row has scrolled out of view */}
      {showSticky && myScoreEntry && (
        <div className="lb-sticky-bar">
          <div className="lb-sticky-row">
            <span className="lb-sticky-rank">
              {myIdx + 1 === 1 ? '🥇' : myIdx + 1 === 2 ? '🥈' : myIdx + 1 === 3 ? '🥉' : `#${myIdx + 1}`}
            </span>
            <span className="lb-sticky-name">{myScoreEntry.info.username || myUid}</span>
            <TrendBadge uid={myUid} rank={myIdx + 1} prevRanks={prevRanks} />
            <span className="lb-sticky-score">{myScoreEntry.total} נק'</span>
          </div>
        </div>
      )}
    </>
  )
}
