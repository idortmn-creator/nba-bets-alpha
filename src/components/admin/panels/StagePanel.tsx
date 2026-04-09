import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SelectNative } from '@/components/ui/select-native'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { setCurrentStage, toggleStageLock } from '@/services/global.service'
import { STAGE_NAMES, STAGE_SHORT, STAGE_KEYS } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

export default function StagePanel() {
  const { globalData, getGlobal } = useGlobalHelpers()
  const [selectedStage, setSelectedStage] = useState<string>('0')
  const csIdx = STAGE_KEYS.indexOf(getGlobal('currentStage', 0))
  const sl = getGlobal('stageLocked', [false, false, false, false, false, false] as boolean[])

  async function handleSetStage() {
    const s: StageKey = selectedStage === '0b' ? '0b' : (parseInt(selectedStage) as StageKey)
    await setCurrentStage(s)
    toast('✅ שלב עודכן!')
  }

  async function handleToggleLock() {
    const s: StageKey = selectedStage === '0b' ? '0b' : (parseInt(selectedStage) as StageKey)
    const locked = await toggleStageLock(s, globalData)
    toast(locked ? '🔒 שלב וכל הסדרות ננעלו' : '🔓 נפתח')
  }

  return (
    <Card>
      <CardTitle>🔄 ניהול שלבים</CardTitle>
      <div className="mb-2 rounded-lg border border-[var(--orange-border)] bg-[var(--dark3)] p-2 text-sm">
        <strong>שלב נוכחי:</strong> {STAGE_NAMES[csIdx] || ''} {sl[csIdx] ? '🔒' : '🟢'}
      </div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {STAGE_SHORT.map((s, i) => (
          <span key={i} className={`rounded-md border px-2 py-0.5 text-xs ${sl[i] ? 'border-[var(--green)] text-[var(--green)]' : 'border-[var(--orange-border)] text-[var(--text2)]'}`}>
            {s} {sl[i] ? '🔒' : '🔓'}
          </span>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <SelectNative value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)} className="!w-auto">
          <option value="0">פליי-אין סיבוב א</option>
          <option value="0b">פליי-אין גמר</option>
          <option value="1">סיבוב ראשון</option>
          <option value="2">סיבוב שני</option>
          <option value="3">גמר איזורי</option>
          <option value="4">גמר NBA</option>
        </SelectNative>
        <Button variant="secondary" size="sm" onClick={handleSetStage}>עדכן שלב</Button>
        <Button variant="secondary" size="sm" onClick={handleToggleLock}>🔒 נעל/פתח</Button>
      </div>
    </Card>
  )
}
