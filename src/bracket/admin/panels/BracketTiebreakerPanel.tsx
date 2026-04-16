import { useState, useEffect } from 'react'
import { doc, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGlobalStore } from '@/store/global.store'
import { db } from '@/lib/firebase'

export default function BracketTiebreakerPanel() {
  const globalData = useGlobalStore((s) => s.globalData)

  const locked  = (globalData.bracketTiebreakerLocked as boolean | undefined) || false
  const [question, setQuestion] = useState('')
  const [answer, setAnswer]     = useState('')

  useEffect(() => {
    setQuestion((globalData.bracketTiebreakerQuestion as string | undefined) || '')
    const ans = globalData.bracketTiebreakerAnswer as number | null | undefined
    setAnswer(ans != null ? String(ans) : '')
  }, [globalData])

  async function handleSaveQuestion() {
    try {
      await updateDoc(doc(db, 'global', 'settings'), { bracketTiebreakerQuestion: question.trim() })
      toast('✅ שאלת שובר שוויון נשמרה!')
    } catch (e: unknown) { toast('❌ ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleSaveAnswer() {
    if (answer === '') {
      await updateDoc(doc(db, 'global', 'settings'), { bracketTiebreakerAnswer: null })
      toast('✅ תשובה נוקתה!')
      return
    }
    const num = parseFloat(answer)
    if (isNaN(num)) { toast('❌ יש להזין מספר תקין'); return }
    try {
      await updateDoc(doc(db, 'global', 'settings'), { bracketTiebreakerAnswer: num })
      toast('✅ תשובת שובר שוויון נשמרה!')
    } catch (e: unknown) { toast('❌ ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleToggleLock() {
    try {
      await updateDoc(doc(db, 'global', 'settings'), { bracketTiebreakerLocked: !locked })
      toast(locked ? '🔓 שובר שוויון נפתח' : '🔒 שובר שוויון ננעל — משתמשים לא יוכלו לשנות את תשובתם')
    } catch (e: unknown) { toast('❌ ' + (e instanceof Error ? e.message : String(e))) }
  }

  return (
    <Card>
      <CardTitle>🎯 שאלת שובר שוויון — ברקט</CardTitle>
      <p className="mb-4 text-sm text-[var(--text2)]">
        השאלה נענית לפני תחילת הפלייאוף. במקרה של תיקו בסוף הפלייאוף, מנצח המשתתף שתשובתו קרובה יותר לתשובה הנכונה.
      </p>

      {/* Question */}
      <div className="space-y-3">
        <div>
          <Label>טקסט השאלה</Label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="לדוגמה: כמה נקודות יובקעו בסה&quot;כ בגמר ה-NBA?"
          />
        </div>
        <Button onClick={handleSaveQuestion}>💾 שמור שאלה</Button>
      </div>

      <hr className="my-4 border-[var(--border)]" />

      {/* Lock */}
      <div className="space-y-3">
        <div>
          <Label>נעילת שובר שוויון</Label>
          <p className="mb-2 text-xs text-[var(--text2)]">
            כאשר נעול, משתמשים לא יוכלו לשנות את תשובתם לשובר השוויון.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleToggleLock}
            className={locked
              ? '!bg-[rgba(255,80,80,0.1)] !border-[rgba(255,80,80,0.3)] !text-[var(--red)]'
              : '!bg-[rgba(0,200,100,0.1)] !border-[rgba(0,200,100,0.3)] !text-[var(--green)]'}
          >
            {locked ? '🔒 נעול — לחץ לפתוח' : '🔓 פתוח — לחץ לנעול'}
          </Button>
        </div>
      </div>

      <hr className="my-4 border-[var(--border)]" />

      {/* Answer */}
      <div className="space-y-3">
        <div>
          <Label>תשובה נכונה (מספרית)</Label>
          <p className="mb-1 text-xs text-[var(--text2)]">הזן רק לאחר סיום הפלייאוף כדי לקבוע את שובר השוויון</p>
          <Input
            type="number"
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="הזן מספר..."
            className="!w-44"
          />
        </div>
        <Button variant="secondary" onClick={handleSaveAnswer}>💾 שמור תשובה נכונה</Button>
      </div>
    </Card>
  )
}
