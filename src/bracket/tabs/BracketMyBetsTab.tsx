import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalStore } from '@/store/global.store'
import { useBracketLeagueStore } from '../bracketLeague.store'
import { saveBracketBet, clearBracketBet, saveMvpBet, saveTiebreakerBet } from '../bracketLeague.service'
import BracketShareBar from '../BracketShareBar'
import BracketFullScreenModal from '../BracketFullScreenModal'
import { drawBracketImage, shareBracketImage } from '../bracketCapture'
import {
  BRACKET_SERIES, BRACKET_POSITIONS, BRACKET_CONNECTOR_LINES,
  CARD_W, CARD_H, TOTAL_H, TOTAL_W,
  getBracketTeams, getBracketWinner, clearDownstreamPicks,
} from '../bracketConstants'
import type { BracketPick, BracketSeriesMap, BracketMvpPick } from '../bracketConstants'
import { TeamName } from '@/components/ui/TeamName'
import { fetchTwoTeamRoster } from '@/lib/espnRoster'

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
  const manualLocked = (globalData.bracketLocked as boolean | undefined) || false
  const autoLockTs   = (globalData.bracketAutoLock as number | undefined) || 0
  return manualLocked || (autoLockTs > 0 && Date.now() >= autoLockTs)
}

function useBracketTiebreaker() {
  const globalData = useGlobalStore((s) => s.globalData)
  return {
    question: (globalData.bracketTiebreakerQuestion as string | undefined) || '',
    locked:   (globalData.bracketTiebreakerLocked as boolean | undefined) || false,
  }
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

// ── MVP Picker ───────────────────────────────────────────────────────────────

const MVP_SERIES: { key: 'cf_east' | 'cf_west' | 'finals'; label: string }[] = [
  { key: 'cf_east', label: 'גמר מזרח — MVP' },
  { key: 'cf_west', label: 'גמר מערב — MVP' },
  { key: 'finals',  label: 'גמר NBA — MVP' },
]

interface MvpPickerProps {
  label: string
  home: string
  away: string
  selected: string
  locked: boolean
  onSelect: (player: string) => void
}

function MvpPicker({ label, home, away, selected, locked, onSelect }: MvpPickerProps) {
  const [open, setOpen] = useState(false)
  const [players, setPlayers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)
  const prevTeamsRef = useRef('')

  const teamsKey = `${home}|${away}`
  const teamsKnown = !!(home && away)

  useEffect(() => {
    if (!teamsKnown || prevTeamsRef.current === teamsKey) return
    prevTeamsRef.current = teamsKey
    setPlayers([])
    setLoading(true)
    fetchTwoTeamRoster(home, away).then((p) => {
      setPlayers(p)
      setLoading(false)
    })
  }, [teamsKey, teamsKnown, home, away])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  const filtered = search
    ? players.filter((p) => p.toLowerCase().includes(search.toLowerCase()))
    : players

  if (!teamsKnown) return null

  return (
    <div className="mvp-picker-row" ref={dropRef}>
      <span className="mvp-picker-label">{label}</span>
      <div className="mvp-picker-teams">
        <TeamName name={home} size={11} />
        <span className="mvp-picker-vs">מול</span>
        <TeamName name={away} size={11} />
      </div>
      {locked ? (
        <span className="mvp-picker-value">{selected || '—'}</span>
      ) : (
        <div style={{ position: 'relative' }}>
          <button
            className="mvp-picker-btn"
            onClick={() => setOpen((v) => !v)}
            disabled={loading}
          >
            {loading ? '⏳' : selected ? selected : 'בחר MVP'}
            <span style={{ marginRight: 4, opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
          </button>
          {open && (
            <div className="mvp-dropdown">
              <input
                className="mvp-search"
                autoFocus
                placeholder="חיפוש שחקן..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="mvp-list">
                {filtered.length === 0 && (
                  <div className="mvp-empty">{loading ? 'טוען...' : 'לא נמצאו שחקנים'}</div>
                )}
                {filtered.map((p) => (
                  <div
                    key={p}
                    className={`mvp-item${p === selected ? ' mvp-item-selected' : ''}`}
                    onClick={() => { onSelect(p); setOpen(false); setSearch('') }}
                  >
                    {p}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
        <svg
          style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
          width={TOTAL_W}
          height={TOTAL_H + 30}
        >
          {CONF_LABELS.map((l, i) => (
            <text key={i} x={l.x} y={l.y + 30} textAnchor={l.anchor as 'middle'}
              fontSize={10} fontWeight={700} fill="rgba(255,255,255,0.35)"
              fontFamily="Heebo, sans-serif">
              {l.text}
            </text>
          ))}
          <g transform="translate(0,30)">
            {BRACKET_CONNECTOR_LINES.map(([x1, y1, x2, y2], i) => (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
            ))}
          </g>
        </svg>

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
  const navigate = useNavigate()
  const globalLeagueData = useBracketLeagueStore((s) => s.globalBracketLeagueData)
  const currentUser = useAuthStore((s) => s.currentUser)
  const globalR1 = useGlobalR1Teams()
  const bracketSeries = useBracketSeries()
  const locked = useBracketLocked()

  const [pick, setPick] = useState<BracketPick>({})
  const [mvpPick, setMvpPick] = useState<BracketMvpPick>({})
  const [tiebreakerAnswer, setTiebreakerAnswer] = useState('')
  const [showSaveModal, setShowSaveModal] = useState(false)
  const [showFullScreen, setShowFullScreen] = useState(false)

  const tiebreaker = useBracketTiebreaker()

  // Load existing bets from global league
  useEffect(() => {
    if (!globalLeagueData || !currentUser) return
    const existing = (globalLeagueData.bets || {})[currentUser.uid] || {}
    setPick({ ...existing })
    const existingMvp = (globalLeagueData.mvpBets || {})[currentUser.uid] || {}
    setMvpPick({ ...existingMvp })
    const existingTb = ((globalLeagueData as Record<string, unknown>).tiebreakerBets as Record<string, number> | undefined)?.[currentUser.uid]
    setTiebreakerAnswer(existingTb != null ? String(existingTb) : '')
  }, [globalLeagueData?.id, currentUser?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  function adjustWins(seriesKey: string, side: 'home' | 'away', delta: number) {
    setPick((prev) => {
      const cur = prev[seriesKey] || { homeWins: 0, awayWins: 0 }
      let { homeWins, awayWins } = cur
      if (side === 'home') homeWins = Math.max(0, Math.min(4, homeWins + delta))
      else awayWins = Math.max(0, Math.min(4, awayWins + delta))

      if (homeWins + awayWins > 7) {
        if (side === 'home') awayWins = 7 - homeWins
        else homeWins = 7 - awayWins
      }
      if (homeWins === 4) awayWins = Math.min(awayWins, 3)
      if (awayWins === 4) homeWins = Math.min(homeWins, 3)

      const newPick: BracketPick = { ...prev, [seriesKey]: { homeWins, awayWins } }

      const prevWinner = getBracketWinner(seriesKey, prev, globalR1, bracketSeries)
      const newWinner = getBracketWinner(seriesKey, newPick, globalR1, bracketSeries)
      if (newWinner !== prevWinner) {
        return clearDownstreamPicks(seriesKey, newPick)
      }
      return newPick
    })
  }

  async function handleSave() {
    if (!currentUser) return
    try {
      await saveBracketBet(currentUser.uid, pick)
      setShowSaveModal(true)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function handleClear() {
    if (!currentUser) return
    setPick({})
    await clearBracketBet(currentUser.uid)
    toast('✅ הברקט נוקה!')
  }

  async function handleMvpSelect(seriesKey: 'cf_east' | 'cf_west' | 'finals', player: string) {
    if (!currentUser) return
    setMvpPick((prev) => ({ ...prev, [seriesKey]: player }))
    try {
      await saveMvpBet(currentUser.uid, seriesKey, player)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function handleTiebreakerBlur() {
    if (!currentUser || tiebreaker.locked) return
    const trimmed = tiebreakerAnswer.trim()
    if (trimmed === '') {
      await saveTiebreakerBet(currentUser.uid, null).catch(() => {})
      return
    }
    const num = parseFloat(trimmed)
    if (isNaN(num)) return
    try {
      await saveTiebreakerBet(currentUser.uid, num)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const r1TeamsReady = Object.keys(globalR1).length >= 8
  const completedCount = Object.keys(pick).filter((k) => {
    const p = pick[k]
    return p && (p.homeWins === 4 || p.awayWins === 4)
  }).length

  const username = globalLeagueData?.memberInfo?.[currentUser?.uid || '']?.username || currentUser?.uid || ''

  async function handleShare() {
    try {
      const blob = await drawBracketImage(pick, globalR1, bracketSeries, username)
      await shareBracketImage(blob)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

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

      <BracketCanvas
        pick={pick}
        globalR1={globalR1}
        bracketSeries={bracketSeries}
        locked={locked}
        onAdjust={adjustWins}
        readonly={locked || !r1TeamsReady}
      />

      {r1TeamsReady && (
        <div className="mvp-section">
          <div className="mvp-section-title">🏆 בחירת MVP לסדרה</div>
          {MVP_SERIES.map(({ key, label }) => {
            const teams = getBracketTeams(key, pick, globalR1, bracketSeries)
            return (
              <MvpPicker
                key={key}
                label={label}
                home={teams.home}
                away={teams.away}
                selected={mvpPick[key] || ''}
                locked={locked}
                onSelect={(player) => handleMvpSelect(key, player)}
              />
            )
          })}
        </div>
      )}

      {/* Tiebreaker question */}
      {tiebreaker.question && (
        <div className="br-tiebreaker-wrap">
          <div className={`tiebreaker-card br-tiebreaker-card${tiebreaker.locked ? ' opacity-70' : ''}`}>
            <div className="tiebreaker-header">
              <span className="tiebreaker-icon">🎯</span>
              <span className="tiebreaker-title">שאלת שובר שוויון</span>
              {tiebreaker.locked && <span className="br-tb-locked-badge">🔒 ננעל</span>}
            </div>
            <p className="tiebreaker-q">{tiebreaker.question}</p>
            <p className="tiebreaker-hint">תשובה מספרית — תשמש לשבירת שוויון בסוף הפלייאוף</p>
            {tiebreaker.locked ? (
              <div className="br-tb-locked-value">{tiebreakerAnswer || '—'}</div>
            ) : (
              <input
                type="number"
                className="tiebreaker-input br-tb-input"
                placeholder="הזן מספר..."
                value={tiebreakerAnswer}
                onChange={(e) => setTiebreakerAnswer(e.target.value)}
                onBlur={handleTiebreakerBlur}
              />
            )}
          </div>
        </div>
      )}

      {!locked && r1TeamsReady && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <Button onClick={handleSave}>💾 שמור ברקט</Button>
          <Button variant="secondary" size="sm" onClick={handleClear}>🔄 נקה הכל</Button>
          <Button variant="secondary" size="sm" onClick={() => setShowFullScreen(true)}>🔍 צפה בברקט מלא</Button>
        </div>
      )}

      {locked && (
        <div className="mt-3 flex items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowFullScreen(true)}>🔍 צפה בברקט מלא</Button>
        </div>
      )}

      <div className="mt-4">
        <BracketShareBar onShare={handleShare} />
      </div>

      {/* Save success popup */}
      {showSaveModal && (
        <div className="brfs-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowSaveModal(false) }}>
          <div className="br-save-modal">
            <div className="br-save-modal-icon">✅</div>
            <div className="br-save-modal-title">הברקט נשמר!</div>
            <div className="br-save-modal-sub">מה תרצה לעשות עכשיו?</div>
            <div className="br-save-modal-btns">
              <Button onClick={() => navigate('/bracket')}>🏠 חזור לדף הבית</Button>
              <Button variant="secondary" onClick={() => { setShowSaveModal(false); setShowFullScreen(true) }}>
                📊 צפה בברקט שלי
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Full screen bracket view */}
      {showFullScreen && (
        <BracketFullScreenModal
          pick={pick}
          mvpPick={mvpPick}
          globalR1={globalR1}
          bracketSeries={bracketSeries}
          username={username}
          onClose={() => setShowFullScreen(false)}
        />
      )}
    </div>
  )
}
