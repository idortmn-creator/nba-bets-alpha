import { useState } from 'react'
import { doc, updateDoc, deleteField } from 'firebase/firestore'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useGlobalStore } from '@/store/global.store'
import { db } from '@/lib/firebase'
import { BRACKET_SERIES } from '@/bracket/bracketConstants'
import type { BracketSeriesMap, BracketSeriesState } from '@/bracket/bracketConstants'

const ROUND_LABELS: Record<number, string> = {
  1: 'סיבוב ראשון',
  2: 'חצי גמר קונפרנס',
  3: 'גמר קונפרנס',
  4: 'גמר NBA',
}

function useBracketSeries(): BracketSeriesMap {
  return (useGlobalStore((s) => s.globalData).bracketSeries as BracketSeriesMap | undefined) || {}
}

type SeriesEdits = Record<string, { homeWins: string; awayWins: string }>

export default function BracketResultsPanel() {
  const bracketSeries = useBracketSeries()
  const [edits, setEdits]   = useState<SeriesEdits>({})
  const [saving, setSaving] = useState<string | null>(null)

  function getEdit(key: string) {
    if (edits[key]) return edits[key]
    const s = bracketSeries[key]
    return { homeWins: String(s?.homeWins ?? 0), awayWins: String(s?.awayWins ?? 0) }
  }

  function setField(key: string, field: 'homeWins' | 'awayWins', val: string) {
    setEdits((prev) => ({ ...prev, [key]: { ...getEdit(key), [field]: val } }))
  }

  async function handleSave(seriesKey: string) {
    const e    = getEdit(seriesKey)
    const hw   = Math.max(0, Math.min(4, parseInt(e.homeWins) || 0))
    const aw   = Math.max(0, Math.min(4, parseInt(e.awayWins) || 0))
    const s    = bracketSeries[seriesKey]
    const home = s?.homeTeam || ''
    const away = s?.awayTeam || ''

    setSaving(seriesKey)
    try {
      const update: Record<string, unknown> = {
        [`bracketSeries.${seriesKey}.homeWins`]: hw,
        [`bracketSeries.${seriesKey}.awayWins`]: aw,
      }
      if (hw === 4 && home) {
        update[`bracketSeries.${seriesKey}.winner`] = home
        update[`bracketSeries.${seriesKey}.result`]  = `4-${aw}`
      } else if (aw === 4 && away) {
        update[`bracketSeries.${seriesKey}.winner`] = away
        update[`bracketSeries.${seriesKey}.result`]  = `4-${hw}`
      } else {
        update[`bracketSeries.${seriesKey}.winner`] = deleteField()
        update[`bracketSeries.${seriesKey}.result`]  = deleteField()
      }
      await updateDoc(doc(db, 'global', 'settings'), update)
      // Clear edit state — the store will update via onSnapshot
      setEdits((prev) => { const n = { ...prev }; delete n[seriesKey]; return n })
      toast('✅ תוצאה עודכנה')
    } catch (err: unknown) {
      toast('❌ ' + (err instanceof Error ? err.message : String(err)))
    } finally {
      setSaving(null)
    }
  }

  // Group series by round
  const byRound = BRACKET_SERIES.reduce<Record<number, typeof BRACKET_SERIES>>((acc, s) => {
    ;(acc[s.round] = acc[s.round] || []).push(s)
    return acc
  }, {})

  return (
    <Card>
      <CardTitle>📊 תוצאות ברקט (עדכון ידני)</CardTitle>
      <p className="mb-4 text-sm text-[var(--text2)]">
        תוצאות מתעדכנות אוטומטית מה-API בכל שעה. השתמש בממשק זה רק כגיבוי במקרה שה-API לא מחזיר נתוני סדרה נכונים.
      </p>

      <div className="space-y-5">
        {([1, 2, 3, 4] as const).map((round) => (
          <div key={round}>
            <div className="mb-2 font-bold text-[var(--orange)] text-sm">{ROUND_LABELS[round]}</div>
            <div className="space-y-2">
              {(byRound[round] || []).map((seriesDef) => {
                const key    = seriesDef.key
                const actual = bracketSeries[key] as BracketSeriesState | undefined
                const e      = getEdit(key)
                const isSaving = saving === key

                const hw   = Math.max(0, Math.min(4, parseInt(e.homeWins) || 0))
                const aw   = Math.max(0, Math.min(4, parseInt(e.awayWins) || 0))
                const home = actual?.homeTeam || '?'
                const away = actual?.awayTeam || '?'
                const computedWinner = hw === 4 ? home : aw === 4 ? away : null

                return (
                  <div key={key} className="rounded border border-[rgba(255,255,255,0.08)] bg-[var(--dark3)] p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-[var(--text1)]">{seriesDef.label}</span>
                        <span className="ml-2 font-mono text-[0.6rem] text-[var(--text2)] opacity-50">{key}</span>
                      </div>
                      {actual?.winner && (
                        <span className="rounded bg-[rgba(0,200,100,0.15)] px-2 py-0.5 text-xs font-bold text-[var(--green)]">
                          ✅ {actual.winner}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Home team */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-[var(--text2)] w-24 truncate" title={home}>{home}</span>
                        <input
                          type="number"
                          min={0} max={4}
                          className="ts-inp w-14 text-center"
                          value={e.homeWins}
                          onChange={(ev) => setField(key, 'homeWins', ev.target.value)}
                        />
                      </div>
                      <span className="text-xs text-[var(--text2)]">מול</span>
                      {/* Away team */}
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          min={0} max={4}
                          className="ts-inp w-14 text-center"
                          value={e.awayWins}
                          onChange={(ev) => setField(key, 'awayWins', ev.target.value)}
                        />
                        <span className="text-xs text-[var(--text2)] w-24 truncate" title={away}>{away}</span>
                      </div>
                      {computedWinner && (
                        <span className="text-xs text-[var(--gold)]">→ {computedWinner}</span>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleSave(key)}
                        disabled={!!saving}
                      >
                        {isSaving ? '⏳' : '💾'} שמור
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
