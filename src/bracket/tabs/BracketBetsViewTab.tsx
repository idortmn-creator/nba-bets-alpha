import { useState } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { useBracketLeagueStore } from '../bracketLeague.store'
import { Card } from '@/components/ui/card'
import { SelectNative } from '@/components/ui/select-native'
import { TeamName } from '@/components/ui/TeamName'
import { getBracketTeams, BRACKET_SERIES, BRACKET_POSITIONS, BRACKET_CONNECTOR_LINES, CARD_W, CARD_H, TOTAL_H, TOTAL_W } from '../bracketConstants'
import { GLOBAL_BRACKET_LEAGUE_ID } from '../bracketLeague.service'
import { getTeamColor, getOutcomeColor } from '../teamColors'
import Pie3D from '../Pie3D'
import type { BracketPick, BracketSeriesMap, BracketMvpPick } from '../bracketConstants'
import type { PieSlice } from '../Pie3D'

const MVP_SERIES_LABELS: Record<string, string> = {
  cf_east: 'גמר מזרח',
  cf_west: 'גמר מערב',
  finals: 'גמר NBA',
}

const ROUND_LABELS: Record<number, string> = {
  1: 'סיבוב ראשון',
  2: 'סיבוב שני',
  3: 'גמר קונפרנס',
  4: 'גמר NBA',
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

// ── By-User mode ─────────────────────────────────────────────────────────────

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

// ── By-Series mode ────────────────────────────────────────────────────────────

interface OutcomeCount {
  homeWins: number
  awayWins: number
  count: number
}

function countOutcomes(
  seriesKey: string,
  memberUids: string[],
  bets: Record<string, BracketPick>,
): OutcomeCount[] {
  const map = new Map<string, OutcomeCount>()
  for (const uid of memberUids) {
    const p = bets[uid]?.[seriesKey]
    if (!p || (p.homeWins !== 4 && p.awayWins !== 4)) continue
    const key = `${p.homeWins}-${p.awayWins}`
    if (!map.has(key)) map.set(key, { homeWins: p.homeWins, awayWins: p.awayWins, count: 0 })
    map.get(key)!.count++
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count)
}

function SeriesPieCard({
  seriesKey,
  memberUids,
  bets,
  globalR1,
  bracketSeries,
}: {
  seriesKey: string
  memberUids: string[]
  bets: Record<string, BracketPick>
  globalR1: Record<string, { home: string; away: string }>
  bracketSeries: BracketSeriesMap
}) {
  const teams = getBracketTeams(seriesKey, {} as BracketPick, globalR1, bracketSeries)
  const def = BRACKET_SERIES.find((s) => s.key === seriesKey)
  const conf = def?.conf || ''
  const borderColor = conf === 'east' ? 'rgba(79,195,247,0.3)' : conf === 'west' ? 'rgba(255,107,0,0.3)' : 'rgba(255,215,0,0.4)'

  const homeColor = getTeamColor(teams.home)
  const awayColor = getTeamColor(teams.away)

  const outcomes = countOutcomes(seriesKey, memberUids, bets)
  const totalPicks = outcomes.reduce((s, o) => s + o.count, 0)

  // Build pie slices
  const slices: PieSlice[] = outcomes.map((o) => {
    const homeWon = o.homeWins === 4
    const loserWins = homeWon ? o.awayWins : o.homeWins
    const baseColor = homeWon ? homeColor : awayColor
    const color = getOutcomeColor(baseColor, loserWins)
    const teamName = homeWon ? (teams.home || '?') : (teams.away || '?')
    const label = `${teamName} 4-${loserWins} (${o.count})`
    return { value: o.count, color, label }
  })

  // Legend entries
  const legendItems = outcomes.map((o) => {
    const homeWon = o.homeWins === 4
    const loserWins = homeWon ? o.awayWins : o.homeWins
    const baseColor = homeWon ? homeColor : awayColor
    const color = getOutcomeColor(baseColor, loserWins)
    const teamName = homeWon ? (teams.home || '?') : (teams.away || '?')
    const pct = totalPicks > 0 ? Math.round((o.count / totalPicks) * 100) : 0
    return { color, label: `${teamName} 4-${loserWins}`, count: o.count, pct }
  })

  const noTeams = !teams.home && !teams.away

  return (
    <div
      className="series-pie-card"
      style={{ borderColor }}
    >
      <div className="series-pie-title">{def?.label || seriesKey}</div>
      {noTeams ? (
        <div className="series-pie-unknown">?</div>
      ) : totalPicks === 0 ? (
        <div className="series-pie-empty">אין ניחושים עדיין</div>
      ) : (
        <div className="series-pie-body">
          <div className="series-pie-teams">
            <span className="series-pie-team" style={{ color: homeColor }}>
              <TeamName name={teams.home} size={11} />
            </span>
            <span className="series-pie-vs">vs</span>
            <span className="series-pie-team" style={{ color: awayColor }}>
              <TeamName name={teams.away} size={11} />
            </span>
          </div>
          <div className="series-pie-chart-row">
            <Pie3D slices={slices} size={120} />
            <div className="series-pie-legend">
              {legendItems.map((item) => (
                <div key={item.label} className="series-pie-legend-row">
                  <span className="series-pie-legend-dot" style={{ background: item.color }} />
                  <span className="series-pie-legend-label">{item.label}</span>
                  <span className="series-pie-legend-count">{item.count} ({item.pct}%)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function BySeriesView({
  memberUids,
  bets,
  globalR1,
  bracketSeries,
}: {
  memberUids: string[]
  bets: Record<string, BracketPick>
  globalR1: Record<string, { home: string; away: string }>
  bracketSeries: BracketSeriesMap
}) {
  const rounds = [1, 2, 3, 4] as const
  return (
    <div className="by-series-view">
      {rounds.map((round) => {
        const roundSeries = BRACKET_SERIES.filter((s) => s.round === round)
        return (
          <div key={round} className="by-series-round">
            <div className="by-series-round-title">{ROUND_LABELS[round]}</div>
            <div className="by-series-grid">
              {roundSeries.map((s) => (
                <SeriesPieCard
                  key={s.key}
                  seriesKey={s.key}
                  memberUids={memberUids}
                  bets={bets}
                  globalR1={globalR1}
                  bracketSeries={bracketSeries}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Main tab ──────────────────────────────────────────────────────────────────

type ViewMode = 'by-user' | 'by-series'

export default function BracketBetsViewTab() {
  const globalLeagueData  = useBracketLeagueStore((s) => s.globalBracketLeagueData)
  const leaguesMeta       = useBracketLeagueStore((s) => s.myBracketLeaguesMeta)
  const currentUser       = useAuthStore((s) => s.currentUser)
  const globalR1          = useGlobalR1Teams()
  const bracketSeries     = useBracketSeries()
  const locked            = useBracketLocked()

  const [selectedLid, setSelectedLid] = useState(GLOBAL_BRACKET_LEAGUE_ID)
  const [viewMode, setViewMode] = useState<ViewMode>('by-user')

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

      {/* View mode toggle */}
      <div className="bets-view-toggle mb-4">
        <button
          className={`bets-view-btn${viewMode === 'by-user' ? ' bets-view-btn-active' : ''}`}
          onClick={() => setViewMode('by-user')}
        >
          לפי משתמש
        </button>
        <button
          className={`bets-view-btn${viewMode === 'by-series' ? ' bets-view-btn-active' : ''}`}
          onClick={() => setViewMode('by-series')}
        >
          לפי סדרה
        </button>
      </div>

      {viewMode === 'by-user' ? (
        sorted.map((uid) => (
          <MemberBracket
            key={uid}
            uid={uid}
            pick={bets[uid] || {}}
            globalR1={globalR1}
            bracketSeries={bracketSeries}
            username={(memberInfo[uid]?.username) || uid}
            mvpPick={mvpBets[uid] || {}}
          />
        ))
      ) : (
        <BySeriesView
          memberUids={sorted}
          bets={bets}
          globalR1={globalR1}
          bracketSeries={bracketSeries}
        />
      )}
    </div>
  )
}
