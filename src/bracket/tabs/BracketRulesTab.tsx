import { Card, CardTitle } from '@/components/ui/card'

const ROUNDS = [
  { label: 'סיבוב ראשון',       winner: 1,  exact: 2  },
  { label: 'חצי גמר קונפרנס',   winner: 2,  exact: 4  },
  { label: 'גמר קונפרנס',       winner: 4,  exact: 8  },
  { label: 'גמר NBA',           winner: 8,  exact: 16 },
]

const MVP_ROWS = [
  { label: 'MVP גמר מזרח',  pts: 2 },
  { label: 'MVP גמר מערב',  pts: 2 },
  { label: 'MVP גמר NBA',   pts: 5 },
]

export default function BracketRulesTab() {
  return (
    <Card>
      <CardTitle>📖 שיטת הניקוד — ברקט</CardTitle>

      {/* Series scoring table */}
      <div className="mb-4">
        <div className="mb-2 font-bold text-[var(--orange)]">🏀 ניקוד לפי סדרה</div>
        <div className="overflow-x-auto">
          <table className="rules-table">
            <thead>
              <tr>
                <th>שלב</th>
                <th>מנצחת נכונה</th>
                <th>תוצאה מדויקת</th>
              </tr>
            </thead>
            <tbody>
              {ROUNDS.map((r) => (
                <tr key={r.label}>
                  <td>{r.label}</td>
                  <td className="rules-pts">{r.winner} נק'</td>
                  <td className="rules-pts rules-exact">{r.exact} נק'</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-[var(--text2)]">
          "תוצאה מדויקת" = ניחשת גם את המנצחת וגם את מספר המשחקים המדויק בסדרה.
          ניחוש מדויק מחליף את ניחוש המנצחת (לא מצטבר).
        </p>
      </div>

      {/* MVP scoring */}
      <div className="mb-4">
        <div className="mb-2 font-bold text-[var(--gold)]">🏆 ניקוד MVP לסדרה</div>
        <div className="space-y-1.5">
          {MVP_ROWS.map((m) => (
            <div key={m.label} className="rules-mvp-row">
              <span className="rules-mvp-label">{m.label}</span>
              <span className="rules-pts">{m.pts} נק'</span>
            </div>
          ))}
        </div>
      </div>

      {/* Max total */}
      <div className="mb-4 rounded-lg border border-[rgba(255,215,0,0.25)] bg-[rgba(255,215,0,0.06)] p-3 text-xs">
        <div className="mb-1 font-bold text-[var(--gold)]">💯 ניקוד מקסימלי אפשרי</div>
        <div className="text-[var(--text2)] space-y-0.5">
          <div>סיבוב ראשון: 8 סדרות × 2 = <strong className="text-[var(--text1)]">16 נק'</strong></div>
          <div>חצי גמר קונפרנס: 4 סדרות × 4 = <strong className="text-[var(--text1)]">16 נק'</strong></div>
          <div>גמר קונפרנס: 2 סדרות × 8 = <strong className="text-[var(--text1)]">16 נק'</strong></div>
          <div>גמר NBA: 1 סדרה × 16 = <strong className="text-[var(--text1)]">16 נק'</strong></div>
          <div>MVP: 2 + 2 + 5 = <strong className="text-[var(--text1)]">9 נק'</strong></div>
          <div className="mt-1.5 border-t border-[rgba(255,255,255,0.1)] pt-1.5 font-bold text-[var(--orange)]">
            סה"כ מקסימום: 73 נקודות
          </div>
        </div>
      </div>

      {/* How to fill */}
      <div>
        <div className="mb-1 font-bold text-[var(--blue)]">📊 הזנת הברקט</div>
        <ul className="list-inside list-disc space-y-1 text-xs text-[var(--text2)]">
          <li>לחצו על + ו‑− ליד כל קבוצה לקביעת מספר הניצחונות</li>
          <li>הקבוצה שמגיעה ל‑4 ניצחונות מתקדמת אוטומטית לסיבוב הבא</li>
          <li>מקסימום 7 משחקים לסדרה ו‑4 ניצחונות לקבוצה</li>
          <li>שינוי ניבוי מנצחת מוחק אוטומטית את כל הסיבובים הבאים</li>
          <li>הברקט ננעל עם תחילת הפלייאוף — לא ניתן לשנות לאחר מכן</li>
        </ul>
      </div>
    </Card>
  )
}
