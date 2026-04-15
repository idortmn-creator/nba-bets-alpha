import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { useBracketLeagueStore } from '../bracketLeague.store'
import { saveBracketBet, clearBracketBet } from '../bracketLeague.service'
import {
  BRACKET_SERIES, BRACKET_POSITIONS, BRACKET_CONNECTOR_LINES,
  CARD_W, CARD_H, TOTAL_H, TOTAL_W,
  getBracketTeams, getBracketWinner, clearDownstreamPicks,
} from '../bracketConstants'
import type { BracketPick, BracketSeriesMap } from '../bracketConstants'
import { TeamName } from '@/components/ui/TeamName'
import { STAGE_KEYS } from '@/lib/constants'

function useGlobalR1Teams() {
  const globalData = useGlobalStore((s) => s.globalData)
  const teams = (globalData.teams as Record<string, Record<string, { home: string; away: string }>> | undefined) || {}
  return teams['stage1'] || {}
}

function useBracketSeries(): BracketSeriesMap {
  return (useGlobalStore((s) => s.globalData).bracketSeries as BracketSeriesMap | undefined) || {}
}

function formatIsraelTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('he-IL', {
      timeZone: 'Asia/Jerusalem',
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso))
  } catch {
    return ''
  }
}

function useBracketLocked() {
  const globalData = useGlobalStore((s) => s.globalData)
  const stageLocked = (globalData.stageLocked as boolean[] | undefined) || []
  // Locked when stage 1 (First Round, index 2 in STAGE_KEYS) is locked
  const stage1Idx = STAGE_KEYS.indexOf(1)
  return stageLocked[stage1Idx] || false
}

// ── Series card ──────────────────────────────────────────────────────────────

interface SeriesCardProps {
  seriesKey: string
  pick: BracketPick
  globalR1: Record<string, { home: string; away: string }>
  bracketSeries: BracketSeriesMap
  locked: boolean
  onAdjust?: (seriesKey: string, side: 'home' | 'away', delta: number) => void
  readonly?: boolean
}

