import { Card, CardTitle } from '@/components/ui/card'

export default function RulesTab() {
  return (
    <div>
      <Card>
        <CardTitle>📖 פורמט הניקוד</CardTitle>
        <div className="space-y-4 text-sm">
          <Section title="פליי-אין (שלבים 0, 0b)" items={[
            'ניחוש מנצחת = 1 נק׳ למשחק',
            'כל 3 מנצחות מזרח = +1 בונוס',
            'כל 3 מנצחות מערב = +1 בונוס',
            'כל 6 המשחקים נכונים = +1 בונוס',
          ]} />
          <Section title="סיבוב ראשון (שלב 1)" items={[
            'ניחוש מנצחת = 2 נק׳',
            'מנצחת + תוצאה מדויקת = 4 נק׳',
            'כל 4 מנצחות מזרח = +3 / +6 מדויק',
            'כל 4 מנצחות מערב = +3 / +6 מדויק',
            'כל 8 מנצחות = +7 / +14 מדויק',
            'אלוף NBA נכון = +10 נק׳',
            'אלופת מזרח/מערב נכונה = +3 כל אחת',
            'שתי האלופות נכונות = +3 נוסף',
          ]} />
          <Section title="סיבוב שני (שלב 2)" items={[
            'ניחוש מנצחת = 3 נק׳',
            'מנצחת + תוצאה מדויקת = 6 נק׳',
            'כל 2 מנצחות מזרח = +3 / +6 מדויק',
            'כל 2 מנצחות מערב = +3 / +6 מדויק',
            'כל 4 מנצחות = +7 / +14 מדויק',
          ]} />
          <Section title="גמר איזורי (שלב 3)" items={[
            'ניחוש מנצחת = 4 נק׳',
            'מנצחת + תוצאה מדויקת = 8 נק׳',
            'MVP נכון = +1 נק׳',
            'שתי המנצחות = +3 / +6 מדויק',
          ]} />
          <Section title="גמר NBA (שלב 4)" items={[
            'ניחוש מנצחת = 5 נק׳',
            'מנצחת + תוצאה מדויקת = 10 נק׳',
            'MVP נכון = +2 נק׳',
          ]} />
          <Section title="הימורי בונוס" items={[
            'שאלות בונוס עם ניקוד מותאם אישית',
          ]} />
        </div>
      </Card>
    </div>
  )
}

function Section({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="mb-1 font-bold text-[var(--orange)]">{title}</div>
      <ul className="list-inside list-disc space-y-0.5 text-[var(--text2)]">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  )
}
