import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  loadAllBracketLeagues,
  deleteBracketLeague,
  removeBracketLeagueMember,
  relinkBracketLeagueMember,
  getBracketLeagueFromServer,
  adminSaveBracketBet,
} from '@/bracket/bracketLeague.service'
import { BRACKET_SERIES } from '@/bracket/bracketConstants'
import type { BracketPick } from '@/bracket/bracketConstants'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyLeague = Record<string, any>

export default function BracketLeagueManagementPanel() {
  const [leagues, setLeagues]       = useState<AnyLeague[]>([])
  const [loading, setLoading]       = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editTarget, setEditTarget] = useState<{ lid: string; uid: string } | null>(null)
  const [pickEdits, setPickEdits]   = useState<Record<string, { homeWins: string; awayWins: string }>>({})
  const [relinkTarget, setRelinkTarget]   = useState<{ lid: string; uid: string } | null>(null)
  const [newUidInput, setNewUidInput]     = useState('')
  const [diagTarget, setDiagTarget]   = useState<{ lid: string; uid: string } | null>(null)
  const [diagData, setDiagData]       = useState<unknown>(null)
  const [diagLoading, setDiagLoading] = useState(false)

  async function handleLoad() {
    setLoading(true)
    try {
      setLeagues(await loadAllBracketLeagues())
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setLoading(false) }
  }

  async function handleDelete(league: AnyLeague) {
    if (!confirm(`מחק ליגה "${league.name}"? פעולה בלתי הפיכה!`)) return
    try {
      await deleteBracketLeague(league.id, league.members || [])
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
      await removeBracketLeagueMember(league.id, uid)
      setLeagues((prev) => prev.map((l) => {
        if (l.id !== league.id) return l
        const mi = { ...(l.memberInfo || {}) }; delete mi[uid]
        return { ...l, members: (l.members || []).filter((u: string) => u !== uid), memberInfo: mi }
      }))
      toast('✅ משתמש הוסר')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function handleReadFirestore(lid: string, uid: string) {
    setDiagTarget({ lid, uid })
    setDiagData(null)
    setDiagLoading(true)
    try {
      const fresh = await getBracketLeagueFromServer(lid)
      const bets = (fresh as AnyLeague)?.bets || {}
      setDiagData(bets[uid] ?? '(no bets entry for this UID)')
    } catch (e: unknown) {
      setDiagData('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setDiagLoading(false) }
  }

  async function openBetEdit(league: AnyLeague, uid: string) {
    setEditTarget({ lid: league.id, uid })
    setPickEdits({})
    try {
      const fresh = await getBracketLeagueFromServer(league.id)
      const existing: BracketPick = ((fresh as AnyLeague)?.bets?.[uid]) || {}
      const edits: Record<string, { homeWins: string; awayWins: string }> = {}
      for (const s of BRACKET_SERIES) {
        const p = existing[s.key] || { homeWins: 0, awayWins: 0 }
        edits[s.key] = { homeWins: String(p.homeWins), awayWins: String(p.awayWins) }
      }
      setPickEdits(edits)
    } catch {
      const existing: BracketPick = ((league.bets || {})[uid]) || {}
      const edits: Record<string, { homeWins: string; awayWins: string }> = {}
      for (const s of BRACKET_SERIES) {
        const p = existing[s.key] || { homeWins: 0, awayWins: 0 }
        edits[s.key] = { homeWins: String(p.homeWins), awayWins: String(p.awayWins) }
      }
      setPickEdits(edits)
    }
  }

  function closeBetEdit() { setEditTarget(null); setPickEdits({}) }

  async function handleSaveBet() {
    if (!editTarget) return
    const pick: BracketPick = {}
    for (const s of BRACKET_SERIES) {
      const e = pickEdits[s.key]
      if (!e) continue
      const hw = Math.max(0, Math.min(4, parseInt(e.homeWins) || 0))
      const aw = Math.max(0, Math.min(4, parseInt(e.awayWins) || 0))
      if (hw > 0 || aw > 0) pick[s.key] = { homeWins: hw, awayWins: aw }
    }
    try {
      await adminSaveBracketBet(editTarget.lid, editTarget.uid, pick)
      toast('✅ הימורים עודכנו')
      closeBetEdit()
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  async function handleRelink(lid: string) {
    if (!relinkTarget || !newUidInput.trim()) return
    const newUid = newUidInput.trim()
    const oldUid = relinkTarget.uid
    try {
      await relinkBracketLeagueMember(lid, oldUid, newUid)
      setLeagues((prev) => prev.map((l) => {
        if (l.id !== lid) return l
        const mi = { ...(l.memberInfo || {}) }
        mi[newUid] = mi[oldUid] ?? {}; delete mi[oldUid]
        const b = { ...(l.bets || {}) }
        b[newUid] = b[oldUid] ?? {}; delete b[oldUid]
        return { ...l, members: (l.members || []).map((u: string) => u === oldUid ? newUid : u), memberInfo: mi, bets: b }
      }))
      setRelinkTarget(null); setNewUidInput('')
      toast('✅ UID עודכן')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  const ROUND_LABELS: Record<number, string> = { 1: 'ס.1', 2: 'ס.2', 3: 'CF', 4: 'Finals' }

  return (
    <Card>
      <CardTitle>🏟️ ניהול ליגות ברקט</CardTitle>
      <Button variant="secondary" size="sm" onClick={handleLoad} disabled={loading}>
        {loading ? '⏳ טוען...' : '📋 טען כל הליגות'}
      </Button>

      {leagues.length === 0 && !loading && (
        <div className="mt-3 text-sm text-[var(--text2)]">לחץ כדי לטעון את כל ליגות הברקט</div>
      )}

      <div className="mt-3 space-y-3">
        {leagues.map((league) => (
          <div key={league.id} className="rounded-lg border border-[var(--orange-border)] bg-[var(--dark3)] p-3">
            {/* Header */}
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold">{league.name}</div>
                <div className="text-xs text-[var(--text2)]">
                  קוד: <span className="font-oswald tracking-wider text-[var(--orange)]">{league.code}</span>
                  {' · '}{(league.members || []).length} משתתפים
                  {' · '}<span className="opacity-50">{league.id}</span>
                </div>
              </div>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm"
                  onClick={() => { setExpandedId(expandedId === league.id ? null : league.id); closeBetEdit() }}>
                  {expandedId === league.id ? '▲' : '▼'}
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(league)}>🗑️</Button>
              </div>
            </div>

            {/* Members */}
            {expandedId === league.id && (
              <div className="mt-3">
                <div className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--text2)]">משתתפים</div>
                {(league.members || []).length === 0 && (
                  <div className="text-xs text-[var(--text2)]">אין משתתפים</div>
                )}
                {(league.members || []).map((uid: string) => {
                  const info = (league.memberInfo || {})[uid] || {}
                  const isEditing = editTarget?.lid === league.id && editTarget?.uid === uid

                  return (
                    <div key={uid} className="mb-2 rounded border border-[rgba(255,255,255,0.06)] bg-[var(--dark2)] p-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-semibold">{info.username || uid}</span>
                          {info.displayName && <span className="ml-2 text-xs text-[var(--text2)]">{info.displayName}</span>}
                          <div className="mt-0.5 font-mono text-[0.6rem] text-[var(--text2)] opacity-60 select-all">{uid}</div>
                        </div>
                        <div className="flex gap-1">
                          <Button variant="secondary" size="sm" title="קרא מ-Firestore"
                            onClick={() => handleReadFirestore(league.id, uid)}>🔍</Button>
                          <Button variant="secondary" size="sm" title="שנה UID"
                            onClick={() => { setRelinkTarget({ lid: league.id, uid }); setNewUidInput('') }}>🔗</Button>
                          <Button variant="secondary" size="sm"
                            onClick={() => isEditing ? closeBetEdit() : openBetEdit(league, uid)}>
                            {isEditing ? '✕ סגור' : '✏️ ערוך'}
                          </Button>
                          <Button variant="destructive" size="sm"
                            onClick={() => handleRemoveMember(league, uid, info.username || uid)}>הסר</Button>
                        </div>
                      </div>

                      {/* Relink */}
                      {relinkTarget?.lid === league.id && relinkTarget?.uid === uid && (
                        <div className="mt-2 rounded border border-[rgba(255,215,0,0.25)] bg-[rgba(255,215,0,0.05)] p-2">
                          <div className="mb-1.5 text-[0.7rem] text-[var(--gold)]">🔗 החלפת UID — הזן את ה-UID החדש</div>
                          <div className="flex gap-1.5">
                            <Input className="!h-7 flex-1 !text-xs font-mono"
                              placeholder="UID חדש מ-Firebase Auth..."
                              value={newUidInput} onChange={(e) => setNewUidInput(e.target.value)} />
                            <Button variant="secondary" size="sm" onClick={() => handleRelink(league.id)}>✓ אשר</Button>
                            <Button variant="secondary" size="sm" onClick={() => setRelinkTarget(null)}>ביטול</Button>
                          </div>
                        </div>
                      )}

                      {/* Diagnostic */}
                      {diagTarget?.lid === league.id && diagTarget?.uid === uid && (
                        <div className="mt-2 rounded border border-[rgba(100,200,255,0.2)] bg-[rgba(100,200,255,0.05)] p-2">
                          <div className="mb-1 flex items-center justify-between">
                            <span className="text-[0.7rem] font-bold text-[var(--blue)]">🔍 נתוני Firestore</span>
                            <button className="text-xs text-[var(--text2)]"
                              onClick={() => { setDiagTarget(null); setDiagData(null) }}>✕</button>
                          </div>
                          {diagLoading ? (
                            <div className="text-xs text-[var(--text2)]">⏳ טוען...</div>
                          ) : (
                            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[0.6rem]">
                              {JSON.stringify(diagData, null, 2)}
                            </pre>
                          )}
                        </div>
                      )}

                      {/* Bracket bet editor */}
                      {isEditing && (
                        <div className="mt-3">
                          <div className="mb-2 text-[0.65rem] text-[var(--text2)]">
                            ערוך ניצחונות לפי סדרה. שדות ריקים (0/0) לא נשמרים.
                          </div>
                          <div className="space-y-3">
                            {([1, 2, 3, 4] as const).map((round) => (
                              <div key={round}>
                                <div className="mb-1 text-[0.65rem] font-bold text-[var(--orange)]">{ROUND_LABELS[round]}</div>
                                <div className="space-y-1">
                                  {BRACKET_SERIES.filter((s) => s.round === round).map((seriesDef) => {
                                    const e = pickEdits[seriesDef.key] || { homeWins: '0', awayWins: '0' }
                                    return (
                                      <div key={seriesDef.key} className="flex items-center gap-2">
                                        <span className="w-40 shrink-0 truncate text-[0.65rem] text-[var(--text2)]"
                                          title={seriesDef.label}>{seriesDef.label}</span>
                                        <input type="number" min={0} max={4}
                                          className="ts-inp w-12 text-center !py-0.5 !text-xs"
                                          value={e.homeWins}
                                          onChange={(ev) => setPickEdits((prev) => ({
                                            ...prev,
                                            [seriesDef.key]: { ...e, homeWins: ev.target.value }
                                          }))} />
                                        <span className="text-[0.6rem] text-[var(--text2)]">—</span>
                                        <input type="number" min={0} max={4}
                                          className="ts-inp w-12 text-center !py-0.5 !text-xs"
                                          value={e.awayWins}
                                          onChange={(ev) => setPickEdits((prev) => ({
                                            ...prev,
                                            [seriesDef.key]: { ...e, awayWins: ev.target.value }
                                          }))} />
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 flex gap-2">
                            <Button variant="secondary" size="sm" onClick={handleSaveBet}>💾 שמור ברקט</Button>
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
