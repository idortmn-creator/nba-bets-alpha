import { useState, useEffect, useCallback, useRef } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'
import { useGlobalStore } from '@/store/global.store'
import { STAGE_KEYS, STAGE_SHORT } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'
import { TeamName } from '@/components/ui/TeamName'

// ── Types ────────────────────────────────────────────────────────────────────

interface LiveGame {
  id: number
  date: { start: string; end: string | null }
  stage: number
  status: {
    clock: string | null
    halftime: boolean
    short: number   // 1 = Not Started, 2 = In Play, 3 = Finished
    long: string
  }
  teams: {
    home:     { id: number; name: string; nickname: string; code: string }
    visitors: { id: number; name: string; nickname: string; code: string }
  }
  scores: {
    home:     { series: { win: number; loss: number } | null; points: number | null }
    visitors: { series: { win: number; loss: number } | null; points: number | null }
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const getLiveGamesFn = httpsCallable(functions, 'getLiveGames')

function statusLabel(game: LiveGame): string {
  const { short, halftime, clock, long } = game.status
  if (short === 3) return 'סופי'
  if (short === 1) return 'טרם החל'
  if (halftime) return 'הפסקה'
  if (clock && long) return `${translatePeriod(long)} | ${clock}`
  return translatePeriod(long) || 'חי'
}

function translatePeriod(long: string): string {
  const map: Record<string, string> = {
    'Q1': 'רבע 1', '1st Qtr': 'רבע 1',
    'Q2': 'רבע 2', '2nd Qtr': 'רבע 2',
    'Q3': 'רבע 3', '3rd Qtr': 'רבע 3',
    'Q4': 'רבע 4', '4th Qtr': 'רבע 4',
    'Half Time': 'הפסקה', 'Halftime': 'הפסקה',
    'Over Time': 'הארכה', 'OT': 'הארכה',
    'In Play': 'חי', 'Finished': 'סופי',
    'Not Started': 'טרם החל', 'Scheduled': 'מתוכנן',
  }
  return map[long] ?? long
}

function gameTimeIL(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  })
}

function toILDate(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' })
}

function formatDateHeader(dateStr: string): string {
  const now = new Date()
  const todayStr     = toILDate(now)
  const yesterdayStr = toILDate(new Date(now.getTime() - 86400000))
  const tomorrowStr  = toILDate(new Date(now.getTime() + 86400000))

  if (dateStr === todayStr)     return 'היום'
  if (dateStr === yesterdayStr) return 'אתמול'
  if (dateStr === tomorrowStr)  return 'מחר'

  return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC',
  })
}

function getDateRange(): string[] {
  const now = new Date()
  return [-1, 0, 1].map((offset) =>
    toILDate(new Date(now.getTime() + offset * 86400000))
  )
}

/** Returns ms until the next scheduled refresh at 06:00 or 08:00 Israel time. */
function getNextRefreshDelayMs(): number {
  const now = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now)

  const h = parseInt(parts.find(p => p.type === 'hour')!.value)
  const m = parseInt(parts.find(p => p.type === 'minute')!.value)
  const nowMinutes = h * 60 + m

  for (const rt of [6 * 60, 8 * 60]) {
    if (nowMinutes < rt) return (rt - nowMinutes) * 60 * 1000
  }
  // Past 08:00 IL — next refresh is tomorrow at 06:00
  return (24 * 60 - nowMinutes + 6 * 60) * 60 * 1000
}

