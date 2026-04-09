import { useState } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { fetchESPNScores } from '@/services/global.service'

interface ESPNGame {
  winner: string
  homeName: string
  awayName: string
  homeScore: number
  awayScore: number
  seriesNote: string
}

export default function ESPNPanel() {
  const [date, setDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [games, setGames] = useState<ESPNGame[]>([])
  const [loading, setLoading] = useState(false)

  async function handleFetch() {
    setLoading(true)
    try {
      const events = await fetchESPNScores(date.replace(/-/g, ''))
      if (!events.length) { setGames([]); toast('אין משחקים שהסתיימו בתאריך זה'); setLoading(false); return }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const parsed: ESPNGame[] = events.map((e: any) => {
        const comp = e.competitions?.[0]
        if (!comp) return null
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const home = comp.competitors?.find((t: any) => t.homeAway === 'home')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const away = comp.competitors?.find((t: any) => t.homeAway === 'away')
        if (!home || !away) return null
        const homeName = home.team?.displayName || home.team?.name || ''
        const awayName = away.team?.displayName || away.team?.name || ''
        const homeScore = parseInt(home.score) || 0
        const awayScore = parseInt(away.score) || 0
        const winner = homeScore > awayScore ? homeName : awayName
        const seriesNote = comp.series ? `סדרה: ${comp.series.summary || ''}` : comp.notes?.[0]?.headline || ''
        return { winner, homeName, awayName, homeScore, awayScore, seriesNote }
      }).filter(Boolean)
      setGames(parsed)
    } catch (e: unknown) {
      toast('❌ שגיאה: ' + (e instanceof Error ? e.message : String(e)))
    } finally { setLoading(false) }
  }

  return (
    <Card>
      <CardTitle>📡 תוצאות NBA חיות</CardTitle>
      <div className="mb-2 text-xs text-[var(--text2)]">שלוף תוצאות ממשחקים שהסתיימו ולחץ להחיל</div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="!w-auto" />
        <Button variant="secondary" size="sm" onClick={handleFetch} disabled={loading} className="!bg-[rgba(79,195,247,0.1)] !border-[rgba(79,195,247,0.3)] !text-[var(--blue)]">
          {loading ? '⏳' : '📡'} שלוף תוצאות
        </Button>
      </div>
      {games.length > 0 ? games.map((g, i) => (
        <div key={i} className="mb-2 rounded-lg bg-[var(--dark3)] p-3">
          <div className="mb-1 flex items-center justify-between"><span className="text-xs text-[var(--text2)]">{g.seriesNote}</span><span className="text-[0.7rem] text-[var(--green)]">✅ הסתיים</span></div>
          <div className="mb-1 text-sm font-bold">🏆 <span className="text-[var(--green)]">{g.winner}</span> ניצחה</div>
          <div className="text-xs text-[var(--text2)]">{g.homeName} {g.homeScore} — {g.awayName} {g.awayScore}</div>
        </div>
      )) : <div className="text-xs text-[var(--text2)]">בחר תאריך ולחץ שלוף</div>}
    </Card>
  )
}
