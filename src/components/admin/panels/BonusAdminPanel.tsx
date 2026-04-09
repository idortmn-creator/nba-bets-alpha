import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { SelectNative } from '@/components/ui/select-native'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { saveBonusBets } from '@/services/global.service'
import { STAGE_MATCHES } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'
import type { BonusBet } from '@/store/global.store'

export default function BonusAdminPanel() {
  const { globalData, getBonusBets, getTeams } = useGlobalHelpers()
  const [selectedStage, setSelectedStage] = useState<string>('0')
  const si: StageKey = selectedStage === '0b' ? '0b' : (parseInt(selectedStage) as StageKey)
  const [draft, setDraft] = useState<BonusBet[]>([])
  const stageMatches = STAGE_MATCHES[si] || []

  useEffect(() => {
    setDraft(JSON.parse(JSON.stringify(getBonusBets(si))))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage, globalData])

  function updateBonus(idx: number, field: string, val: unknown) {
    setDraft((d) => d.map((b, i) => i === idx ? { ...b, [field]: val } : b))
  }
  function addBonus() { setDraft((d) => [...d, { id: 'b' + Date.now(), question: '', points: 1, answers: ['', ''], seriesKey: '' }]) }
  function removeBonus(idx: number) { setDraft((d) => d.filter((_, i) => i !== idx)) }
  function addAnswer(idx: number) { setDraft((d) => d.map((b, i) => i === idx ? { ...b, answers: [...b.answers, ''] } : b)) }
  function removeAnswer(idx: number, aidx: number) { setDraft((d) => d.map((b, i) => i === idx ? { ...b, answers: b.answers.filter((_, ai) => ai !== aidx) } : b)) }
  function updateAnswer(idx: number, aidx: number, val: string) {
    setDraft((d) => d.map((b, i) => i === idx ? { ...b, answers: b.answers.map((a, ai) => ai === aidx ? val : a) } : b))
  }

  async function handleSave() {
    await saveBonusBets(si, draft)
    toast('✅ הימורי בונוס נשמרו!')
  }

  return (
    <Card>
      <CardTitle>⭐ הימורי בונוס</CardTitle>
      <SelectNative value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)} className="!w-auto mb-3">
        <option value="0">פליי-אין (כל השלב)</option>
        <option value="1">סיבוב ראשון</option>
        <option value="2">סיבוב שני</option>
        <option value="3">גמר איזורי</option>
        <option value="4">גמר NBA</option>
      </SelectNative>

      {draft.length === 0 ? (
        <div className="text-sm text-[var(--text2)]">אין הימורי בונוס — לחץ ➕ להוספה</div>
      ) : draft.map((b, i) => (
        <div key={b.id} className="bonus-admin-card">
          <button className="absolute left-2 top-2 text-xs text-[var(--red)]" onClick={() => removeBonus(i)}>✕ הסר</button>
          <div className="mb-2"><Label>שאלה</Label><Input value={b.question} onChange={(e) => updateBonus(i, 'question', e.target.value)} placeholder="השאלה..." /></div>
          <div className="mb-2"><Label>נקודות</Label><Input type="number" value={b.points} min={0.5} step={0.5} onChange={(e) => updateBonus(i, 'points', parseFloat(e.target.value) || 1)} className="!w-24" /></div>
          {stageMatches.length > 0 && (
            <div className="mb-2"><Label>🔗 שייך לסדרה</Label>
              <SelectNative value={b.seriesKey || ''} onChange={(e) => updateBonus(i, 'seriesKey', e.target.value)}>
                <option value="">ללא שיוך — נעל עם שלב</option>
                {stageMatches.map((m) => { const t = getTeams(si, m.key); return <option key={m.key} value={m.key}>{t.home && t.away ? `${t.home} מול ${t.away}` : m.label}</option> })}
              </SelectNative>
            </div>
          )}
          <Label className="!text-[0.78rem]">תשובות אפשריות</Label>
          {b.answers.map((a, ai) => (
            <div key={ai} className="bonus-answer-row">
              <Input value={a} onChange={(e) => updateAnswer(i, ai, e.target.value)} placeholder="תשובה..." className="flex-1" />
              <button className="text-xs text-[var(--red)]" onClick={() => removeAnswer(i, ai)}>✕</button>
            </div>
          ))}
          <Button variant="ghost" size="sm" onClick={() => addAnswer(i)} className="mt-1 !text-xs">➕ הוסף תשובה</Button>
        </div>
      ))}

      <div className="flex flex-wrap gap-2 mt-2">
        <Button variant="secondary" size="sm" onClick={addBonus}>➕ הוסף הימור בונוס</Button>
        {draft.length > 0 && <Button onClick={handleSave}>💾 שמור הימורי בונוס</Button>}
      </div>
    </Card>
  )
}
