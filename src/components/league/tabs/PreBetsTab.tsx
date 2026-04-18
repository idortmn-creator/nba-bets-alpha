import { useLeagueStore } from '@/store/league.store'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { STAGE_MATCHES, PREBETS } from '@/lib/constants'
import { Card, CardTitle } from '@/components/ui/card'
import { TeamName } from '@/components/ui/TeamName'

export default function PreBetsTab() {
  const leagueData = useLeagueStore((s) => s.currentLeagueData)
  const currentUser = useAuthStore((s) => s.currentUser)
  const { getTeams, isPreBetsLocked, getGlobal } = useGlobalHelpers()

  if (!leagueData || !currentUser) return null

  const myBet    = ((leagueData.bets || {})[currentUser.uid] || {})['stage1'] || {}
  const locked   = isPreBetsLocked()
  const members  = leagueData.members || []
  const memberInfo = leagueData.memberInfo || {}

  // Pre-bet results live in global/settings.results.stage1
  const results  = ((getGlobal('results', {}) as Record<string, any>)['stage1'] || {}) as Record<string, string>

  const eastT: string[] = [], westT: string[] = []
  for (const m of STAGE_MATCHES[1]) {
    const t = getTeams(1, m.key)
    if (m.conf === 'east') { if (t.home) eastT.push(t.home); if (t.away) eastT.push(t.away) }
    else                   { if (t.home) westT.push(t.home); if (t.away) westT.push(t.away) }
  }

  return (
    <Card>
      <CardTitle>🏆 הימורים מוקדמים</CardTitle>

      {!eastT.length && !westT.length ? (
        <div className="text-sm text-[var(--text2)]">⏳ ממתין לקביעת קבוצות סיבוב ראשון</div>
      ) : (
        <div>
          {locked && (
            <div className="mb-3 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/5 p-2 text-xs text-[var(--red)]">
              🔒 הימורים מוקדמים ננעלו
            </div>
          )}

          {/* ── My bets ── */}
          {PREBETS.map((p) => {
            const bv  = myBet[p.key] || '-'
            const cls = locked && results[p.key]
              ? (bv.toLowerCase() === results[p.key].toLowerCase() ? 'correct' : 'wrong')
              : 'pending'
            return (
              <div key={p.key} className="bet-item">
                <span className="bet-label">{p.label}</span>
                <span className={`bet-value ${cls}`}><TeamName name={bv} size={16} /></span>
              </div>
            )
          })}

          {/* ── Distribution — visible only after lock ── */}
          {locked && (
            <div className="mt-4 space-y-4">
              <div className="font-oswald text-sm text-[var(--text2)] border-t border-[var(--border)] pt-3">
                התפלגות תחזיות
              </div>
              {PREBETS.map((p) => {
                const correctAns = (results[p.key] || '').toLowerCase()
                const tally: Record<string, { count: number; correct: boolean; users: string[] }> = {}

                members.forEach((uid: string) => {
                  const b    = ((leagueData.bets || {})[uid] || {})['stage1'] || {}
                  const pick = (b[p.key] || '') as string
                  if (!pick) return
                  if (!tally[pick]) tally[pick] = { count: 0, correct: false, users: [] }
                  tally[pick].count++
                  tally[pick].users.push(memberInfo[uid]?.username || uid)
                  if (correctAns && pick.toLowerCase() === correctAns) tally[pick].correct = true
                })

                const total   = members.length || 1
                const entries = Object.entries(tally).sort(([, a], [, b]) => b.count - a.count)

                return (
                  <div key={p.key}>
                    <div className="mb-1.5 font-oswald text-sm text-[var(--gold)]">{p.label}</div>
                    {results[p.key] && (
                      <div className="mb-2 text-xs text-[var(--blue)]">
                        תשובה נכונה: <TeamName name={results[p.key]} size={14} />
                      </div>
                    )}
                    {entries.length === 0 ? (
                      <div className="text-xs text-[var(--text2)]">אין הימורים</div>
                    ) : (
                      entries.map(([pick, t]) => {
                        const cls = correctAns ? (t.correct ? 'correct' : 'wrong') : 'pending'
                        const pct = Math.round((t.count / total) * 100)
                        return (
                          <div key={pick} className="series-tally-row">
                            <span className={`bet-value ${cls}`} style={{ minWidth: 90 }}>
                              <TeamName name={pick} size={14} />
                            </span>
                            <div className="tally-bar-wrap">
                              <div className="tally-bar" style={{ width: `${pct}%` }} />
                            </div>
                            <span className="tally-count">{t.count}/{total}</span>
                            <div className="tally-names">{t.users.join(', ')}</div>
                          </div>
                        )
                      })
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