function SeriesCard({ seriesKey, pick, globalR1, bracketSeries, locked, onAdjust, readonly }: SeriesCardProps) {
  const teams = getBracketTeams(seriesKey, pick, globalR1, bracketSeries)
  const p = pick[seriesKey] || { homeWins: 0, awayWins: 0 }
  const actual = bracketSeries[seriesKey]
  const { homeWins, awayWins } = p
  const homeWon = homeWins === 4
  const awayWon = awayWins === 4
  // Show placeholder only when neither team is known yet.
  // Partial state (one team known, one "?") is intentional — it happens when
  // the opponent hasn't been set (e.g. 8-seed pending play-in) and the user
  // still needs to enter win counts for that series.
  const noTeams = !teams.home && !teams.away

  const def = BRACKET_SERIES.find((s) => s.key === seriesKey)
  const isReadonly = readonly || locked

  function adjust(side: 'home' | 'away', delta: number) {
    if (isReadonly || noTeams || !onAdjust) return
    onAdjust(seriesKey, side, delta)
  }

  const conf = def?.conf || ''
  const borderColor = conf === 'east'
    ? 'rgba(79,195,247,0.35)'
    : conf === 'west'
    ? 'rgba(255,107,0,0.35)'
    : 'rgba(255,215,0,0.5)'

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
        <div className="br-card-empty">ממתין...</div>
      ) : (
        <>
          {/* Home team row */}
          <div className={`br-team-row${homeWon ? ' br-winner' : awayWon ? ' br-loser' : ''}`}>
            <span className="br-team-name"><TeamName name={teams.home || '?'} size={13} /></span>
            {!isReadonly && (
              <div className="br-win-ctrl">
                <button className="br-adj-btn" onClick={() => adjust('home', -1)} disabled={homeWins <= 0}>−</button>
                <span className={`br-win-num${homeWon ? ' br-win-bold' : ''}`}>{homeWins}</span>
                <button className="br-adj-btn" onClick={() => adjust('home', +1)} disabled={homeWins >= 4 || homeWins + awayWins >= 7}>+</button>
              </div>
            )}
            {isReadonly && <span className={`br-win-num-ro${homeWon ? ' br-win-bold' : ''}`}>{homeWins}</span>}
          </div>
          {/* Away team row */}
          <div className={`br-team-row${awayWon ? ' br-winner' : homeWon ? ' br-loser' : ''}`}>
            <span className="br-team-name"><TeamName name={teams.away || '?'} size={13} /></span>
            {!isReadonly && (
              <div className="br-win-ctrl">
                <button className="br-adj-btn" onClick={() => adjust('away', -1)} disabled={awayWins <= 0}>−</button>
                <span className={`br-win-num${awayWon ? ' br-win-bold' : ''}`}>{awayWins}</span>
                <button className="br-adj-btn" onClick={() => adjust('away', +1)} disabled={awayWins >= 4 || homeWins + awayWins >= 7}>+</button>
              </div>
            )}
            {isReadonly && <span className={`br-win-num-ro${awayWon ? ' br-win-bold' : ''}`}>{awayWins}</span>}
          </div>
          {/* Next game time (only when series is still in progress) */}
          {actual?.nextGame && !actual.winner && (
            <div className="br-next-game">
              {formatIsraelTime(actual.nextGame)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main bracket canvas ──────────────────────────────────────────────────────

interface BracketCanvasProps {
  pick: BracketPick
  globalR1: Record<string, { home: string; away: string }>
  bracketSeries: BracketSeriesMap
  locked: boolean
  onAdjust?: (seriesKey: string, side: 'home' | 'away', delta: number) => void
  readonly?: boolean
}

function BracketCanvas({ pick, globalR1, bracketSeries, locked, onAdjust, readonly }: BracketCanvasProps) {
  const CONF_LABELS = [
    { text: '🔵 מזרח', x: TOTAL_W - CARD_W / 2, y: -18, anchor: 'middle' },
    { text: '🔴 מערב', x: CARD_W / 2, y: -18, anchor: 'middle' },
    { text: 'גמר', x: 504 + CARD_W / 2, y: -18, anchor: 'middle' },
  ]

  return (
    <div style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8, direction: 'ltr' }}>
      <div style={{ position: 'relative', width: TOTAL_W, height: TOTAL_H + 30, marginTop: 24 }}>
        {/* Connector SVG */}
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          width={TOTAL_W}
          height={TOTAL_H + 30}
        >
          {/* Conf labels */}
          {CONF_LABELS.map((l, i) => (
            <text key={i} x={l.x} y={l.y + 30} textAnchor={l.anchor as 'middle'}
              fontSize={10} fontWeight={700} fill="rgba(255,255,255,0.35)"
              fontFamily="Heebo, sans-serif">
              {l.text}
            </text>
          ))}
          {/* Connector lines */}
          <g transform="translate(0,30)">
            {BRACKET_CONNECTOR_LINES.map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
            ))}
          </g>
        </svg>

        {/* Series cards */}
        <div style={{ position: 'absolute', top: 30, left: 0 }}>
          {BRACKET_SERIES.map((s) => (
            <SeriesCard
              key={s.key}
              seriesKey={s.key}
              pick={pick}
              globalR1={globalR1}
              bracketSeries={bracketSeries}
              locked={locked}
              onAdjust={onAdjust}
              readonly={readonly}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tab ──────────────────────────────────────────────────────────────────────

export default function BracketMyBetsTab() {
  const leagueData = useBracketLeagueStore((s) => s.currentBracketLeagueData)
  const currentUser = useAuthStore((s) => s.currentUser)
  const globalR1 = useGlobalR1Teams()
  const bracketSeries = useBracketSeries()
  const locked = useBracketLocked()

  const [pick, setPick] = useState<BracketPick>({})

  // Load existing bets
  useEffect(() => {
    if (!leagueData || !currentUser) return
    const existing = (leagueData.bets || {})[currentUser.uid] || {}
    setPick({ ...existing })
  }, [leagueData?.id, currentUser?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  function adjustWins(seriesKey: string, side: 'home' | 'away', delta: number) {
    setPick((prev) => {
      const cur = prev[seriesKey] || { homeWins: 0, awayWins: 0 }
      let { homeWins, awayWins } = cur
      if (side === 'home') homeWins = Math.max(0, Math.min(4, homeWins + delta))
      else awayWins = Math.max(0, Math.min(4, awayWins + delta))

      // Max 7 total games
      if (homeWins + awayWins > 7) {
        if (side === 'home') awayWins = 7 - homeWins
        else homeWins = 7 - awayWins
      }
      // If one hits 4, other maxes at 3
      if (homeWins === 4) awayWins = Math.min(awayWins, 3)
      if (awayWins === 4) homeWins = Math.min(homeWins, 3)

      const newPick: BracketPick = { ...prev, [seriesKey]: { homeWins, awayWins } }

      // Check if winner changed — if so, clear downstream.
      // Must pass bracketSeries so winner detection uses the same team resolution
      // as the display (getBracketTeamsWithActual). Without it, winner detection
      // fails when API has R2+ teams but user hasn't filled prior-round picks.
      const prevWinner = getBracketWinner(seriesKey, prev, globalR1, bracketSeries)
      const newWinner = getBracketWinner(seriesKey, newPick, globalR1, bracketSeries)
      if (newWinner !== prevWinner) {
        return clearDownstreamPicks(seriesKey, newPick)
      }
      return newPick
    })
  }

  async function handleSave() {
    if (!leagueData || !currentUser) return
    try {
      await saveBracketBet(leagueData.id, currentUser.uid, pick)
      toast('✅ הברקט נשמר!')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function handleClear() {
    if (!leagueData || !currentUser) return
    setPick({})
    await clearBracketBet(leagueData.id, currentUser.uid)
    toast('✅ הברקט נוקה!')
  }

  const r1TeamsReady = Object.keys(globalR1).length >= 8
  const completedCount = Object.keys(pick).filter((k) => {
    const p = pick[k]
    return p && (p.homeWins === 4 || p.awayWins === 4)
  }).length

  return (
    <div>
      {locked && (
        <div className="mb-3 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/5 p-3 text-sm text-[var(--red)]">
          🔒 הברקט ננעל — ניתן לצפות בהימורים בלבד
        </div>
      )}
      {!locked && !r1TeamsReady && (
        <div className="mb-3 rounded-lg border border-[rgba(255,215,0,0.3)] bg-[rgba(255,215,0,0.05)] p-3 text-sm text-[var(--gold)]">
          ⏳ ממתין לקביעת קבוצות הסיבוב הראשון על ידי המנהל
        </div>
      )}
      {!locked && r1TeamsReady && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-[var(--orange-border)] bg-[var(--dark3)] px-4 py-2 text-sm">
          <span className="text-[var(--text2)]">{completedCount}/15 סדרות הוזנו</span>
          <span className={completedCount === 15 ? 'text-[var(--green)] font-bold' : 'text-[var(--orange)]'}>
            {completedCount === 15 ? '✅ הברקט מלא!' : `⚠️ חסרות ${15 - completedCount}`}
          </span>
        </div>
      )}

      {/* Bracket visual */}
      <BracketCanvas
        pick={pick}
        globalR1={globalR1}
        bracketSeries={bracketSeries}
        locked={locked}
        onAdjust={adjustWins}
        readonly={locked || !r1TeamsReady}
      />

      {/* Save buttons */}
      {!locked && r1TeamsReady && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={handleSave}>💾 שמור ברקט</Button>
          <Button variant="secondary" size="sm" onClick={handleClear}>🔄 נקה הכל</Button>
        </div>
      )}
    </div>
  )
}
