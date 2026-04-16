import { useState, useEffect } from 'react'
import { doc, updateDoc, deleteField } from 'firebase/firestore'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useGlobalStore } from '@/store/global.store'
import { db } from '@/lib/firebase'

function formatIsraelTime(ts: number): string {
  return new Intl.DateTimeFormat('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts))
}

function tsToDatetimeLocal(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function defaultDatetimeLocal(): string {
  return tsToDatetimeLocal(Date.now() + 3_600_000)
}

export default function BracketLockPanel() {
  const globalData   = useGlobalStore((s) => s.globalData)
  const locked       = (globalData.bracketLocked as boolean | undefined) || false
  const autoLockTs   = (globalData.bracketAutoLock as number | undefined) || 0

  const [dtInput, setDtInput] = useState(defaultDatetimeLocal)
  const [saving, setSaving]   = useState(false)

  // Pre-fill input when an existing schedule is loaded
  useEffect(() => {
    if (autoLockTs > 0) setDtInput(tsToDatetimeLocal(autoLockTs))
  }, [autoLockTs])

  // Auto-execute the lock when the scheduled time arrives (admin client)
  useEffect(() => {
    if (!autoLockTs || locked) return
    const delay = autoLockTs - Date.now()
    if (delay <= 0) {
      // Already past — execute immediately
      updateDoc(doc(db, 'global', 'settings'), {
        bracketLocked: true,
        bracketAutoLock: deleteField(),
      }).catch(() => {})
      return
    }
    const timer = setTimeout(() => {
      updateDoc(doc(db, 'global', 'settings'), {
        bracketLocked: true,
        bracketAutoLock: deleteField(),
      }).catch(() => {})
    }, delay)
    return () => clearTimeout(timer)
  }, [autoLockTs, locked])

  async function handleToggleLock() {
    setSaving(true)
    try {
      if (locked) {
        await updateDoc(doc(db, 'global', 'settings'), {
          bracketLocked: false,
          bracketAutoLock: deleteField(),
        })
        toast('🔓 הברקט נפתח — משתתפים יכולים לערוך שוב')
      } else {
        await updateDoc(doc(db, 'global', 'settings'), {
          bracketLocked: true,
          bracketAutoLock: deleteField(),
        })
        toast('🔒 הברקט ננעל — כל הברקטים גלויים בטאב ההימורים')
      }
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setSaving(false) }
  }

  async function handleSchedule() {
    const ts = new Date(dtInput).getTime()
    if (isNaN(ts)) { toast('❌ תאריך לא תקין'); return }
    if (ts <= Date.now()) { toast('❌ יש לבחור זמן עתידי'); return }
    setSaving(true)
    try {
      await updateDoc(doc(db, 'global', 'settings'), { bracketAutoLock: ts })
      toast(`⏰ נעילה מתוזמנת ל-${formatIsraelTime(ts)}`)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setSaving(false) }
  }

  async function handleClearSchedule() {
    setSaving(true)
    try {
      await updateDoc(doc(db, 'global', 'settings'), { bracketAutoLock: deleteField() })
      toast('✅ תזמון הנעילה בוטל')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setSaving(false) }
  }

  return (
    <Card>
      <CardTitle>🔒 נעילת הברקט</CardTitle>

      <p className="mb-4 text-sm text-[var(--text2)]">
        נעילת הברקט מונעת מהמשתתפים לערוך את הבחירות שלהם, ומאפשרת לכולם לצפות בברקטים של שאר המשתתפים בטאב "הימורים".
        אין נעילה לפי סדרה — נעילה אחת גלובלית לכל הברקט.
      </p>

      {/* Current status */}
      <div className={`mb-4 flex items-center gap-3 rounded-lg border p-4 ${
        locked
          ? 'border-[rgba(255,80,80,0.4)] bg-[rgba(255,80,80,0.07)]'
          : 'border-[rgba(0,200,100,0.3)] bg-[rgba(0,200,100,0.05)]'
      }`}>
        <span className="text-3xl">{locked ? '🔒' : '🔓'}</span>
        <div>
          <div className={`font-bold ${locked ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>
            {locked ? 'הברקט נעול' : 'הברקט פתוח לעריכה'}
          </div>
          {!locked && autoLockTs > 0 && (
            <div className="text-xs text-[var(--gold)]">
              ⏰ נעילה מתוזמנת: {formatIsraelTime(autoLockTs)}
            </div>
          )}
        </div>
      </div>

      {/* Manual toggle */}
      <div className="mb-4">
        <Button
          onClick={handleToggleLock}
          disabled={saving}
          className={locked
            ? '!bg-[rgba(0,200,100,0.1)] !border-[rgba(0,200,100,0.3)] !text-[var(--green)]'
            : '!bg-[rgba(255,80,80,0.1)] !border-[rgba(255,80,80,0.3)] !text-[var(--red)]'}
          variant="secondary"
        >
          {saving ? '⏳' : locked ? '🔓 פתח את הברקט עכשיו' : '🔒 נעל את הברקט עכשיו'}
        </Button>
      </div>

      <hr className="mb-4 border-[var(--border)]" />

      {/* Auto-lock scheduler */}
      <div>
        <div className="mb-2 font-bold text-[var(--orange)]">⏰ תזמון נעילה אוטומטית</div>
        <p className="mb-3 text-xs text-[var(--text2)]">
          הברקט ייעול אוטומטית בתאריך ובשעה שתבחר (שעון ישראל).
          אם הדפדפן פתוח בזמן הנעילה — הפעולה תבוצע מיד. בכל מקרה, כל לקוח שיטען את הדף לאחר מכן יראה את הברקט כנעול.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="datetime-local"
            className="ts-inp"
            value={dtInput}
            onChange={(e) => setDtInput(e.target.value)}
          />
          <Button variant="secondary" size="sm" onClick={handleSchedule} disabled={saving || locked}>
            ⏰ קבע נעילה
          </Button>
          {autoLockTs > 0 && (
            <Button variant="secondary" size="sm" onClick={handleClearSchedule} disabled={saving}
              className="!border-[rgba(255,80,80,0.3)] !text-[var(--red)]">
              ✕ בטל תזמון
            </Button>
          )}
        </div>
        {autoLockTs > 0 && (
          <div className="mt-2 text-xs text-[var(--gold)]">
            ⏰ מתוזמן: {formatIsraelTime(autoLockTs)}
          </div>
        )}
      </div>
    </Card>
  )
}
