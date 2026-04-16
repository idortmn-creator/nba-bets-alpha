import { useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Send, CheckCircle, XCircle } from 'lucide-react'
import { httpsCallable } from 'firebase/functions'
import { getDocs, collection } from 'firebase/firestore'
import { functions, db } from '@/lib/firebase'
import { useGlobalStore } from '@/store/global.store'
import { loadAllLeagues } from '@/services/league.service'
import { STAGE_KEYS, STAGE_SHORT } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

const sendPushFn = httpsCallable(functions, 'sendPushNotification')

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLeague = Record<string, any>

export default function SubmissionStatusPanel() {
  const [leagues, setLeagues]       = useState<AnyLeague[]>([])
  const [userTokens, setUserTokens] = useState<Record<string, string>>({})
  const [loading, setLoading]       = useState(false)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [nudging, setNudging]       = useState<string | null>(null)

  const globalData   = useGlobalStore(s => s.globalData)
  const currentStage = (globalData?.currentStage ?? 0) as StageKey
  const stageIdx     = STAGE_KEYS.indexOf(currentStage)
  const stageName    = stageIdx >= 0 ? STAGE_SHORT[stageIdx] : String(currentStage)

  async function handleLoad() {
    setLoading(true)
    try {
      // Load leagues and user FCM tokens in parallel
      const [all, usersSnap] = await Promise.all([
        loadAllLeagues(),
        getDocs(collection(db, 'users')),
      ])
      setLeagues(all)
      setExpanded(new Set(all.map((l: AnyLeague) => l.id)))

      const tokens: Record<string, string> = {}
      usersSnap.docs.forEach(d => {
        const token = d.data().fcmToken as string | undefined
        if (token) tokens[d.id] = token
      })
      setUserTokens(tokens)
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

  async function handleNudge(uid: string, username: string) {
    const token = userTokens[uid]
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

  return (
    <Card>
      <CardTitle>📋 סטטוס הגשות — {stageName}</CardTitle>
      <div className="text-xs text-[var(--text2)] mb-3">
        מציג אם כל משתתף הגיש הימורים לשלב הנוכחי, עם אפשרות לשלוח תזכורת
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
          const allDone = submittedCount === members.length && members.length > 0
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
                    <span className={allDone ? 'text-[var(--green)]' : 'text-[var(--orange)]'}>
                      {submittedCount}/{members.length}
                    </span>{' '}הגישו
                    {allDone && <span className="mr-1.5 text-[var(--green)]">✓ הכל הוגש</span>}
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
                    const username = info.username || uid
                    const hasToken = !!userTokens[uid]

                    return (
                      <div
                        key={uid}
                        className="flex items-center justify-between gap-2 rounded-lg px-1.5 py-1 hover:bg-[rgba(255,255,255,0.03)]"
                      >
                        {/* User info */}
                        <div className="flex items-center gap-2 text-sm min-w-0">
                          {submitted
                            ? <CheckCircle size={13} className="shrink-0 text-[var(--green)]" />
                            : <XCircle    size={13} className="shrink-0 text-[var(--red)]" />
                          }
                          <span className="truncate text-[var(--text1)]">
                            {username}
                            {isAdmin && (
                              <span className="mr-1 text-[0.6rem] text-[var(--orange)]">מנהל</span>
                            )}
                          </span>
                        </div>

                        {/* Status + nudge */}
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className={`text-xs ${submitted ? 'text-[var(--green)]' : 'text-[var(--red)]'}`}>
                            {submitted ? 'הוגש' : 'לא הוגש'}
                          </span>
                          {!submitted && (
                            <button
                              onClick={() => handleNudge(uid, username)}
                              disabled={nudging === uid || !hasToken}
                              title={hasToken ? `שלח תזכורת ל-${username}` : 'אין טוקן התראות'}
                              className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.65rem] transition-all ${
                                hasToken
                                  ? 'border-[var(--orange-border)] text-[var(--orange)] hover:bg-[var(--orange)]/10 active:scale-95'
                                  : 'cursor-not-allowed border-[var(--card-border)] text-[var(--text2)] opacity-40'
                              }`}
                            >
                              {nudging === uid
                                ? <span className="text-[0.6rem]">⏳</span>
                                : <Send size={9} />
                              }
                              <span>תזכורת</span>
                            </button>
                          )}
                        </div>
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
