import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { useBracketLeagueStore } from '../bracketLeague.store'
import { Card } from '@/components/ui/card'
import { SelectNative } from '@/components/ui/select-native'
import { TeamName } from '@/components/ui/TeamName'
import { getBracketTeams, BRACKET_SERIES, BRACKET_POSITIONS, BRACKET_CONNECTOR_LINES, CARD_W, CARD_H, TOTAL_H, TOTAL_W } from '../bracketConstants'
import { GLOBAL_BRACKET_LEAGUE_ID } from '../bracketLeague.service'
import type { BracketPick, BracketSeriesMap, BracketMvpPick } from '../bracketConstants'

const MVP_SERIES_LABELS: Record<string, string> = {
  cf_east: 'גמר מזרח',
  cf_west: 'גמר מערב',
  finals: 'גמר NBA',
}

function useGlobalR1Teams() {
  const globalData = useGlobalStore((s) => s.globalData)
  const teams = (globalData.teams as Record<string, Record<string, { home: string; away: string }>> | undefined) || {}
  return teams['stage1'] || {}
}

function useBracketLocked() {
  const globalData = useGlobalStore((s) => s.globalData)
  const manualLocked = (globalData.bracketLocked as boolean | undefined) || false
  const autoLockTs   = (globalData.bracketAutoLock as number | undefined) || 0
  return manualLocked || (autoLockTs > 0 && Date.now() >= autoLockTs)
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
  const noTeams = !teams.home && !teams.away

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

function MemberBracket({ uid, pick, globalR1, bracketSeries, username, mvpPick }: {
  uid: string; pick: BracketPick; globalR1: Record<string, { home: string; away: string }>; bracketSeries: BracketSeriesMap; username: string; mvpPick: BracketMvpPick
}) {
  const [expanded, setExpanded] = useState(false)
  const completed = Object.keys(pick).filter((k) => {
    const p = pick[k]; return p && (p.homeWins === 4 || p.awayWins === 4)
  }).length

  const mvpEntries = Object.entries(MVP_SERIES_LABELS).filter(([k]) => mvpPick[k as keyof BracketMvpPick])

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
        <>
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
          {mvpEntries.length > 0 && (
            <div className="mvp-readonly-section">
              <div className="mvp-section-title">🏆 MVP לסדרה</div>
              {mvpEntries.map(([k, label]) => (
                <div key={k} className="mvp-readonly-row">
                  <span className="mvp-readonly-label">{label}</span>
                  <span className="mvp-readonly-value">{mvpPick[k as keyof BracketMvpPick]}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Card>
  )
}

export default function BracketBetsViewTab() {
  const globalLeagueData  = useBracketLeagueStore((s) => s.globalBracketLeagueData)
  const leaguesMeta       = useBracketLeagueStore((s) => s.myBracketLeaguesMeta)
  const currentUser       = useAuthStore((s) => s.currentUser)
  const globalR1          = useGlobalR1Teams()
  const bracketSeries     = useBracketSeries()
  const locked            = useBracketLocked()

  const [selectedLid, setSelectedLid] = useState(GLOBAL_BRACKET_LEAGUE_ID)

  if (!globalLeagueData) return null

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

  const myUid      = currentUser?.uid || ''
  const memberInfo = globalLeagueData.memberInfo || {}
  const bets       = globalLeagueData.bets       || {}
  const mvpBets    = globalLeagueData.mvpBets    || {}

  // Determine member list for selected league
  const selectedMeta = leaguesMeta?.find((l) => l.id === selectedLid)
  const members: string[] = selectedLid === GLOBAL_BRACKET_LEAGUE_ID
    ? (globalLeagueData.members || [])
    : (selectedMeta?.members || [])

  // My bracket first, then others
  const sorted = [
    ...members.filter((uid) => uid === myUid),
    ...members.filter((uid) => uid !== myUid),
  ]

  // Build leagues list for selector
  const allLeagues = leaguesMeta
    ? [
        { id: GLOBAL_BRACKET_LEAGUE_ID, name: 'ליגה גלובלית' },
        ...leaguesMeta
          .filter((l) => l.id !== GLOBAL_BRACKET_LEAGUE_ID)
          .map((l) => ({ id: l.id, name: l.name })),
      ]
    : [{ id: GLOBAL_BRACKET_LEAGUE_ID, name: 'ליגה גלובלית' }]

  return (
    <div>
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

      {sorted.map((uid) => (
        <MemberBracket
          key={uid}
          uid={uid}
          pick={bets[uid] || {}}
          globalR1={globalR1}
          bracketSeries={bracketSeries}
          username={(memberInfo[uid]?.username) || uid}
          mvpPick={mvpBets[uid] || {}}
        />
      ))}
    </div>
  )
}
