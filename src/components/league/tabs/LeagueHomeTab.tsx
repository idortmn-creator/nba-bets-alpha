import { useState, useEffect } from 'react'
import { Target, TrendingUp, Bell, BellOff } from 'lucide-react'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useLeagueStore } from '@/store/league.store'
import { useGlobalStore } from '@/store/global.store'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { scoreStage } from '@/services/scoring'
import { STAGE_KEYS, STAGE_SHORT, STAGE_MATCHES } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'
import type { BonusBet, GlobalData } from '@/store/global.store'

// ─── helpers ────────────────────────────────────────────────────────────────

function isStageComplete(
  sk: StageKey,
  stageBets: Record<string, string>,
  getTeams: (si: StageKey, mk: string) => { home: string; away: string },
  tiebreakerQuestion: string,
  preBetsLocked: boolean,
  getBonusBets: (si: StageKey) => BonusBet[],
  isSingleBonusLocked: (si: StageKey, b: BonusBet) => boolean,
): boolean {
  const matches = STAGE_MATCHES[sk] || []
  if (sk === 0) {
    if (!matches.every((m) => !!stageBets[m.key])) return false
    if (tiebreakerQuestion && !stageBets['tiebreaker']) return false
  } else if (sk === '0b') {
    if (!matches.every((m) => !!stageBets[m.key])) return false
  } else {
    for (const m of matches) {
      const t = getTeams(sk, m.key)
      if (!t.home && !t.away) continue
      if (!stageBets[m.key + '_winner'] || !stageBets[m.key + '_result']) return false
      if (m.hasMvp && !stageBets[m.key + '_mvp']) return false
    }
    if (sk === 1 && !preBetsLocked) {
      const hasTeams = STAGE_MATCHES[1].some((m) => { const t = getTeams(1, m.key); return !!(t.home || t.away) })
      if (hasTeams && (!stageBets['champion'] || !stageBets['east_champ'] || !stageBets['west_champ'])) return false
    }
  }
  for (const b of getBonusBets(sk)) {
    if (!isSingleBonusLocked(sk, b) && !stageBets['bonus_' + b.id]) return false
  }
  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeMyStats(myUid: string, leagueData: any, globalData: GlobalData) {
  let exactHits = 0, correctWins = 0, totalBets = 0
  for (const sk of STAGE_KEYS) {
    const result = (globalData?.results ?? {})?.['stage' + sk]
    if (!result || Object.keys(result).length === 0) continue
    const bet = ((leagueData.bets ?? {})[myUid] ?? {})?.['stage' + sk] ?? {}
    for (const m of (STAGE_MATCHES[sk] ?? [])) {
      if (sk === 0 || sk === '0b') {
        const ans = result[m.key]
        if (!ans) continue
        totalBets++
        if (bet[m.key]?.toLowerCase() === ans.toLowerCase()) { correctWins++; exactHits++ }
      } else {
        const winner = result[m.key + '_winner']
        if (!winner) continue
        totalBets++
        const hitWin = bet[m.key + '_winner']?.toLowerCase() === winner.toLowerCase()
        if (hitWin) {
          correctWins++
          if (result[m.key + '_result'] && bet[m.key + '_result'] === result[m.key + '_result']) exactHits++
        }
      }
    }
  }
  return { exactHits, winPct: totalBets > 0 ? Math.round(correctWins / totalBets * 100) : null, totalBets }
}

function formatLockTime(ts: number): string {
  return new Date(ts).toLocaleString('he-IL', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  })
}

const REMINDER_OPTIONS: { label: string; value: number | null }[] = [
  { label: 'כבוי',   value: null },
  { label: "5 דק'",  value: 5    },
  { label: "15 דק'", value: 15   },
  { label: "30 דק'", value: 30   },
  { label: 'שעה',    value: 60   },
  { label: "2 שע'",  value: 120  },
  { label: "3 שע'",  value: 180  },
  { label: "12 שע'", value: 720  },
]

