import { useState } from 'react'
import { useBracketLeagueStore } from '../bracketLeague.store'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { Card } from '@/components/ui/card'
import { SelectNative } from '@/components/ui/select-native'
import { scoreBracketAll } from '../bracketScoring'
import { GLOBAL_BRACKET_LEAGUE_ID } from '../bracketLeague.service'
import type { BracketSeriesMap, BracketMvpPick } from '../bracketConstants'

function useBracketSeries(): BracketSeriesMap {
  return (useGlobalStore((s) => s.globalData).bracketSeries as BracketSeriesMap | undefined) || {}
}

function useActualMvp(): BracketMvpPick {
  return (useGlobalStore((s) => s.globalData).bracketActualMvp as BracketMvpPick | undefined) || {}
}

export default function BracketLeaderboardTab() {
  const globalLeagueData  = useBracketLeagueStore((s) => s.globalBracketLeagueData)
  const leaguesMeta       = useBracketLeagueStore((s) => s.myBracketLeaguesMeta)
  const currentUser       = useAuthStore((s) => s.currentUser)
  const bracketSeries     = useBracketSeries()
  const actualMvp         = useActualMvp()

  const [selectedLid, setSelectedLid] = useState(GLOBAL_BRACKET_LEAGUE_ID)

  if (!globalLeagueData) return null

  const myUid = currentUser?.uid || ''

  // Determine which members to show: all global members, or filtered to private league
  const selectedMeta = leaguesMeta?.find((l) => l.id === selectedLid)
  const members: string[] = selectedLid === GLOBAL_BRACKET_LEAGUE_ID
    ? (globalLeagueData.members || [])
    : (selectedMeta?.members || [])

  const memberInfo = globalLeagueData.memberInfo || {}
  const bets       = globalLeagueData.bets      || {}
  const mvpBets    = globalLeagueData.mvpBets   || {}

  const scores = scoreBracketAll(members, bets, mvpBets, bracketSeries, actualMvp)

  const anyFinished = Object.values(bracketSeries).some((s) => s.winner)

  // Build leagues list for selector: global first, then private leagues
  const allLeagues = leaguesMeta
    ? [
        { id: GLOBAL_BRACKET_LEAGUE_ID, name: 'ליגה גלובלית' },
        ...leaguesMeta
          .filter((l) => l.id !== GLOBAL_BRACKET_LEAGUE_ID)
          .map((l) => ({ id: l.id, name: l.name })),
      ]
    : [{ id: GLOBAL_BRACKET_LEAGUE_ID, name: 'ליגה גלובלית' }]

  return (
    <Card>
      {/* League selector */}
      {allLeagues.length > 1 && (
        <div className="mb-3 flex items-center gap-2">
          <span className="text-xs text-[var(--text2)] shrink-0">ליגה:</span>
          <SelectNative
            value={selectedLid}
            onChange={(e) => setSelectedLid(e.target.value)}
            className="!py-1.5 !text-xs"
          >
            {allLeagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </SelectNative>
        </div>
      )}

      <div className="mb-3 font-oswald text-lg text-[var(--orange)]">🏆 טבלת ניקוד</div>

      {!anyFinished && (
        <div className="mb-3 rounded-lg border border-[rgba(255,215,0,0.25)] bg-[rgba(255,215,0,0.06)] p-3 text-xs text-[var(--gold)]">
          ⏳ ניקוד יתעדכן עם התקדמות הפלייאוף
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {scores.length === 0 ? (
          <div className="py-8 text-center text-[var(--text2)]">
            <div className="mb-2 text-3xl">📊</div>
            <p>אין משתתפים</p>
          </div>
        ) : scores.map(({ uid, total, breakdown }, i) => {
          const rank  = i + 1
          const isMe  = uid === myUid
          const info  = memberInfo[uid] || { username: uid, displayName: '' }
          const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : String(rank)

          const { byRound, mvpPts } = breakdown
          const hasPts = total > 0

          return (
            <div key={uid} className={`lb-row${isMe ? ' lb-row-me' : ''} rank-${rank}`}>
              <div className="lb-rank">{medal}</div>
              <div className="lb-info">
                <div className="lb-username">{info.username || uid}</div>
                {hasPts && (
                  <div className="lb-breakdown">
                    {[1, 2, 3, 4].map((r) =>
                      byRound[r] > 0
                        ? <span key={r} className="lb-rd-chip">ס'{r}: {byRound[r]}</span>
                        : null
                    )}
                    {mvpPts > 0 && <span className="lb-rd-chip lb-mvp-chip">MVP: {mvpPts}</span>}
                  </div>
                )}
              </div>
              <div className="lb-score">{total} נק'</div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
