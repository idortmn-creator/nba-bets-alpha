import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Send } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { getDoc, doc } from 'firebase/firestore'
import { functions, db } from '@/lib/firebase'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useLeagueStore } from '@/store/league.store'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { STAGE_MATCHES, STAGE_KEYS, STAGE_SHORT } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'
import { removeLeagueMemberByAdmin } from '@/services/league.service'

const sendPushFn = httpsCallable(functions, 'sendPushNotification')

export default function LeagueAdminTab() {
  const leagueData  = useLeagueStore(s => s.currentLeagueData)
  const currentUser = useAuthStore(s => s.currentUser)
  const { getGlobal, isSuperAdmin } = useGlobalHelpers()

  const [subTab, setSubTab]           = useState<'status' | 'remove'>('status')
  const [viewStageStr, setViewStageStr] = useState<string | null>(null)
  const [memberTokens, setMemberTokens] = useState<Record<string, string>>({})
  const [nudging, setNudging]           = useState<string | null>(null)
  const [removing, setRemoving]         = useState<string | null>(null)

  // Guard: only league admin sees this tab
  if (!leagueData || !currentUser || leagueData.adminUid !== currentUser.uid) return null

  const currentStage    = getGlobal('currentStage', 0) as StageKey
  const currentStageIdx = STAGE_KEYS.indexOf(currentStage)
  const superAdmin      = isSuperAdmin()

  // The stage being viewed — defaults to the active stage
  const viewStage: StageKey = viewStageStr === null
    ? currentStage
    : (viewStageStr === '0b' ? '0b' : parseInt(viewStageStr) as StageKey)
  const viewStageIdx = STAGE_KEYS.indexOf(viewStage)
  const stageName    = viewStageIdx >= 0 ? STAGE_SHORT[viewStageIdx] : String(viewStage)

  const members = leagueData.members || []
  const relevantMatches = STAGE_MATCHES[viewStage] || []

  // Load FCM tokens for all league members (super admin only)
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffect(() => {
    if (!superAdmin || members.length === 0) return
    Promise.all(members.map(uid => getDoc(doc(db, 'users', uid)))).then(snaps => {
      const tokens: Record<string, string> = {}
      snaps.forEach(snap => {
        const token = snap.data()?.fcmToken as string | undefined
        if (token) tokens[snap.id] = token
      })
      setMemberTokens(tokens)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [superAdmin, leagueData?.id])

  function hasSubmittedMatch(uid: string, matchKey: string): boolean {
    const bet = ((leagueData?.bets || {})[uid] || {})['stage' + viewStage] || {}
    return viewStage === 0 || viewStage === '0b' ? !!bet[matchKey] : !!bet[matchKey + '_winner']
  }

  function hasSubmittedStage(uid: string): boolean {
    const bet = ((leagueData?.bets || {})[uid] || {})['stage' + viewStage] || {}
    return Object.keys(bet).length > 0
  }

  async function handleNudge(uid: string, username: string) {
    const token = memberTokens[uid]
    if (!token) { toast('⚠️ אין טוקן התראות למשתמש זה'); return }
    setNudging(uid)
    try {
      await sendPushFn({
        title: '🏀 NBA Bets 2026',
        body: `היי ${username}, אל תשכח למלא הימורים, השלב ננעל בקרוב!`,
        targetTokens: [token],
      })
      toast(`✅ תזכורת נשלחה ל-${username}`)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setNudging(null)
    }
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
        <button className={`stage-tab ${subTab === 'status' ? 'active' : ''}`} onClick={() => setSubTab('status')}>
          📊 סטטוס הגשות
        </button>
        <button className={`stage-tab ${subTab === 'remove' ? 'active' : ''}`} onClick={() => setSubTab('remove')}>
          🚪 הסרת משתתפים
        </button>
      </div>

      {/* ── Submission Status ── */}
      {subTab === 'status' && (
        <Card>
          <div className="mb-3">
            <div className="font-oswald text-base text-[var(--orange)]">סטטוס הגשות — {stageName}</div>
            <div className="text-xs text-[var(--text2)] mt-0.5">מוצג רק אם הוגש או לא — ללא תוכן ההימורים</div>
          </div>

          {/* Stage selector */}
          <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STAGE_KEYS.map((si, i) => {
              const isFuture = i > currentStageIdx
              const isActive = viewStage === si
              return (
                <button
                  key={String(si)}
                  onClick={() => setViewStageStr(String(si))}
                  disabled={isFuture}
                  className={[
                    'stage-tab shrink-0 text-[0.7rem]',
                    isActive ? 'active' : '',
                    isFuture ? 'opacity-30 cursor-not-allowed' : '',
                  ].join(' ')}
                >
                  {STAGE_SHORT[i]}
                </button>
              )
            })}
          </div>

          {relevantMatches.length === 0 ? (
            <div className="text-sm text-[var(--text2)]">אין סדרות בשלב זה</div>
          ) : (
            <div className="overflow-x-auto -mx-1">
              <table className="w-full text-xs min-w-[320px]">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-right py-2 pr-2 font-semibold text-[var(--text2)]">משתתף</th>
                    {relevantMatches.map(m => (
                      <th key={m.key} className="text-center py-2 px-1 font-semibold text-[var(--text2)] min-w-[52px] leading-tight">
                        {m.label}
                      </th>
                    ))}
                    {/* Nudge column header — only for super admin */}
                    {superAdmin && <th className="py-2 px-1 min-w-[60px]" />}
                  </tr>
                </thead>
                <tbody>
                  {members.map(uid => {
                    const info       = (leagueData?.memberInfo || {})[uid] || {}
                    const isMe       = uid === currentUser.uid
                    const username   = info.username || uid
                    const submitted  = hasSubmittedStage(uid)
                    const hasToken   = !!memberTokens[uid]

                    return (
                      <tr key={uid} className="border-b border-[rgba(255,255,255,0.04)]">
                        <td className="py-2 pr-2">
                          <span className="font-semibold">{username}</span>
                          {isMe && <span className="mr-1 text-[0.6rem] text-[var(--orange)]">אתה</span>}
                        </td>
                        {relevantMatches.map(m => {
                          const matchSubmitted = hasSubmittedMatch(uid, m.key)
                          return (
                            <td key={m.key} className="text-center py-2 px-1">
                              <span className={matchSubmitted ? 'text-[var(--green)]' : 'text-[var(--red)]'}>
                                {matchSubmitted ? '✅' : '❌'}
                              </span>
                            </td>
                          )
                        })}
                        {/* Nudge button — super admin only, for members who haven't submitted */}
                        {superAdmin && (
                          <td className="py-2 px-1 text-center">
                            {!submitted && (
                              <button
                                onClick={() => handleNudge(uid, username)}
                                disabled={nudging === uid || !hasToken}
                                title={hasToken ? `שלח תזכורת ל-${username}` : 'אין טוקן התראות'}
                                className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6rem] transition-all ${
                                  hasToken
                                    ? 'border-[var(--orange-border)] text-[var(--orange)] hover:bg-[var(--orange)]/10 active:scale-95'
                                    : 'cursor-not-allowed border-[var(--card-border)] text-[var(--text2)] opacity-40'
                                }`}
                              >
                                {nudging === uid ? '⏳' : <Send size={9} />}
                              </button>
                            )}
                          </td>
                        )}
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
          <div className="mb-3 font-oswald text-base text-[var(--orange)]">הסרת משתתפים</div>

          {nonAdminMembers.length === 0 ? (
            <div className="text-sm text-[var(--text2)]">אין משתתפים נוספים בליגה</div>
          ) : (
            <div className="space-y-2">
              {nonAdminMembers.map(uid => {
                const info = (leagueData?.memberInfo || {})[uid] || {}
                return (
                  <div key={uid} className="flex items-center justify-between rounded-lg border border-[var(--card-border)] bg-[var(--dark3)] p-2.5">
                    <div>
                      <span className="font-semibold text-sm">{info.username || uid}</span>
                      {info.displayName && <span className="mr-2 text-xs text-[var(--text2)]">{info.displayName}</span>}
                    </div>
                    <Button variant="destructive" size="sm" disabled={removing === uid} onClick={() => handleRemove(uid, info.username || uid)}>
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
