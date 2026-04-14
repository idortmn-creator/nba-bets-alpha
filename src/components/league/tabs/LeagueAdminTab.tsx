import { useState } from 'react'
import { toast } from 'sonner'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLeagueStore } from '@/store/league.store'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { STAGE_MATCHES, STAGE_KEYS, STAGE_SHORT } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'
import { removeLeagueMemberByAdmin } from '@/services/league.service'

export default function LeagueAdminTab() {
  const leagueData  = useLeagueStore(s => s.currentLeagueData)
  const currentUser = useAuthStore(s => s.currentUser)
  const { getGlobal, isSeriesLocked } = useGlobalHelpers()
  const [subTab, setSubTab]     = useState<'status' | 'remove'>('status')
  const [removing, setRemoving] = useState<string | null>(null)

  // Guard: only league admin sees this tab
  if (!leagueData || !currentUser || leagueData.adminUid !== currentUser.uid) return null

  const currentStage = getGlobal('currentStage', 0) as StageKey
  const stageIdx     = STAGE_KEYS.indexOf(currentStage)
  const stageName    = stageIdx >= 0 ? STAGE_SHORT[stageIdx] : String(currentStage)
  const matches      = STAGE_MATCHES[currentStage] || []
  const members      = leagueData.members || []

  // Matches still open (not locked) — relevant for submission status
  const openMatches = matches.filter(m => !isSeriesLocked(currentStage, m.key))

  function hasSubmittedMatch(uid: string, matchKey: string): boolean {
    const bet = ((leagueData?.bets || {})[uid] || {})['stage' + currentStage] || {}
    if (currentStage === 0 || currentStage === '0b') {
      return !!bet[matchKey]
    }
    return !!bet[matchKey + '_winner']
  }

  async function handleRemove(uid: string, username: string) {
    if (!confirm(`להסיר את "${username}" מהליגה?\nהפעולה תמחק את הימוריהם ואינה הפיכה.`)) return
    setRemoving(uid)
    try {
      await removeLeagueMemberByAdmin(leagueData!.id, uid)
      toast('✅ משתמש הוסר מהליגה')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setRemoving(null)
    }
  }

  const nonAdminMembers = members.filter(uid => uid !== currentUser.uid)

  return (
    <div>
      <div className="mb-3 flex gap-2">
        <button
          className={`stage-tab ${subTab === 'status' ? 'active' : ''}`}
          onClick={() => setSubTab('status')}
        >
          📊 סטטוס הגשות
        </button>
        <button
          className={`stage-tab ${subTab === 'remove' ? 'active' : ''}`}
          onClick={() => setSubTab('remove')}
        >
          🚪 הסרת משתתפים
        </button>
      </div>

      {/* ── Submission Status ── */}
      {subTab === 'status' && (
        <Card>
          <div className="mb-3">
            <div className="font-oswald text-base text-[var(--orange)]">
              סטטוס הגשות — {stageName}
            </div>
            <div className="text-xs text-[var(--text2)] mt-0.5">
              מוצג רק אם הוגש או לא — ללא תוכן ההימורים
            </div>
          </div>

          {openMatches.length === 0 ? (
            <div className="text-sm text-[var(--text2)]">
              כל הסדרות בשלב זה ננעלו — אין עוד הגשות פתוחות
            </div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs min-w-[320px]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-right py-2 pr-2 font-semibold text-[var(--text2)]">
                      משתתף
                    </th>
                    {openMatches.map(m => (
                      <th
                        key={m.key}
                        className="text-center py-2 px-1 font-semibold text-[var(--text2)] min-w-[52px] leading-tight"
                      >
                        {m.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {members.map(uid => {
                    const info = (leagueData?.memberInfo || {})[uid] || {}
                    const isMe = uid === currentUser.uid
                    return (
                      <tr key={uid} className="border-b border-[rgba(255,255,255,0.04)]">
                        <td className="py-2 pr-2">
                          <span className="font-semibold">{info.username || uid}</span>
                          {isMe && (
                            <span className="mr-1 text-[0.6rem] text-[var(--orange)]">אתה</span>
                          )}
                        </td>
                        {openMatches.map(m => {
                          const submitted = hasSubmittedMatch(uid, m.key)
                          return (
                            <td key={m.key} className="text-center py-2 px-1">
                              <span className={submitted ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                                {submitted ? '✅' : '❌'}
                              </span>
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Remove Members ── */}
      {subTab === 'remove' && (
        <Card>
          <div className="mb-3 font-oswald text-base text-[var(--orange)]">
            הסרת משתתפים
          </div>

          {nonAdminMembers.length === 0 ? (
            <div className="text-sm text-[var(--text2)]">אין משתתפים נוספים בליגה</div>
          ) : (
            <div className="space-y-2">
              {nonAdminMembers.map(uid => {
                const info = (leagueData?.memberInfo || {})[uid] || {}
                return (
                  <div
                    key={uid}
                    className="flex items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--dark3)] p-2.5"
                  >
                    <div>
                      <span className="font-semibold text-sm">{info.username || uid}</span>
                      {info.displayName && (
                        <span className="mr-2 text-xs text-[var(--text2)]">{info.displayName}</span>
                      )}
                    </div>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={removing === uid}
                      onClick={() => handleRemove(uid, info.username || uid)}
                    >
                      {removing === uid ? '⏳' : 'הסר'}
                    </Button>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-3 rounded-lg border border-[rgba(255,80,80,0.2)] bg-[rgba(255,80,80,0.05)] p-2 text-xs text-[var(--text2)]">
            ⚠️ הסרת משתמש תמחק את הימוריו מהליגה. הפעולה אינה הפיכה.
          </div>
        </Card>
      )}
    </div>
  )
}
