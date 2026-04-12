import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { saveTiebreakerQuestion, saveTiebreakerAnswer } from '@/services/global.service'

export default function TiebreakerAdminPanel() {
  const { globalData, getGlobal } = useGlobalHelpers()
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState('')

  useEffect(() => {
    setQuestion(getGlobal('tiebreakerQuestion', ''))
    const ans = getGlobal('tiebreakerAnswer', null as number | null)
    setAnswer(ans !== null && ans !== undefined ? String(ans) : '')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [globalData])

  async function handleSaveQuestion() {
    await saveTiebreakerQuestion(question.trim())
    toast('✅ שאלת שובר שוויון נשמרה!')
  }

  async function handleSaveAnswer() {
    if (answer === '') {
      await saveTiebreakerAnswer(null)
      toast('✅ תשובה נוקתה!')
      return
    }
    const num = parseFloat(answer)
    if (isNaN(num)) { toast('❌ יש להזין מספר תקין'); return }
    await saveTiebreakerAnswer(num)
    toast('✅ תשובת שובר שוויון נשמרה!')
  }

  return (
    <Card>
      <CardTitle>🎯 שאלת שובר שוויון</CardTitle>
      <p className="mb-4 text-sm text-[var(--text2)]">
        השאלה נענית פעם אחת לפני תחילת הפליי-אין. במקרה של תיקו בסוף הפלייאוף, מנצח המשתתף שתשובתו קרובה יותר לתשובה הנכונה.
      </p>

      <div className="space-y-3">
        <div>
          <Label>טקסט השאלה</Label>
          <Input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="לדוגמה: כמה נקודות יכניס סטפן קארי בכל הפלייאוף?"
          />
        </div>
        <Button onClick={handleSaveQuestion}>💾 שמור שאלה</Button>
      </div>

      <hr className="my-4 border-[var(--border)]" />

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
