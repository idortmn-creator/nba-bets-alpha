import { useState } from 'react'
import { Users, BarChart2 } from 'lucide-react'
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
  const [subTab, setSubTab] = useState<'participant' | 'bet'>('participant')

  if (!leagueData || !currentUser) return null

  const locked     = isPreBetsLocked()
  const members    = leagueData.members || []
  const memberInfo = leagueData.memberInfo || {}
  const results    = ((getGlobal('results', {}) as Record<string, any>)['stage1'] || {}) as Record<string, string>

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

      ) : !locked ? (
        /* ── Not locked — show only current user's own bets ── */
        <div>
          <div className="mb-3 rounded-lg border border-[var(--orange)]/30 bg-[var(--orange)]/5 p-2 text-xs text-[var(--text2)]">
            🔓 תחזיות כל המשתתפים יוצגו לאחר נעילת הסדרה הראשונה בסיבוב 1
          </div>
          {PREBETS.map((p) => {
            const myBet = ((leagueData.bets || {})[currentUser.uid] || {})['stage1'] || {}
            return (
              <div key={p.key} className="bet-item">
                <span className="bet-label">{p.label}</span>
                <span className="bet-value pending"><TeamName name={myBet[p.key] || '-'} size={16} /></span>
              </div>
            )
          })}
        </div>

      ) : (
        /* ── Locked — full two-tab view ── */
        <div>
          <div className="mb-3 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/5 p-2 text-xs text-[var(--red)]">
            🔒 הימורים מוקדמים ננעלו
          </div>

          {/* Sub-tab switcher */}
          <div className="mb-4 flex rounded-lg border border-white/10 bg-white/5 p-0.5">
            <button
              onClick={() => setSubTab('participant')}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-all',
                subTab === 'participant' ? 'bg-[var(--orange)] text-white shadow-sm' : 'text-[var(--text2)] hover:text-[var(--text1)]',
              ].join(' ')}
            >
              <Users size={14} />לפי משתתף
            </button>
            <button
              onClick={() => setSubTab('bet')}
              className={[
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-all',
                subTab === 'bet' ? 'bg-[var(--orange)] text-white shadow-sm' : 'text-[var(--text2)] hover:text-[var(--text1)]',
              ].join(' ')}
            >
              <BarChart2 size={14} />לפי הימור
            </button>
          </div>

          {subTab === 'participant' ? (
            /* ── Per-participant: every member's three picks ── */
            <div className="grid gap-2">
              {members.map((uid: string) => {
                const info  = memberInfo[uid] || {}
                const b     = ((leagueData.bets || {})[uid] || {})['stage1'] || {}
                const isMe  = uid === currentUser.uid
                return (
                  <div key={uid} className="bet-card-compact">
                    <div className="bet-header-compact">
                      <div className="min-w-0">
                        <div className="bet-username-compact">
                          {info.username || uid}
                          {isMe && <span className="mr-1.5 text-[0.6rem] text-[var(--orange)]">אתה</span>}
                        </div>
                        {info.displayName && <div className="bet-displayname-compact">{info.displayName}</div>}
                      </div>
                    </div>
                    <div className="bet-rows-compact">
                      {PREBETS.map((p) => {
                        const bv  = b[p.key] || '-'
                        const cls = results[p.key]
                          ? (bv.toLowerCase() === results[p.key].toLowerCase() ? 'correct' : 'wrong')
                          : 'pending'
                        return (
                          <div key={p.key} className="bet-item">
                            <span className="bet-label">{p.label}</span>
                            <span className={`bet-value ${cls}`}><TeamName name={bv} size={13} /></span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            /* ── Per-bet: distribution bar chart per question ── */
            <div className="space-y-4">
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
