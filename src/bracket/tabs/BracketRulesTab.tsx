import { Card, CardTitle } from '@/components/ui/card'

export default function BracketRulesTab() {
  return (
    <Card>
      <CardTitle>📖 שיטת הניקוד — ברקט</CardTitle>
      <div className="rounded-lg border border-[rgba(255,215,0,0.25)] bg-[rgba(255,215,0,0.06)] p-4 text-center text-sm text-[var(--gold)]">
        <div className="mb-2 text-2xl">🏗️</div>
        <div className="font-bold">שיטת הניקוד תפורסם בקרוב</div>
        <div className="mt-1 text-xs text-[var(--text2)]">הנוסחה המלאה תוכרז לפני תחילת הפלייאוף</div>
      </div>
      <div className="mt-4 space-y-3 text-sm">
        <div>
          <div className="mb-1 font-bold text-[var(--orange)]">🎯 עקרונות כלליים</div>
          <ul className="list-inside list-disc space-y-1 text-[var(--text2)]">
            <li>ניחוש הברקט כולו לפני תחילת הפלייאוף — ללא שינויים אחר כך</li>
            <li>ניחוש מנצחת כל סדרה + תוצאה מדויקת (מספר המשחקים)</li>
            <li>ניחוש נכון בשלבים מאוחרים שווה יותר נקודות</li>
            <li>בונוס על ניחוש מושלם של כנס שלם</li>
          </ul>
        </div>
        <div>
          <div className="mb-1 font-bold text-[var(--blue)]">📊 הזנת הברקט</div>
          <ul className="list-inside list-disc space-y-1 text-[var(--text2)]">
            <li>לחצו על + ו‑− ליד כל קבוצה לקביעת מספר הניצחונות</li>
            <li>הקבוצה שמגיעה ל‑4 ניצחונות מתקדמת אוטומטית לסיבוב הבא</li>
            <li>מקסימום 7 משחקים לסדרה ו‑4 ניצחונות לקבוצה</li>
          </ul>
        </div>
      </div>
    </Card>
  )
}
