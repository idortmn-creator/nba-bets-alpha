import { useState } from 'react'
import { toast } from 'sonner'
import { Lock, Unlock, ChevronDown, ChevronUp } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SelectNative } from '@/components/ui/select-native'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { setCurrentStage, toggleStageLock, toggleSeriesLock, setSeriesOpen, setStageUnlocked } from '@/services/global.service'
import { STAGE_NAMES, STAGE_SHORT, STAGE_KEYS, STAGE_MATCHES } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

export default function LocksPanel() {
  const { globalData, getGlobal, isSeriesLocked, isSeriesOpenForBetting } = useGlobalHelpers()
  const [selectedStage, setSelectedStage] = useState<string>('0')
  const [expandedStage, setExpandedStage] = useState<string | null>(null)
  const [loadingKey, setLoadingKey] = useState<string | null>(null)

  const csIdx = STAGE_KEYS.indexOf(getGlobal('currentStage', 0))
  const stageLocked = getGlobal('stageLocked', [false, false, false, false, false, false] as boolean[])

  async function handleSetStage() {
    const s: StageKey = selectedStage === '0b' ? '0b' : (parseInt(selectedStage) as StageKey)
    await setCurrentStage(s)
    toast('✅ שלב עודכן!')
  }

  async function handleToggleStage(si: StageKey, sIdx: number) {
    const key = `stage_${sIdx}`
    setLoadingKey(key)
    try {
      const locked = await toggleStageLock(si, globalData)
      toast(locked ? '🔒 שלב וכל הסדרות ננעלו' : '🔓 שלב נפתח')
    } finally {
      setLoadingKey(null)
    }
  }

  async function handleToggleSeries(si: StageKey, mk: string) {
    const key = `series_${si}_${mk}`
    setLoadingKey(key)
    try {
      const locked = await toggleSeriesLock(si, mk, globalData)
      toast(locked ? '🔒 סדרה ננעלה' : '🔓 סדרה נפתחה')
    } finally {
      setLoadingKey(null)
    }
  }

  return (
    <Card>
      <CardTitle>🔒 ניהול נעילות</CardTitle>

      {/* Current stage indicator */}
      <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--orange-border)] bg-[var(--dark3)] p-2.5 text-sm">
        <span className="font-bold text-[var(--orange)]">שלב נוכחי:</span>
        <span className="text-[var(--text1)]">{STAGE_NAMES[csIdx] || '—'}</span>
        <span className="mr-auto text-base">{stageLocked[csIdx] ? '🔒' : '🟢'}</span>
      </div>

      {/* Set current stage */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <SelectNative value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)} className="!w-auto">
          <option value="0">פליי-אין סיבוב א</option>
          <option value="0b">פליי-אין גמר</option>
          <option value="1">סיבוב ראשון</option>
          <option value="2">סיבוב שני</option>
          <option value="3">גמר איזורי</option>
          <option value="4">גמר NBA</option>
        </SelectNative>
        <Button variant="secondary" size="sm" onClick={handleSetStage}>עדכן שלב נוכחי</Button>
      </div>

      {/* Stage lock rows */}
      <div className="space-y-2">
        {STAGE_KEYS.map((si, sIdx) => {
          const locked = stageLocked[sIdx] ?? false
          const matches = STAGE_MATCHES[si] || []
          const isExpanded = expandedStage === String(si)
          const stageKey = `stage_${sIdx}`
          const isCurrentStage = sIdx === csIdx

          return (
            <div
              key={String(si)}
              className={`rounded-lg border transition-colors ${
                locked
                  ? 'border-[var(--green)]/30 bg-[var(--green)]/5'
                  : 'border-[var(--card-border)] bg-[var(--dark3)]'
              }`}
            >
              <div className="flex items-center gap-2.5 p-2.5">
                {/* Lock toggle button */}
                <button
                  onClick={() => handleToggleStage(si, sIdx)}
                  disabled={loadingKey === stageKey}
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition-all ${
                    locked
                      ? 'border-[var(--green)] bg-[var(--green)]/15 text-[var(--green)]'
                      : 'border-[var(--orange-border)] text-[var(--text2)] hover:border-[var(--orange)] hover:text-[var(--orange)]'
                  }`}
                >
                  {loadingKey === stageKey ? (
                    <span className="text-[0.65rem]">⏳</span>
                  ) : locked ? (
                    <Lock size={14} />
                  ) : (
                    <Unlock size={14} />
                  )}
                </button>

                {/* Stage name + status */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[var(--text1)]">{STAGE_SHORT[sIdx]}</span>
                    {isCurrentStage && (
                      <span className="rounded-full bg-[var(--orange)]/20 px-1.5 py-0.5 text-[0.6rem] font-bold text-[var(--orange)]">
                        נוכחי
                      </span>
                    )}
                  </div>
                  <div className="text-[0.7rem] text-[var(--text2)]">
                    {locked ? 'נעול' : 'פתוח'} · {matches.length} סדרות
                  </div>
                </div>

                {/* Expand/collapse individual series */}
                {matches.length > 0 && (
                  <button
                    onClick={() => setExpandedStage(isExpanded ? null : String(si))}
                    className="flex items-center gap-1 rounded-md px-2 py-1 text-[0.7rem] text-[var(--text2)] hover:text-[var(--text1)] transition-colors"
                  >
                    סדרות {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                  </button>
                )}
              </div>

              {/* Individual series controls */}
              {isExpanded && matches.length > 0 && (
                <div className="border-t border-[rgba(255,255,255,0.05)] px-2.5 pb-2.5 pt-2 space-y-1.5">
                  {/* Column headers */}
                  <div className="flex items-center justify-between px-1 text-[0.62rem] text-[var(--text2)]">
                    <span>סדרה</span>
                    <div className="flex gap-6 pl-1">
                      <span>נעילה</span>
                      <span>הגשת הימורים</span>
                    </div>
                  </div>
                  {matches.map((m) => {
                    const serLocked  = isSeriesLocked(si, m.key)
                    const serOpen    = isSeriesOpenForBetting(si, m.key)
                    const lockKey    = `series_${si}_${m.key}`
                    const openKey    = `seropen_${si}_${m.key}`
                    return (
                      <div key={m.key} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--card-border)] bg-[var(--dark2)] px-2.5 py-1.5">
                        <span className="min-w-0 truncate text-xs text-[var(--text1)]">{m.label}</span>
                        <div className="flex shrink-0 gap-1.5">
                          {/* Lock toggle */}
                          <button
                            onClick={() => handleToggleSeries(si, m.key)}
                            disabled={loadingKey === lockKey}
                            title={serLocked ? 'לחץ לפתיחה' : 'לחץ לנעילה'}
                            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[0.65rem] transition-all ${
                              serLocked
                                ? 'border-[var(--green)]/40 bg-[var(--green)]/10 text-[var(--green)]'
                                : 'border-[var(--card-border)] text-[var(--text2)] hover:border-[var(--orange-border)]'
                            }`}
                          >
                            {loadingKey === lockKey ? <span>⏳</span> : serLocked ? <Lock size={9} /> : <Unlock size={9} />}
                            {serLocked ? 'נעול' : 'פתוח'}
                          </button>

                          {/* Betting-open toggle */}
                          <button
                            onClick={async () => {
                              setLoadingKey(openKey)
                              try {
                                await setSeriesOpen(si, m.key, !serOpen)
                                toast(serOpen ? `📴 ${m.label} — הגשה נסגרה` : `🟢 ${m.label} — נפתח להגשת הימורים`)
                              } finally {
                                setLoadingKey(null)
                              }
                            }}
                            disabled={loadingKey === openKey || serLocked}
                            title={serLocked ? 'הסדרה נעולה' : serOpen ? 'סגור להגשה' : 'פתח להגשת הימורים'}
                            className={`flex items-center gap-1 rounded-md border px-2 py-1 text-[0.65rem] transition-all ${
                              serLocked
                                ? 'cursor-not-allowed border-[var(--card-border)] text-[var(--text2)] opacity-40'
                                : serOpen
                                  ? 'border-[var(--gold)]/50 bg-[var(--gold)]/15 text-[var(--gold)]'
                                  : 'border-[var(--card-border)] text-[var(--text2)] hover:border-[var(--gold)]/30 hover:text-[var(--gold)]'
                            }`}
                          >
                            {loadingKey === openKey ? <span>⏳</span> : serOpen ? '🟢' : '⭕'}
                            {serOpen ? 'פתוח' : 'סגור'}
                          </button>
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

      {/* ── Betting override section ─────────────────────────────────────── */}
      <div className="mt-5 rounded-lg border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-3">
        <div className="mb-1 flex items-center gap-2">
          <Unlock size={13} className="text-[var(--gold)]" />
          <span className="text-sm font-bold text-[var(--gold)]">פתיחת הגשת הימורים ידנית</span>
        </div>
        <p className="mb-3 text-[0.7rem] leading-relaxed text-[var(--text2)]">
          מאפשר למשתתפים להגיש הימורים לשלב גם אם תוצאות השלב הקודם טרם הוזנו. שימושי כשסדרה בשלב מאוחר מתחילה לפני שסדרה בשלב הקודם מסתיימת.
        </p>
        <div className="space-y-1.5">
          {/* Stage 0 always open — only show gated stages */}
          {(['0b', '1', '2', '3', '4'] as const).map((v) => {
            const si = (v === '0b' ? '0b' : parseInt(v)) as StageKey
            const sIdx = STAGE_KEYS.indexOf(si)
            const isForced = !!(getGlobal('stageUnlocked', {} as Record<string, boolean>))[String(si)]
            const overrideKey = `unlock_${v}`
            return (
              <div key={v} className="flex items-center justify-between rounded-lg border border-[rgba(255,215,0,0.1)] bg-[var(--dark3)] px-3 py-2">
                <span className="text-sm text-[var(--text1)]">{STAGE_SHORT[sIdx]}</span>
                <button
                  disabled={loadingKey === overrideKey}
                  onClick={async () => {
                    setLoadingKey(overrideKey)
                    try {
                      await setStageUnlocked(si, !isForced)
                      toast(isForced ? `🔒 ${STAGE_SHORT[sIdx]} — חזר לפתיחה אוטומטית` : `🔓 ${STAGE_SHORT[sIdx]} — הימורים נפתחו ידנית`)
                    } finally {
                      setLoadingKey(null)
                    }
                  }}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs transition-all ${
                    isForced
                      ? 'border-[var(--gold)]/50 bg-[var(--gold)]/15 text-[var(--gold)]'
                      : 'border-[var(--card-border)] text-[var(--text2)] hover:border-[var(--gold)]/30 hover:text-[var(--gold)]'
                  }`}
                >
                  {loadingKey === overrideKey ? (
                    <span className="text-[0.6rem]">⏳</span>
                  ) : isForced ? (
                    <Unlock size={11} />
                  ) : (
                    <Lock size={11} />
                  )}
                  {isForced ? 'פתוח ידנית' : 'נעול אוטומטי'}
                </button>
              </div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}
