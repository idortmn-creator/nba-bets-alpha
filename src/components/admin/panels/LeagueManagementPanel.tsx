import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectNative } from '@/components/ui/select-native'
import { loadAllLeagues, deleteLeague, removeUserFromLeague } from '@/services/league.service'
import { saveBet } from '@/services/global.service'
import type { StageKey } from '@/lib/constants'

type AnyLeague = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

interface BetEdit {
  leagueId: string
  uid: string
  stage: string
}

export default function LeagueManagementPanel() {
  const [leagues, setLeagues] = useState<AnyLeague[]>([])
  const [loading, setLoading] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [betEdit, setBetEdit] = useState<BetEdit | null>(null)
  const [betFields, setBetFields] = useState<[string, string][]>([])
  const [newKey, setNewKey] = useState('')
  const [newVal, setNewVal] = useState('')

  async function handleLoad() {
    setLoading(true)
    try {
      const all = await loadAllLeagues()
      setLeagues(all)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(league: AnyLeague) {
    if (!confirm(`מחק ליגה "${league.name}"? פעולה בלתי הפיכה!`)) return
    try {
      await deleteLeague(league.id, league.members || [])
      setLeagues((prev) => prev.filter((l) => l.id !== league.id))
      if (expandedId === league.id) setExpandedId(null)
      toast('✅ ליגה נמחקה')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function handleRemoveMember(league: AnyLeague, uid: string, username: string) {
    if (!confirm(`הסר את "${username}" מהליגה?`)) return
    try {
      await removeUserFromLeague(league.id, uid)
      setLeagues((prev) => prev.map((l) => {
        if (l.id !== league.id) return l
        const newMemberInfo = { ...(l.memberInfo || {}) }
        delete newMemberInfo[uid]
        return { ...l, members: (l.members || []).filter((m: string) => m !== uid), memberInfo: newMemberInfo }
      }))
      if (betEdit?.leagueId === league.id && betEdit?.uid === uid) closeBetEdit()
      toast('✅ משתמש הוסר')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  function openBetEdit(league: AnyLeague, uid: string, stageStr: string) {
    const stage: StageKey = stageStr === '0b' ? '0b' : (parseInt(stageStr) as StageKey)
    const existing: Record<string, string> = ((league.bets || {})[uid] || {})['stage' + stage] || {}
    setBetEdit({ leagueId: league.id, uid, stage: stageStr })
    setBetFields(Object.entries(existing))
    setNewKey('')
    setNewVal('')
  }

  function closeBetEdit() {
    setBetEdit(null)
    setBetFields([])
    setNewKey('')
    setNewVal('')
  }

  async function handleSaveBet(leagueId: string) {
    if (!betEdit) return
    const stage: StageKey = betEdit.stage === '0b' ? '0b' : (parseInt(betEdit.stage) as StageKey)
    const data: Record<string, string> = Object.fromEntries(betFields.filter(([k]) => k.trim()))
    try {
      await saveBet(leagueId, betEdit.uid, stage, data)
      // Update local league bets state
      setLeagues((prev) => prev.map((l) => {
        if (l.id !== leagueId) return l
        return {
          ...l,
          bets: {
            ...(l.bets || {}),
            [betEdit.uid]: {
              ...((l.bets || {})[betEdit.uid] || {}),
              ['stage' + stage]: data,
            },
          },
        }
      }))
      toast('✅ הימורים עודכנו')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <Card>
      <CardTitle>🏟️ ניהול ליגות</CardTitle>
      <Button variant="secondary" size="sm" onClick={handleLoad} disabled={loading}>
        {loading ? '⏳ טוען...' : '📋 טען כל הליגות'}
      </Button>

      {leagues.length === 0 && !loading && (
        <div className="mt-3 text-sm text-[var(--text2)]">לחץ כדי לטעון את כל הליגות במערכת</div>
      )}

      <div className="mt-3 space-y-3">
        {leagues.map((league) => (
          <div key={league.id} className="rounded-lg border border-[var(--orange-border)] bg-[var(--dark3)] p-3">
            {/* League header */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold">{league.name}</div>
                <div className="text-xs text-[var(--text2)]">
                  קוד: <span className="font-oswald tracking-wider text-[var(--orange)]">{league.code}</span>
                  {' · '}{(league.members || []).length} משתתפים
                  {' · '}<span className="text-[var(--text2)]">{league.id}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { setExpandedId(expandedId === league.id ? null : league.id); closeBetEdit() }}
                >
                  {expandedId === league.id ? '▲' : '▼'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(league)}>🗑️</Button>
              </div>
            </div>

            {/* Expanded members list */}
            {expandedId === league.id && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text2)]">משתתפים</div>
                {(league.members || []).length === 0 && (
                  <div className="text-xs text-[var(--text2)]">אין משתתפים</div>
                )}
                {(league.members || []).map((uid: string) => {
                  const info = (league.memberInfo || {})[uid] || {}
                  const isEditing = betEdit?.leagueId === league.id && betEdit?.uid === uid

                  return (
                    <div key={uid} className="mb-2 rounded border border-[rgba(255,255,255,0.06)] bg-[var(--dark2)] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold">{info.username || uid}</span>
                          {info.displayName && <span className="ml-2 text-xs text-[var(--text2)]">{info.displayName}</span>}
                        </div>
                        <Button variant="destructive" size="sm" onClick={() => handleRemoveMember(league, uid, info.username || uid)}>
                          הסר
                        </Button>
                      </div>

                      {/* Bet edit selector */}
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-xs text-[var(--text2)]">ערוך הימורים:</span>
                        <SelectNative
                          className="!w-auto !py-0.5 !text-xs"
                          value={isEditing ? betEdit!.stage : ''}
                          onChange={(e) => {
                            if (e.target.value) openBetEdit(league, uid, e.target.value)
                            else closeBetEdit()
                          }}
                        >
                          <option value="">— בחר שלב —</option>
                          <option value="0">פליי-אין א</option>
                          <option value="0b">פליי-אין ב</option>
                          <option value="1">סיבוב 1</option>
                          <option value="2">סיבוב 2</option>
                          <option value="3">גמר איזורי</option>
                          <option value="4">גמר NBA</option>
                        </SelectNative>
                      </div>

                      {/* Bet fields editor */}
                      {isEditing && (
                        <div className="mt-2 space-y-1">
                          {betFields.length === 0 && (
                            <div className="text-xs text-[var(--text2)]">אין הימורים קיימים לשלב זה</div>
                          )}
                          {betFields.map(([key, val], i) => (
                            <div key={i} className="flex items-center gap-1.5">
                              <Input
                                className="!h-7 !w-36 !text-xs font-mono"
                                value={key}
                                onChange={(e) => setBetFields((prev) => prev.map((f, fi) => fi === i ? [e.target.value, f[1]] : f))}
                              />
                              <span className="text-[var(--text2)]">→</span>
                              <Input
                                className="!h-7 flex-1 !text-xs"
                                value={val}
                                onChange={(e) => setBetFields((prev) => prev.map((f, fi) => fi === i ? [f[0], e.target.value] : f))}
                              />
                              <button
                                className="text-xs text-[var(--red)] hover:opacity-80"
                                onClick={() => setBetFields((prev) => prev.filter((_, fi) => fi !== i))}
                              >✕</button>
                            </div>
                          ))}

                          {/* Add new field */}
                          <div className="mt-1 flex items-center gap-1.5">
                            <Input
                              className="!h-7 !w-36 !text-xs font-mono"
                              placeholder="מפתח..."
                              value={newKey}
                              onChange={(e) => setNewKey(e.target.value)}
                            />
                            <span className="text-[var(--text2)]">→</span>
                            <Input
                              className="!h-7 flex-1 !text-xs"
                              placeholder="ערך..."
                              value={newVal}
                              onChange={(e) => setNewVal(e.target.value)}
                            />
                            <button
                              className="text-xs text-[var(--green-light)] hover:opacity-80"
                              onClick={() => {
                                if (!newKey.trim()) return
                                setBetFields((prev) => [...prev, [newKey.trim(), newVal]])
                                setNewKey('')
                                setNewVal('')
                              }}
                            >＋</button>
                          </div>

                          <div className="mt-2 flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => handleSaveBet(league.id)}>💾 שמור</Button>
                            <Button variant="secondary" size="sm" onClick={closeBetEdit}>ביטול</Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
