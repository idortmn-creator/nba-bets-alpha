import { useState } from 'react'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Send, CheckCircle, XCircle, Minus } from 'lucide-react'
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

type StageStatus = 'submitted' | 'missing' | 'future'

export default function SubmissionStatusPanel() {
  const [leagues, setLeagues]       = useState<AnyLeague[]>([])
  const [userTokens, setUserTokens] = useState<Record<string, string>>({})
  const [loading, setLoading]       = useState(false)
  const [expanded, setExpanded]     = useState<Set<string>>(new Set())
  const [nudgeStage, setNudgeStage] = useState<string>('current')
  const [nudging, setNudging]       = useState<string | null>(null)

  const globalData    = useGlobalStore(s => s.globalData)
  const currentStage  = (globalData?.currentStage ?? 0) as StageKey
  const currentStageIdx = STAGE_KEYS.indexOf(currentStage)

  // Resolve which StageKey to use for nudge
  const nudgeStageKey: StageKey = nudgeStage === 'current'
    ? currentStage
    : (nudgeStage === '0b' ? '0b' : parseInt(nudgeStage) as StageKey)

  async function handleLoad() {
    setLoading(true)
    try {
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

  function getStageStatus(league: AnyLeague, uid: string, si: StageKey, siIdx: number): StageStatus {
    if (siIdx > currentStageIdx) return 'future'
    const bet = ((league.bets || {})[uid] || {})['stage' + si] || {}
    return Object.keys(bet).length > 0 ? 'submitted' : 'missing'
  }

  function hasSubmittedForStage(league: AnyLeague, uid: string, si: StageKey): boolean {
    const bet = ((league.bets || {})[uid] || {})['stage' + si] || {}
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
    const stageName = STAGE_SHORT[STAGE_KEYS.indexOf(nudgeStageKey)]
    setNudging(uid)
    try {
      await sendPushFn({
        title: '🏀 NBA Bets 2026',
        body: `היי ${username}, אל תשכח למלא הימורים, השלב ננעל בקרוב!`,
        targetTokens: [token],
      })
      toast(`✅ תזכורת נשלחה ל-${username} (${stageName})`)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setNudging(null)
    }
  }

  return (
    <Card>
      <CardTitle>📋 סטטוס הגשות — כל השלבים</CardTitle>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleLoad} disabled={loading}>
          {loading ? '⏳ טוען...' : '🔄 טען נתונים'}
        </Button>

        {/* Stage selector for nudge */}
        {leagues.length > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--text2)]">
            <span>תזכורת עבור:</span>
            <select
              value={nudgeStage}
              onChange={e => setNudgeStage(e.target.value)}
              className="rounded-md border border-[var(--border)] bg-[var(--dark2)] px-2 py-1 text-xs text-[var(--text1)] focus:outline-none"
            >
              <option value="current">שלב נוכחי ({STAGE_SHORT[currentStageIdx]})</option>
              {STAGE_KEYS.map((si, i) => (
                <option key={String(si)} value={String(si)}>{STAGE_SHORT[i]}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {leagues.length === 0 && !loading && (
        <div className="text-sm text-[var(--text2)]">לחץ לטעינת נתונים</div>
      )}

      <div className="space-y-3">
        {leagues.map((league) => {
          const members: string[] = league.members || []
          // Count submissions for the nudge stage (what admin is focused on)
          const submittedCount = members.filter(uid => hasSubmittedForStage(league, uid, nudgeStageKey)).length
          const allDone = submittedCount === members.length && members.length > 0
          const isOpen = expanded.has(league.id)

          return (
            <div key={league.id} className="rounded-lg border border-[var(--card-border)] bg-[var(--dark3)] p-3">
              {/* League header */}
              <button className="flex w-full items-center justify-between" onClick={() => toggleExpand(league.id)}>
                <div className="text-right">
                  <div className="font-bold">{league.name}</div>
                  <div className="text-xs text-[var(--text2)]">
                    <span className={allDone ? 'text-[var(--green)]' : 'text-[var(--orange)]'}>
                      {submittedCount}/{members.length}
                    </span>
                    {' '}הגישו ({STAGE_SHORT[STAGE_KEYS.indexOf(nudgeStageKey)]})
                    {allDone && <span className="mr-1.5 text-[var(--green)]">✓</span>}
                  </div>
                </div>
                <span className="text-[var(--text2)]">{isOpen ? '▲' : '▼'}</span>
              </button>

              {/* Members table */}
              {isOpen && (
                <div className="mt-2 border-t border-[rgba(255,255,255,0.05)] pt-2">
                  {members.length === 0 && (
                    <div className="text-xs text-[var(--text2)]">אין משתתפים</div>
                  )}

                  {/* Stage header row */}
                  {members.length > 0 && (
                    <div className="mb-1.5 flex items-center gap-1 pr-1">
                      <span className="flex-1 text-[0.6rem] text-[var(--text2)]">משתתף</span>
                      {STAGE_KEYS.map((si, i) => (
                        <span
                          key={String(si)}
                          className={`w-8 shrink-0 text-center text-[0.55rem] leading-tight ${
                            i <= currentStageIdx ? 'text-[var(--text2)]' : 'text-[var(--text2)]/40'
                          }`}
                        >
                          {STAGE_SHORT[i].replace('פליי-אין ', 'פ-').replace('סיבוב ', 'ס').replace('גמר איזורי', 'גמר\nאיז׳').replace('גמר NBA', 'NBA')}
                        </span>
                      ))}
                      <span className="w-14 shrink-0" />
                    </div>
                  )}

                  <div className="space-y-1">
                    {members.map((uid) => {
                      const info = (league.memberInfo || {})[uid] || {}
                      const isAdmin = uid === league.adminUid
                      const username = info.username || uid
                      const hasToken = !!userTokens[uid]
                      const nudgeMissing = !hasSubmittedForStage(league, uid, nudgeStageKey)

                      return (
                        <div key={uid} className="flex items-center gap-1 rounded-lg px-1.5 py-1 hover:bg-[rgba(255,255,255,0.03)]">
                          {/* Name */}
                          <div className="flex flex-1 min-w-0 items-center gap-1 text-xs">
                            <span className="truncate text-[var(--text1)]">
                              {username}
                              {isAdmin && <span className="mr-1 text-[0.55rem] text-[var(--orange)]">מנהל</span>}
                            </span>
                          </div>

                          {/* Stage indicators */}
                          {STAGE_KEYS.map((si, i) => {
                            const status = getStageStatus(league, uid, si, i)
                            return (
                              <div key={String(si)} className="flex w-8 shrink-0 items-center justify-center">
                                {status === 'submitted' && <CheckCircle size={12} className="text-[var(--green)]" />}
                                {status === 'missing'   && <XCircle    size={12} className="text-[var(--red)]" />}
                                {status === 'future'    && <Minus      size={10} className="text-[var(--text2)]/30" />}
                              </div>
                            )
                          })}

                          {/* Nudge button — for the selected nudge stage */}
                          <div className="flex w-14 shrink-0 justify-end">
                            {nudgeMissing && STAGE_KEYS.indexOf(nudgeStageKey) <= currentStageIdx ? (
                              <button
                                onClick={() => handleNudge(uid, username)}
                                disabled={nudging === uid || !hasToken}
                                title={hasToken ? `שלח תזכורת ל-${username}` : 'אין טוקן התראות'}
                                className={`flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[0.6rem] transition-all ${
                                  hasToken
                                    ? 'border-[var(--orange-border)] text-[var(--orange)] hover:bg-[var(--orange)]/10 active:scale-95'
                                    : 'cursor-not-allowed border-[var(--card-border)] text-[var(--text2)] opacity-40'
                                }`}
                              >
                                {nudging === uid ? <span>⏳</span> : <Send size={9} />}
                                <span>תזכורת</span>
                              </button>
                            ) : (
                              <span className="w-14" />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Card>
  )
}
