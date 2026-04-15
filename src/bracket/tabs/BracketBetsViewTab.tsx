import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { useBracketLeagueStore } from '../bracketLeague.store'
import { Card } from '@/components/ui/card'
import { TeamName } from '@/components/ui/TeamName'
import { getBracketTeams, BRACKET_SERIES, BRACKET_POSITIONS, BRACKET_CONNECTOR_LINES, CARD_W, CARD_H, TOTAL_H, TOTAL_W } from '../bracketConstants'
import type { BracketPick, BracketSeriesMap } from '../bracketConstants'
import { STAGE_KEYS } from '@/lib/constants'

function useGlobalR1Teams() {
  const globalData = useGlobalStore((s) => s.globalData)
  const teams = (globalData.teams as Record<string, Record<string, { home: string; away: string }>> | undefined) || {}
  return teams['stage1'] || {}
}

function useBracketLocked() {
  const globalData = useGlobalStore((s) => s.globalData)
  const stageLocked = (globalData.stageLocked as boolean[] | undefined) || []
  return stageLocked[STAGE_KEYS.indexOf(1)] || false
}

function useBracketSeries(): BracketSeriesMap {
  return (useGlobalStore((s) => s.globalData).bracketSeries as BracketSeriesMap | undefined) || {}
}

interface ReadonlyCardProps {
  seriesKey: string
  pick: BracketPick
  globalR1: Record<string, { home: string; away: string }>
  bracketSeries: BracketSeriesMap
}

function ReadonlySeriesCard({ seriesKey, pick, globalR1, bracketSeries }: ReadonlyCardProps) {
  const teams = getBracketTeams(seriesKey, pick, globalR1, bracketSeries)
  const p = pick[seriesKey] || { homeWins: 0, awayWins: 0 }
  const { homeWins, awayWins } = p
  const homeWon = homeWins === 4
  const awayWon = awayWins === 4
  const noTeams = !teams.home || !teams.away

  const def = BRACKET_SERIES.find((s) => s.key === seriesKey)
  const conf = def?.conf || ''
  const borderColor = conf === 'east' ? 'rgba(79,195,247,0.3)' : conf === 'west' ? 'rgba(255,107,0,0.3)' : 'rgba(255,215,0,0.4)'

  return (
    <div
      className="br-card"
      style={{
        position: 'absolute',
        left: BRACKET_POSITIONS[seriesKey]?.x,
        top: BRACKET_POSITIONS[seriesKey]?.y,
        width: CARD_W,
        height: CARD_H,
        borderColor,
      }}
    >
      {noTeams ? (
        <div className="br-card-empty">?</div>
      ) : (
        <>
          <div className={`br-team-row${homeWon ? ' br-winner' : awayWon ? ' br-loser' : ''}`}>
            <span className="br-team-name"><TeamName name={teams.home || '?'} size={12} /></span>
            <span className={`br-win-num-ro${homeWon ? ' br-win-bold' : ''}`}>{homeWins}</span>
          </div>
          <div className={`br-team-row${awayWon ? ' br-winner' : homeWon ? ' br-loser' : ''}`}>
            <span className="br-team-name"><TeamName name={teams.away || '?'} size={12} /></span>
            <span className={`br-win-num-ro${awayWon ? ' br-win-bold' : ''}`}>{awayWins}</span>
          </div>
        </>
      )}
    </div>
  )
}

function MemberBracket({ uid, pick, globalR1, bracketSeries, username }: {
  uid: string; pick: BracketPick; globalR1: Record<string, { home: string; away: string }>; bracketSeries: BracketSeriesMap; username: string
}) {
  const [expanded, setExpanded] = useState(false)
  const completed = Object.keys(pick).filter((k) => {
    const p = pick[k]; return p && (p.homeWins === 4 || p.awayWins === 4)
  }).length

  return (
    <Card className="mb-3">
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setExpanded(!expanded)}
      >
        <div>
          <div className="font-bold">{username}</div>
          <div className="text-xs text-[var(--text2)]">{completed}/15 סדרות</div>
        </div>
        <span className="text-[var(--orange)]">{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && (
        <div className="mt-3 overflow-x-auto" style={{ direction: 'ltr' }}>
          <div style={{ position: 'relative', width: TOTAL_W, height: TOTAL_H + 30 }}>
            <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} width={TOTAL_W} height={TOTAL_H + 30}>
              <g transform="translate(0,0)">
                {BRACKET_CONNECTOR_LINES.map(([x1, y1, x2, y2], i) => (
                  <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
                ))}
              </g>
            </svg>
            {BRACKET_SERIES.map((s) => (
              <ReadonlySeriesCard key={s.key} seriesKey={s.key} pick={pick} globalR1={globalR1} bracketSeries={bracketSeries} />
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export default function BracketBetsViewTab() {
  const leagueData = useBracketLeagueStore((s) => s.currentBracketLeagueData)
  const currentUser = useAuthStore((s) => s.currentUser)
  const globalR1 = useGlobalR1Teams()
  const bracketSeries = useBracketSeries()
  const locked = useBracketLocked()

  if (!leagueData) return null

  if (!locked) {
    return (
      <Card>
        <div className="py-8 text-center text-[var(--text2)]">
          <div className="mb-2 text-3xl">🔒</div>
          <p>ניתן לצפות בהימורי כולם לאחר נעילת הברקט</p>
        </div>
      </Card>
    )
  }

  const members = leagueData.members || []
  const memberInfo = leagueData.memberInfo || {}
  const bets = leagueData.bets || {}
  const myUid = currentUser?.uid || ''

  // My bracket first, then others
  const sorted = [
    ...members.filter((uid) => uid === myUid),
    ...members.filter((uid) => uid !== myUid),
  ]

  return (
    <div>
      {sorted.map((uid) => (
        <MemberBracket
          key={uid}
          uid={uid}
          pick={bets[uid] || {}}
          globalR1={globalR1}
          bracketSeries={bracketSeries}
          username={(memberInfo[uid]?.username) || uid}
        />
      ))}
    </div>
  )
}
