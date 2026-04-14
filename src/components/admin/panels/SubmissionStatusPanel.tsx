import { useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { useGlobalStore } from '@/store/global.store'
import { loadAllLeagues } from '@/services/league.service'
import { STAGE_KEYS, STAGE_SHORT } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLeague = Record<string, any>

export default function SubmissionStatusPanel() {
  const [leagues, setLeagues]   = useState<AnyLeague[]>([])
  const [loading, setLoading]   = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const globalData   = useGlobalStore(s => s.globalData)
  const currentStage = (globalData?.currentStage ?? 0) as StageKey
  const stageIdx     = STAGE_KEYS.indexOf(currentStage)
  const stageName    = stageIdx >= 0 ? STAGE_SHORT[stageIdx] : String(currentStage)

  async function handleLoad() {
    setLoading(true)
    try {
      const all = await loadAllLeagues()
      setLeagues(all)
      setExpanded(new Set(all.map((l: AnyLeague) => l.id)))
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }

  function hasSubmitted(league: AnyLeague, uid: string): boolean {
    const bet = ((league.bets || {})[uid] || {})['stage' + currentStage] || {}
    return Object.keys(bet).length > 0
  }

  function toggleExpand(lid: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(lid) ? next.delete(lid) : next.add(lid)
      return next
    })
  }

  return (
    <Card>
      <CardTitle>📊 סטטוס הגשות — {stageName}</CardTitle>
      <div className="text-xs text-[var(--text2)] mb-3">
        מציג רק אם הוגש או לא — ללא תוכן ההימורים
      </div>
      <Button variant="secondary" size="sm" onClick={handleLoad} disabled={loading}>
        {loading ? '⏳ טוען...' : '🔄 טען נתונים'}
      </Button>

      {leagues.length === 0 && !loading && (
        <div className="mt-3 text-sm text-[var(--text2)]">לחץ לטעינת נתונים</div>
      )}

      <div className="mt-3 space-y-3">
        {leagues.map((league) => {
          const members: string[] = league.members || []
          const submittedCount = members.filter(uid => hasSubmitted(league, uid)).length
          const isOpen = expanded.has(league.id)

          return (
            <div
              key={league.id}
              className="rounded-lg border border-[var(--card-border)] bg-[var(--dark3)] p-3"
            >
              {/* League header */}
              <button
                className="flex w-full items-center justify-between"
                onClick={() => toggleExpand(league.id)}
              >
                <div className="text-right">
                  <div className="font-bold">{league.name}</div>
                  <div className="text-xs text-[var(--text2)]">
                    {submittedCount}/{members.length} הגישו
                  </div>
                </div>
                <span className="text-[var(--text2)]">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Members list */}
              {isOpen && (
                <div className="mt-2 space-y-1 border-t border-[rgba(255,255,255,0.05)] pt-2">
                  {members.length === 0 && (
                    <div className="text-xs text-[var(--text2)]">אין משתתפים</div>
                  )}
                  {members.map((uid) => {
                    const info = (league.memberInfo || {})[uid] || {}
                    const submitted = hasSubmitted(league, uid)
                    const isAdmin = uid === league.adminUid
                    return (
                      <div key={uid} className="flex items-center justify-between text-sm">
                        <span className="text-[var(--text1)]">
                          {info.username || uid}
                          {isAdmin && (
                            <span className="mr-1 text-[0.6rem] text-[var(--orange)]">מנהל</span>
                          )}
                        </span>
                        <span className={submitted ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                          {submitted ? '✅ הוגש' : '❌ לא הוגש'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
