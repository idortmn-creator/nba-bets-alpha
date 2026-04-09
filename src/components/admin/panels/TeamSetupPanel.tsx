import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SelectNative } from '@/components/ui/select-native'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { saveTeams, toggleSeriesLock } from '@/services/global.service'
import { STAGE_MATCHES } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

export default function TeamSetupPanel() {
  const { globalData, getTeams, isSeriesLocked } = useGlobalHelpers()
  const [selectedStage, setSelectedStage] = useState<string>('0')
  const si: StageKey = selectedStage === '0b' ? '0b' : (parseInt(selectedStage) as StageKey)
  const matches = STAGE_MATCHES[si] || []
  const [teams, setTeams] = useState<Record<string, { home: string; away: string }>>({})

  useEffect(() => {
    const t: Record<string, { home: string; away: string }> = {}
    for (const m of matches) {
      const existing = getTeams(si, m.key)
      t[m.key] = { home: existing.home, away: existing.away }
    }
    setTeams(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage, globalData])

  async function handleSave() {
    await saveTeams(si, teams, globalData)
    toast('✅ קבוצות נשמרו!')
  }

  async function handleToggleSeriesLock(mk: string) {
    const newVal = await toggleSeriesLock(si, mk, globalData)
    toast(newVal ? '🔒 סדרה ננעלה' : '🔓 נפתחה')
  }

  return (
    <Card>
      <CardTitle>🏀 הגדרת קבוצות</CardTitle>
      <SelectNative value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)} className="!w-auto mb-3">
        <option value="0">פליי-אין סיבוב א</option>
        <option value="0b">פליי-אין גמר</option>
        <option value="1">סיבוב ראשון</option>
        <option value="2">סיבוב שני</option>
        <option value="3">גמר איזורי</option>
        <option value="4">גמר NBA</option>
      </SelectNative>
      {si === '0b' ? (
        <div className="rounded-lg border border-[var(--orange-border)] bg-[var(--dark3)] p-3 text-sm">🔄 קבוצות מחושבות אוטומטית מתוצאות שלב א</div>
      ) : (
        <div className="space-y-1.5">
          {matches.map((m) => {
            const sLk = isSeriesLocked(si, m.key)
            return (
              <div key={m.key} className={`rounded-lg border p-2 ${sLk ? 'border-[var(--green)]/25' : 'border-[var(--orange-border)]'}`}>
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-xs text-[var(--text2)]">{m.label}</span>
                  <button
                    onClick={() => handleToggleSeriesLock(m.key)}
                    className={`rounded-md border px-2.5 py-0.5 text-xs ${sLk ? 'border-[var(--green)] bg-[var(--green)]/15 text-[var(--green)]' : 'border-[var(--orange-border)] text-[var(--text2)]'}`}
                  >{sLk ? '🔒 נעול' : '🔓 נעל'}</button>
                </div>
                <div className="flex items-center gap-1.5">
                  <input className="ts-inp flex-1" value={teams[m.key]?.home || ''} onChange={(e) => setTeams((p) => ({ ...p, [m.key]: { ...p[m.key], home: e.target.value } }))} placeholder="ביתית..." />
                  <span className="vs-badge">מול</span>
                  <input className="ts-inp flex-1" value={teams[m.key]?.away || ''} onChange={(e) => setTeams((p) => ({ ...p, [m.key]: { ...p[m.key], away: e.target.value } }))} placeholder="אורחת..." />
                </div>
              </div>
            )
          })}
          <Button variant="secondary" size="sm" onClick={handleSave} className="mt-2">💾 שמור קבוצות</Button>
        </div>
      )}
    </Card>
  )
}
