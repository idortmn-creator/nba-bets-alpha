import { useState, useEffect, useCallback } from 'react'
import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase'

// ── Types (mirrors functions/src/nbaApi.ts NBAGame) ─────────────────────────

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
    'In Play': 'חי',
    'Finished': 'סופי',
    'Not Started': 'טרם החל',
    'Scheduled': 'מתוכנן',
  }
  return map[long] ?? long
}

function gameTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  })
}

function sortGames(games: LiveGame[]): LiveGame[] {
  const order = (s: number) => (s === 2 ? 0 : s === 1 ? 1 : 2)
  return [...games].sort((a, b) => order(a.status.short) - order(b.status.short))
}

// ── Component ────────────────────────────────────────────────────────────────

export default function LiveResultsTab() {
  const [games, setGames] = useState<LiveGame[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)

  const loadGames = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getLiveGamesFn({ season: 2025 })
      const data = res.data as { ok: boolean; games: LiveGame[] }
      setGames(data.games ?? [])
      setLastRefresh(new Date())
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string }
      const msg = err.message ?? err.code ?? String(e)
      setError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial load + auto-refresh every 5 minutes
  useEffect(() => {
    loadGames()
    const interval = setInterval(loadGames, 5 * 60 * 1000)
    return () => clearInterval(interval)
  }, [loadGames])

  const sorted = sortGames(games)

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-bold text-[var(--orange)]">📺 תוצאות היום — פלייאוף</div>
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

      {/* Loading skeleton */}
      {loading && games.length === 0 && (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      )}

      {/* Empty state */}
      {!loading && games.length === 0 && !error && (
        <div className="py-12 text-center text-[var(--text2)] text-sm">
          אין משחקי פלייאוף היום
        </div>
      )}

      {/* Games */}
      <div className="space-y-3">
        {sorted.map((game) => {
          const isLive     = game.status.short === 2
          const isFinished = game.status.short === 3
          const hp = game.scores.home.points
          const ap = game.scores.visitors.points
          const hasScore   = hp !== null && ap !== null
          const homeLeads  = hasScore && hp! > ap!
          const awayLeads  = hasScore && ap! > hp!
          const hw = game.scores.home.series?.win ?? 0
          const aw = game.scores.visitors.series?.win ?? 0
          const hasSeriesRecord = hw > 0 || aw > 0

          return (
            <div
              key={game.id}
              className={`rounded-2xl border p-4 transition-colors ${
                isLive
                  ? 'border-[rgba(0,220,100,0.35)] bg-[rgba(0,220,100,0.04)]'
                  : 'border-[var(--card-border)] bg-[var(--card-bg)]'
              }`}
            >
              {/* Status + meta row */}
              <div className="flex items-center justify-between mb-3">
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
                  {isLive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-[var(--green)] mr-1 animate-pulse" />}
                  {statusLabel(game)}
                </span>

                <div className="flex items-center gap-3 text-xs text-[var(--text2)]">
                  {!isLive && !isFinished && (
                    <span>{gameTime(game.date.start)}</span>
                  )}
                  {hasSeriesRecord && (
                    <span>
                      סדרה: {game.teams.home.nickname} {hw}–{aw} {game.teams.visitors.nickname}
                    </span>
                  )}
                </div>
              </div>

              {/* Teams + Score */}
              <div className="flex items-center gap-2">
                {/* Home */}
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-bold text-sm truncate ${
                      homeLeads ? 'text-[var(--text1)]' : hasScore ? 'text-[var(--text2)]' : 'text-[var(--text1)]'
                    }`}
                  >
                    {game.teams.home.name}
                  </div>
                  {hasSeriesRecord && (
                    <div className="text-[0.6rem] text-[var(--text2)] mt-0.5">{hw} נצחונות</div>
                  )}
                </div>

                {/* Score / vs */}
                <div className="flex-shrink-0 text-center px-2">
                  {hasScore ? (
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`text-2xl font-oswald font-bold leading-none ${homeLeads ? 'text-[var(--orange)]' : 'text-[var(--text2)]'}`}
                      >
                        {hp}
                      </span>
                      <span className="text-[var(--text2)] text-xs">—</span>
                      <span
                        className={`text-2xl font-oswald font-bold leading-none ${awayLeads ? 'text-[var(--orange)]' : 'text-[var(--text2)]'}`}
                      >
                        {ap}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[var(--text2)] text-sm font-bold">מול</span>
                  )}
                </div>

                {/* Away */}
                <div className="flex-1 min-w-0 text-end">
                  <div
                    className={`font-bold text-sm truncate ${
                      awayLeads ? 'text-[var(--text1)]' : hasScore ? 'text-[var(--text2)]' : 'text-[var(--text1)]'
                    }`}
                  >
                    {game.teams.visitors.name}
                  </div>
                  {hasSeriesRecord && (
                    <div className="text-[0.6rem] text-[var(--text2)] mt-0.5">{aw} נצחונות</div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer note */}
      {games.length > 0 && (
        <div className="mt-4 text-xs text-[var(--text2)] text-center">
          מתרענן אוטומטית כל 5 דקות
        </div>
      )}
    </div>
  )
}