// ─── skeleton ────────────────────────────────────────────────────────────────

function SkeletonDashboard() {
  return (
    <div className="flex flex-col gap-3 pb-24">
      <div className="player-card-glow">
        <div className="flex items-center gap-4">
          <div className="skeleton-item h-14 w-14 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="skeleton-item h-4 w-32 rounded" />
            <div className="skeleton-item h-3 w-20 rounded" />
          </div>
          <div className="skeleton-item h-10 w-14 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="skeleton-item h-20 rounded-xl" />
        <div className="skeleton-item h-20 rounded-xl" />
      </div>
      <div className="skeleton-item h-40 rounded-xl" />
      <div className="skeleton-item h-20 rounded-xl" />
    </div>
  )
}

// ─── main component ──────────────────────────────────────────────────────────

export default function LeagueHomeTab({ onViewRules }: { onViewRules?: () => void }) {
  const leagueData  = useLeagueStore((s) => s.currentLeagueData)
  const globalData  = useGlobalStore((s) => s.globalData)
  const currentUser    = useAuthStore((s) => s.currentUser)
  const currentUserDoc = useAuthStore((s) => s.currentUserDoc)
  const { getGlobal, canBetOnStage, getTeams, isPreBetsLocked, getBonusBets, isSingleBonusLocked } = useGlobalHelpers()
  const tiebreakerQuestion = getGlobal('tiebreakerQuestion', '') as string

  // Reminder preference — synced from Firestore user doc
  const docReminder = currentUserDoc?.reminderBefore ?? null
  const [reminderPref, setReminderPref] = useState<number | null>(docReminder)
  useEffect(() => { setReminderPref(currentUserDoc?.reminderBefore ?? null) }, [currentUserDoc])

  if (!leagueData || !currentUser) return <SkeletonDashboard />

  const myUid  = currentUser.uid
  const members    = leagueData.members    || []
  const memberInfo = leagueData.memberInfo || {}
  const myInfo     = memberInfo[myUid]     || { username: myUid, displayName: '' }
  const autoLocks  = getGlobal('autoLocks', {} as Record<string, number>) as Record<string, number>

  // Scores + rank
  const scores = (members as string[])
    .map((uid) => {
      let total = 0
      for (const sk of STAGE_KEYS) total += scoreStage(uid, sk, leagueData, globalData)
      return { uid, total, info: (memberInfo[uid] || { username: uid, displayName: '' }) as { username: string; displayName: string } }
    })
    .sort((a, b) => b.total - a.total)

  const myRank  = scores.findIndex((s) => s.uid === myUid) + 1
  const myScore = scores.find((s) => s.uid === myUid)
  const top5    = scores.slice(0, 5)
  const showMyRow = myRank > 5
  const medal = (r: number) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `#${r}`

  // Performance stats
  const stats = computeMyStats(myUid, leagueData, globalData)

  // Open bets
  const stageLocks = getGlobal('stageLocked', [] as boolean[]) as boolean[]
  const openBetStages: string[] = []
  for (let i = 0; i < STAGE_KEYS.length; i++) {
    const sk = STAGE_KEYS[i]
    if (!(stageLocks[i] || false) && canBetOnStage(sk)) {
      const stageBets = (((leagueData.bets || {})[myUid] || {})['stage' + sk] || {}) as Record<string, string>
      if (!isStageComplete(sk, stageBets, getTeams, tiebreakerQuestion, isPreBetsLocked(), getBonusBets, isSingleBonusLocked))
        openBetStages.push(STAGE_SHORT[i])
    }
  }

  // Last completed stage
  const results = getGlobal('results', {} as Record<string, Record<string, string> | null>) as Record<string, Record<string, string> | null>
  let lastStageName = '', lastStagePoints: number | null = null
  for (let i = STAGE_KEYS.length - 1; i >= 0; i--) {
    const r = results['stage' + STAGE_KEYS[i]]
    if (r && Object.keys(r).length > 0) {
      lastStageName   = STAGE_SHORT[i]
      lastStagePoints = scoreStage(myUid, STAGE_KEYS[i], leagueData, globalData)
      break
    }
  }

  // Next lock
  const now      = Date.now()
  const nextLock = Object.entries(autoLocks)
    .map(([key, ts]) => ({ key, ts }))
    .filter(({ ts }) => ts > now)
    .sort((a, b) => a.ts - b.ts)[0] ?? null

  async function saveReminderPref(val: number | null) {
    setReminderPref(val)
    try { await updateDoc(doc(db, 'users', myUid), { reminderBefore: val }) }
    catch (e) { console.warn('[reminder] save failed', e) }
  }

  const notifGranted = typeof Notification !== 'undefined' && Notification.permission === 'granted'
  const initials     = (myInfo.displayName || myInfo.username || '?')[0]?.toUpperCase() ?? '?'
  const hasOpenBets  = openBetStages.length > 0

  return (
    <div className="lh-wrap pb-24">

      {/* ── Player Card ── */}
      <div className="player-card-glow">
        <div className="flex items-center gap-4">
          {currentUser.photoURL ? (
            <img src={currentUser.photoURL} alt=""
              className="h-14 w-14 flex-shrink-0 rounded-full object-cover ring-2 ring-[var(--orange)]/50"
            />
          ) : (
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-[var(--orange)] text-2xl font-bold text-white ring-2 ring-[var(--orange)]/30">
              {initials}
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-bold leading-snug">
              {myInfo.displayName || myInfo.username}
            </div>
            {myInfo.displayName && myInfo.username && (
              <div className="text-xs text-[var(--text2)]">@{myInfo.username}</div>
            )}
            {leagueData.name && (
              <div className="mt-0.5 text-[0.7rem] text-[var(--text2)]">{leagueData.name}</div>
            )}
          </div>

          <div className="flex flex-shrink-0 flex-col items-center">
            <div className="font-oswald text-3xl font-bold leading-none text-[var(--orange)]">
              {myRank > 0 ? `#${myRank}` : '—'}
            </div>
            <div className="text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--text2)]">דירוג</div>
            <div className="mt-2 font-oswald text-xl font-bold leading-none text-white">
              {myScore?.total ?? 0}
            </div>
            <div className="text-[0.6rem] text-[var(--text2)]">נקודות</div>
          </div>
        </div>
      </div>

      {/* ── Performance Stats ── */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--orange)]/20 bg-[var(--orange)]/5 p-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[var(--orange)]/15">
            <Target size={17} className="text-[var(--orange)]" />
          </div>
          <div className="min-w-0">
            <div className="font-oswald text-2xl font-bold leading-none text-[var(--orange)]">
              {stats.totalBets > 0 ? stats.exactHits : '—'}
            </div>
            <div className="mt-0.5 text-[0.68rem] font-semibold leading-tight text-[var(--text2)]">פגיעות מדויקות</div>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-xl border border-[rgba(79,195,247,0.2)] bg-[rgba(79,195,247,0.05)] p-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[rgba(79,195,247,0.15)]">
            <TrendingUp size={17} className="text-[var(--blue)]" />
          </div>
          <div className="min-w-0">
            <div className="font-oswald text-2xl font-bold leading-none text-[var(--blue)]">
              {stats.winPct !== null ? `${stats.winPct}%` : '—'}
            </div>
            <div className="mt-0.5 text-[0.68rem] font-semibold leading-tight text-[var(--text2)]">אחוז ניצחונות</div>
          </div>
        </div>
      </div>

      {/* ── Mini Standings ── */}
      <div className="lh-card">
        <div className="lh-card-title">🏆 טבלת מובילים</div>
        <div className="lh-standings">
          {top5.map((s, i) => {
            const isMe = s.uid === myUid
            return (
              <div key={s.uid} className={`lh-row${isMe ? ' lh-row-me' : ''}`}>
                <span className="lh-row-rank">{medal(i + 1)}</span>
                <span className="lh-row-name">{s.info.username || s.uid}</span>
                <span className="lh-row-pts">{s.total} נק'</span>
              </div>
            )
          })}
          {showMyRow && myScore && (
            <>
              <div className="lh-row-sep">⋯</div>
              <div className="lh-row lh-row-me">
                <span className="lh-row-rank">#{myRank}</span>
                <span className="lh-row-name">{myScore.info.username || myUid}</span>
                <span className="lh-row-pts">{myScore.total} נק'</span>
              </div>
            </>
          )}
          {scores.length === 0 && <div className="lh-empty">אין משתתפים עדיין</div>}
        </div>
      </div>

      {/* ── Open Bets + Last Stage ── */}
      <div className="lh-stats-grid">
        <div className={`lh-stat-card${hasOpenBets ? ' lh-stat-warn' : ' lh-stat-ok'}`}>
          <div className="lh-stat-icon">{hasOpenBets ? '⚠️' : '✅'}</div>
          <div className="lh-stat-body">
            <div className="lh-stat-label">הימורים פתוחים</div>
            <div className="lh-stat-value">{hasOpenBets ? openBetStages.join(', ') : 'הכל הוגש'}</div>
          </div>
        </div>
        <div className="lh-stat-card">
          <div className="lh-stat-icon">📊</div>
          <div className="lh-stat-body">
            <div className="lh-stat-label">נקודות אחרונות</div>
            <div className="lh-stat-value">
              {lastStagePoints !== null
                ? <><strong className="lh-pts-num">+{lastStagePoints}</strong>{' '}<span className="lh-pts-stage">{lastStageName}</span></>
                : <span className="lh-empty-val">—</span>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Reminders ── */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card-bg)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <Bell size={14} className="flex-shrink-0 text-[var(--orange)]" />
          <span className="font-oswald text-base text-[var(--orange)]">תזכורות לפני סגירת הימורים</span>
        </div>

        {!notifGranted ? (
          <div className="flex items-start gap-2 rounded-lg border border-white/10 bg-white/5 p-3 text-sm text-[var(--text2)]">
            <BellOff size={13} className="mt-0.5 flex-shrink-0" />
            <span>הפעל התראות בדפדפן כדי לקבל תזכורות לפני נעילת הימורים.</span>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {REMINDER_OPTIONS.map((o) => {
                const isActive = reminderPref === o.value
                return (
                  <button
                    key={String(o.value)}
                    onClick={() => saveReminderPref(o.value)}
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-semibold transition-all active:scale-95',
                      isActive
                        ? 'border-[var(--orange)] bg-[var(--orange)] text-white'
                        : 'border-white/15 bg-white/5 text-[var(--text2)] hover:border-[var(--orange)]/50 hover:text-[var(--text1)]',
                    ].join(' ')}
                  >
                    {o.label}
                  </button>
                )
              })}
            </div>

            {nextLock && reminderPref !== null && (
              <div className="rounded-lg border border-[var(--orange)]/20 bg-[var(--orange)]/5 p-2.5 text-xs">
                <div className="font-semibold text-[var(--orange)]">🔒 נעילה הבאה: {formatLockTime(nextLock.ts)}</div>
                <div className="mt-0.5 text-[var(--text2)]">
                  🔔 התראה תישלח ב: {formatLockTime(nextLock.ts - reminderPref * 60 * 1000)}
                </div>
              </div>
            )}
            {nextLock && reminderPref === null && (
              <div className="text-xs text-[var(--text2)]">🔒 הנעילה הבאה: {formatLockTime(nextLock.ts)}</div>
            )}
            {!nextLock && (
              <div className="text-xs text-[var(--text2)]">אין נעילות מתוכננות כרגע</div>
            )}
          </>
        )}
      </div>

      {/* ── Rules Link ── */}
      {onViewRules && (
        <button className="lh-rules-link" onClick={onViewRules}>
          📖 שיטת הניקוד ושובר השוויון ←
        </button>
      )}

    </div>
  )
}
