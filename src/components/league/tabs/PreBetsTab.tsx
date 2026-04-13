import { useLeagueStore } from '@/store/league.store'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { STAGE_MATCHES, PREBETS } from '@/lib/constants'
import { Card, CardTitle } from '@/components/ui/card'
import { TeamName } from '@/components/ui/TeamName'

export default function PreBetsTab() {
  const leagueData = useLeagueStore((s) => s.currentLeagueData)
  const currentUser = useAuthStore((s) => s.currentUser)
  const { getTeams, isPreBetsLocked } = useGlobalHelpers()

  if (!leagueData || !currentUser) return null

  const bet = ((leagueData.bets || {})[currentUser.uid] || {})['stage1'] || {}
  const locked = isPreBetsLocked()

  const eastT: string[] = [], westT: string[] = []
  for (const m of STAGE_MATCHES[1]) {
    const t = getTeams(1, m.key)
    if (m.conf === 'east') { if (t.home) eastT.push(t.home); if (t.away) eastT.push(t.away) }
    else { if (t.home) westT.push(t.home); if (t.away) westT.push(t.away) }
  }

  return (
    <Card>
      <CardTitle>🏆 הימורים מוקדמים</CardTitle>
      {!eastT.length && !westT.length ? (
        <div className="text-sm text-[var(--text2)]">⏳ ממתין לקביעת קבוצות סיבוב ראשון</div>
      ) : (
        <div>
          {locked && <div className="mb-3 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/5 p-2 text-xs text-[var(--red)]">🔒 הימורים מוקדמים ננעלו</div>}
          {PREBETS.map((p) => (
            <div key={p.key} className="bet-item">
              <span className="bet-label">{p.label}</span>
              <span className="bet-value pending"><TeamName name={bet[p.key] || '-'} size={16} /></span>
            </div>
          ))}
        </div>
      )}
    </Card>
  )
}
