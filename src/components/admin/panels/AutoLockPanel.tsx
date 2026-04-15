import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SelectNative } from '@/components/ui/select-native'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { addAutoLock, removeAutoLock } from '@/services/global.service'
import { STAGE_NAMES, STAGE_SHORT, STAGE_KEYS, STAGE_MATCHES } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

export default function AutoLockPanel() {
  const { getGlobal, getTeams, isSeriesLocked } = useGlobalHelpers()
  const [lockType, setLockType] = useState<'stage' | 'series'>('stage')
  const [target, setTarget] = useState('0')
  const [time, setTime] = useState('')

  const locks = getGlobal('autoLocks', {} as Record<string, number>)

  async function handleAdd() {
    if (!time) { toast('⚠️ בחר תאריך ושעה'); return }
    const ts = new Date(time).getTime()
    if (ts <= Date.now()) { toast('⚠️ הזמן חייב להיות בעתיד'); return }
    await addAutoLock(target, ts)
    setTime('')
    toast('✅ נעילה אוטומטית נקבעה!')
  }

  async function handleRemove(key: string) {
    await removeAutoLock(key)
    toast('✅ נעילה הוסרה')
  }

  const seriesOptions: { value: string; label: string }[] = []
  for (const si of [0, '0b', 1, 2, 3, 4] as StageKey[]) {
    for (const m of STAGE_MATCHES[si] || []) {
      const t = getTeams(si, m.key)
      const lbl = t.home && t.away ? `${t.home} מול ${t.away}` : m.label
      seriesOptions.push({ value: `series_${si}_${m.key}`, label: `${STAGE_SHORT[STAGE_KEYS.indexOf(si)]}: ${lbl}` })
    }
  }

  return (
    <Card>
      <CardTitle>⏰ שעות תחילת משחקים / נעילה אוטומטית</CardTitle>
      <div className="mb-3 rounded-lg border border-[rgba(255,215,0,0.2)] bg-[rgba(255,215,0,0.05)] p-2.5 text-xs text-[var(--text2)] leading-relaxed">
        <strong className="text-[var(--gold)]">שעת תחילת סדרה:</strong> בחר <em>סדרה</em> כסוג היעד והזן את שעת תחילת המשחק הראשון — הסדרה תינעל אוטומטית כשהמשחק יתחיל, וכל ההימורים יתגלו.
      </div>
      <div className="mb-3 space-y-1.5">
        {Object.keys(locks).length === 0 ? (
          <div className="text-xs text-[var(--text2)]">אין נעילות אוטומטיות</div>
        ) : Object.entries(locks).map(([key, ts]) => {
          let name = ''
          if (key.startsWith('series_')) {
            const parts = key.split('_')
            const si: StageKey = parts[1] === '0b' ? '0b' : (parseInt(parts[1]) as StageKey)
            const mk = parts.slice(2).join('_')
            const t = getTeams(si, mk)
            name = '🏀 ' + (t.home && t.away ? `${t.home} מול ${t.away}` : mk)
          } else {
            const normKey = key === '0b' ? '0b' : (parseInt(key) as StageKey)
            name = STAGE_NAMES[STAGE_KEYS.indexOf(normKey)] || key
          }
          const now = Date.now()
          let locked = false
          if (key.startsWith('series_')) {
            const parts = key.split('_')
            const si2: StageKey = parts[1] === '0b' ? '0b' : (parseInt(parts[1]) as StageKey)
            const mk2 = parts.slice(2).join('_')
            locked = isSeriesLocked(si2, mk2)
          } else {
            const normKey = key === '0b' ? '0b' : (parseInt(key) as StageKey)
            locked = (getGlobal('stageLocked', [] as boolean[]))[STAGE_KEYS.indexOf(normKey)] || false
          }
          const status = locked ? '✅' : ts < now ? '⚡' : '⏳'
          return (
            <div key={key} className="auto-lock-entry">
              <span className="font-bold">{name}</span>
              <span className="text-[var(--text2)]">{new Date(ts).toLocaleString('he-IL')}</span>
              <span className="text-[0.7rem]">{status}</span>
              <button onClick={() => handleRemove(key)} className="text-[var(--red)] text-xs">✕</button>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div><Label>סוג</Label>
          <SelectNative value={lockType} onChange={(e) => { setLockType(e.target.value as 'stage' | 'series'); setTarget(e.target.value === 'stage' ? '0' : seriesOptions[0]?.value || '0') }} className="!w-auto">
            <option value="stage">שלב</option><option value="series">סדרה</option>
          </SelectNative>
        </div>
        <div><Label>יעד</Label>
          <SelectNative value={target} onChange={(e) => setTarget(e.target.value)} className="!w-auto">
            {lockType === 'stage' ? (
              <>{['0', '0b', '1', '2', '3', '4'].map((v, i) => <option key={v} value={v}>{STAGE_SHORT[i]}</option>)}</>
            ) : seriesOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </SelectNative>
        </div>
        <div><Label>תאריך ושעה</Label><Input type="datetime-local" value={time} onChange={(e) => setTime(e.target.value)} /></div>
        <Button variant="secondary" size="sm" onClick={handleAdd} className="!bg-[rgba(255,215,0,0.1)] !border-[rgba(255,215,0,0.3)] !text-[var(--gold)]">➕ הוסף</Button>
      </div>
    </Card>
  )
}