function sortGames(games: LiveGame[]): LiveGame[] {
  const order = (s: number) => (s === 2 ? 0 : s === 1 ? 1 : 2)
  return [...games].sort((a, b) => order(a.status.short) - order(b.status.short))
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LiveResultsTab() {
  const [gamesByDate, setGamesByDate] = useState<Record<string, LiveGame[]>>({})
  const [loading, setLoading]         = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const globalData   = useGlobalStore(s => s.globalData)
  const currentStage = (globalData?.currentStage ?? 0) as StageKey
  const stageIdx     = STAGE_KEYS.indexOf(currentStage)
  const stageName    = stageIdx >= 0 ? STAGE_SHORT[stageIdx] : 'פלייאוף'

  const loadGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const dates = getDateRange()
      const results: Record<string, LiveGame[]> = {}

      await Promise.all(dates.map(async (date) => {
        try {
          const res  = await getLiveGamesFn({ season: 2025, date })
          const data = res.data as { ok: boolean; games: LiveGame[]; error?: string }
          if (data.ok && data.games?.length) results[date] = data.games
        } catch {
          // skip failed date silently
        }
      }))

      setGamesByDate(results)
      setLastRefresh(new Date())
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      setError(err.message ?? err.code ?? String(e))
    } finally {
      setLoading(false)
    }
  }, [])

  const scheduleNextRefresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      loadGames()
      scheduleNextRefresh()
    }, getNextRefreshDelayMs())
  }, [loadGames])

  useEffect(() => {
    loadGames()
    scheduleNextRefresh()
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [loadGames, scheduleNextRefresh])

  const datesWithGames = getDateRange().filter(d => gamesByDate[d]?.length)
  const hasGames = datesWithGames.length > 0

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-bold text-[var(--orange)]">📅 תוצאות ומשחקים קרובים</div>
        <div className="flex items-center gap-2">
          {lastRefresh && (
            <span className="text-xs text-[var(--text2)]">
              עודכן: {lastRefresh.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={loadGames}
            disabled={loading}
            className="text-xs px-2 py-1 rounded bg-[var(--dark3)] text-[var(--text2)] hover:text-[var(--text1)] disabled:opacity-50 transition-colors"
          >
            {loading ? '⏳' : '🔄'} רענן
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-[rgba(255,80,80,0.3)] bg-[rgba(255,80,80,0.08)] p-3 text-xs text-[var(--red)] mb-3">
          ❌ {error}
        </div>
      )}

      {/* Loading */}
      {loading && !hasGames && (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasGames && !error && (
        <div className="py-12 text-center text-[var(--text2)] text-sm">
          אין משחקי פלייאוף בטווח הקרוב
        </div>
      )}

      {/* Games grouped by date */}
      <div className="space-y-5">
        {datesWithGames.map((date) => (
          <div key={date}>
            {/* Date header */}
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-bold text-[var(--text1)]">
                {formatDateHeader(date)}
              </span>
              <span className="text-[0.6rem] font-bold tracking-wider px-2 py-0.5 rounded-full bg-[rgba(255,165,0,0.15)] text-[var(--orange)]">
                {stageName}
              </span>
            </div>

            <div className="space-y-2">
              {sortGames(gamesByDate[date]).map((game) => (
                <GameCard key={game.id} game={game} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Footer note */}
      {hasGames && (
        <div className="mt-4 text-xs text-[var(--text2)] text-center">
          מתרענן אוטומטית בשעות 06:00 ו-08:00 (שעון ישראל)
        </div>
      )}
    </div>
  )
}

// ── GameCard sub-component ────────────────────────────────────────────────────

function GameCard({ game }: { game: LiveGame }) {
  const isLive     = game.status.short === 2
  const isFinished = game.status.short === 3
  const hp = game.scores.home.points
  const ap = game.scores.visitors.points
  const hasScore  = hp !== null && ap !== null
  const homeLeads = hasScore && hp! > ap!
  const awayLeads = hasScore && ap! > hp!

  return (
    <div
      className={`rounded-2xl border p-3 transition-colors ${
        isLive
          ? 'border-[rgba(0,220,100,0.35)] bg-[rgba(0,220,100,0.04)]'
          : 'border-[var(--card-border)] bg-[var(--card-bg)]'
      }`}
    >
      {/* Status + time row */}
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[0.62rem] font-bold tracking-wider px-2 py-0.5 rounded-full"
          style={{
            color: isLive ? 'var(--green)' : isFinished ? 'var(--text2)' : 'var(--orange)',
            background: isLive
              ? 'rgba(0,220,100,0.15)'
              : isFinished
              ? 'rgba(255,255,255,0.06)'
              : 'rgba(255,165,0,0.15)',
          }}
        >
          {isLive && (
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--green)] mr-1 animate-pulse" />
          )}
          {statusLabel(game)}
        </span>

        {!isLive && !isFinished && (
          <span className="text-xs text-[var(--text2)]">{gameTimeIL(game.date.start)}</span>
        )}
      </div>

      {/* Teams + Score */}
      <div className="flex items-center gap-2">
        {/* Home */}
        <div className="flex-1 min-w-0">
          <div
            className={`text-sm font-bold ${
              homeLeads ? 'text-[var(--text1)]' : hasScore ? 'text-[var(--text2)]' : 'text-[var(--text1)]'
            }`}
          >
            <TeamName name={game.teams.home.name} size={16} />
          </div>
        </div>

        {/* Score / vs */}
        <div className="flex-shrink-0 text-center px-1">
          {hasScore ? (
            <div className="flex items-center gap-1.5">
              <span
                className={`text-2xl font-oswald font-bold leading-none ${homeLeads ? 'text-[var(--orange)]' : 'text-[var(--text2)]'}`}
              >{hp}</span>
              <span className="text-[var(--text2)] text-xs">—</span>
              <span
                className={`text-2xl font-oswald font-bold leading-none ${awayLeads ? 'text-[var(--orange)]' : 'text-[var(--text2)]'}`}
              >{ap}</span>
            </div>
          ) : (
            <span className="text-[var(--text2)] text-sm font-bold">מול</span>
          )}
        </div>

        {/* Away */}
        <div className="flex-1 min-w-0 text-end">
          <div
            className={`text-sm font-bold ${
              awayLeads ? 'text-[var(--text1)]' : hasScore ? 'text-[var(--text2)]' : 'text-[var(--text1)]'
            }`}
          >
            <TeamName name={game.teams.visitors.name} size={16} />
          </div>
        </div>
      </div>
    </div>
  )
}
