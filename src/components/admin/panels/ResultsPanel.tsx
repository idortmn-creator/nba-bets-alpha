import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Loader2, CheckCircle } from 'lucide-react'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { saveResults, resetStageResults, savePreBetResults } from '@/services/global.service'
import { STAGE_MATCHES, GAPS, STAGE_SHORT, STAGE_KEYS } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

const STAGE_VALUES = ['0', '0b', '1', '2', '3', '4']

export default function ResultsPanel() {
  const { globalData, getGlobal, getTeams, getPlayinFinalTeams, getBonusBets, getBonusResults } = useGlobalHelpers()
  const [selectedStage, setSelectedStage] = useState<string>('0')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const si: StageKey = selectedStage === '0b' ? '0b' : (parseInt(selectedStage) as StageKey)
  const matches = STAGE_MATCHES[si] || []
  const [results, setResults] = useState<Record<string, string>>({})
  const [bonusResultsState, setBonusResultsState] = useState<Record<string, string>>({})

  const existingResult = (getGlobal('results', {} as Record<string, Record<string, string> | null>))['stage' + si] || {}
  const bonuses = getBonusBets(si)
  const existingBonusRes = getBonusResults(si)

  useEffect(() => {
    setResults({ ...(existingResult as Record<string, string>) })
    setBonusResultsState({ ...existingBonusRes })
    setSaved(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage, globalData])

  function setR(key: string, val: string) {
    setResults((p) => ({ ...p, [key]: val }))
    setSaved(false)
  }

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    try {
      const resultToSave = Object.keys(results).length > 0 ? results : null
      await saveResults(si, resultToSave, bonuses, bonusResultsState, globalData)
      if (si === 4) {
        const r1update: Record<string, string> = {}
        if (results.champion)   r1update.champion   = results.champion
        if (results.east_champ) r1update.east_champ = results.east_champ
        if (results.west_champ) r1update.west_champ = results.west_champ
        if (Object.keys(r1update).length) await savePreBetResults(r1update, globalData)
      }
      setSaved(true)
      toast('✅ תוצאות אושרו!')
      setTimeout(() => setSaved(false), 3000)
    } finally {
      setSaving(false)
    }
  }

  async function handleReset() {
    if (!confirm('אפס את כל תוצאות השלב? פעולה זו בלתי הפיכה.')) return
    await resetStageResults(si)
    toast('🗑️ תוצאות השלב אופסו')
  }

  return (
    <Card>
      <CardTitle>📊 הזן תוצאות</CardTitle>

      {/* Stage tab bar */}
      <div className="mb-4 flex gap-1.5 overflow-x-auto pb-1">
        {STAGE_VALUES.map((v, i) => (
          <button
            key={v}
            onClick={() => setSelectedStage(v)}
            className={`stage-tab shrink-0 ${selectedStage === v ? 'active' : ''}`}
          >
            {STAGE_SHORT[i]}
          </button>
        ))}
      </div>

      {/* Play-In single-game matches — winner only */}
      {(si === 0 || si === '0b') && matches.map((m) => {
        let opts: string[]
        if (si === '0b') {
          const ft = getPlayinFinalTeams(m.conf)
          opts = [ft.home, ft.away].filter(Boolean)
        } else {
          const t = getTeams(si, m.key)
          opts = [t.home || 'קבוצה 1', t.away || 'קבוצה 2']
        }
        const winner = results[m.key] || ''
        return (
          <div key={m.key} className="mb-3 rounded-lg border border-[var(--card-border)] bg-[var(--dark3)] p-3">
            <div className="mb-2 text-xs font-bold text-[var(--text2)]">🏀 {m.label}</div>
            <div className="flex gap-2">
              {opts.map((o) => (
                <button
                  key={o}
                  onClick={() => setR(m.key, o)}
                  className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-all ${
                    winner === o
                      ? 'border-[var(--orange)] bg-[var(--orange)]/15 text-[var(--orange)]'
                      : 'border-[var(--card-border)] text-[var(--text1)] hover:border-[var(--orange-border)]'
                  }`}
                >
                  {o}
                </button>
              ))}
            </div>
          </div>
        )
      })}

      {/* Series matches — winner + result gap */}
      {si !== 0 && si !== '0b' && (
        <>
          {matches.map((m) => {
            const t = getTeams(si, m.key)
            const home = t.home || 'ביתית'
            const away = t.away || 'אורחת'
            const winnerVal = results[m.key + '_winner'] || ''
            const gapVal    = results[m.key + '_result'] || ''

            return (
              <div key={m.key} className="mb-3 rounded-lg border border-[var(--card-border)] bg-[var(--dark3)] p-3">
                <div className="mb-2 text-xs font-bold text-[var(--text2)]">
                  🏀 {home && away ? `${home} מול ${away}` : m.label}
                </div>

                {/* Winner buttons */}
                <div className="mb-2 flex gap-2">
                  {[home, away].map((team) => (
                    <button
                      key={team}
                      onClick={() => setR(m.key + '_winner', team)}
                      className={`flex-1 rounded-lg border py-2 text-sm font-bold transition-all ${
                        winnerVal === team
                          ? 'border-[var(--orange)] bg-[var(--orange)]/15 text-[var(--orange)]'
                          : 'border-[var(--card-border)] text-[var(--text1)] hover:border-[var(--orange-border)]'
                      }`}
                    >
                      {team}
                    </button>
                  ))}
                </div>

                {/* Result gap — only visible after winner is selected */}
                {winnerVal && (
                  <div className="flex flex-wrap gap-1.5">
                    {GAPS.map((gap) => (
                      <button
                        key={gap}
                        onClick={() => setR(m.key + '_result', gap)}
                        className={`rounded-md border px-3 py-1 text-xs transition-all ${
                          gapVal === gap
                            ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold)]'
                            : 'border-[var(--card-border)] text-[var(--text2)] hover:border-[var(--orange-border)]'
                        }`}
                      >
                        {gap}
                      </button>
                    ))}
                  </div>
                )}

                {/* MVP */}
                {m.hasMvp && (
                  <div className="mt-2">
                    <Label>🏅 MVP</Label>
                    <Input
                      value={results[m.key + '_mvp'] || ''}
                      onChange={(e) => setR(m.key + '_mvp', e.target.value)}
                      placeholder="שם שחקן..."
                    />
                  </div>
                )}
              </div>
            )
          })}

          {/* Pre-bet results (champion / conf champs) — only on Finals stage */}
          {si === 4 && (
            <>
              <Separator />
              <div className="mb-2 mt-3 font-bold text-[var(--orange)]">🏆 תוצאות הימורי מראש</div>
              {(['champion', 'east_champ', 'west_champ'] as const).map((key) => (
                <div key={key} className="mb-2">
                  <Label>
                    {key === 'champion' ? '🏆 אלוף NBA' : key === 'east_champ' ? '🔵 אלופת המזרח' : '🔴 אלופת המערב'}
                  </Label>
                  <Input
                    value={results[key] || ''}
                    onChange={(e) => setR(key, e.target.value)}
                    placeholder="שם קבוצה..."
                  />
                </div>
              ))}
            </>
          )}
        </>
      )}

      {/* Bonus bet results */}
      {bonuses.length > 0 && (
        <>
          <Separator />
          <div className="mb-2 mt-3 font-bold text-[var(--gold)]">⭐ תוצאות הימורי בונוס</div>
          {bonuses.map((b) => (
            <div key={b.id} className="mb-3 rounded-lg border border-[var(--card-border)] bg-[var(--dark3)] p-3">
              <div className="mb-2 text-xs font-bold text-[var(--text2)]">
                {b.question}{' '}
                <span className="text-[var(--gold)]">({b.points} נק')</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {(b.answers || []).map((a) => (
                  <button
                    key={a}
                    onClick={() => {
                      setBonusResultsState((p) => ({ ...p, [b.id]: a }))
                      setSaved(false)
                    }}
                    className={`rounded-md border px-3 py-1 text-xs transition-all ${
                      bonusResultsState[b.id] === a
                        ? 'border-[var(--gold)] bg-[var(--gold)]/15 text-[var(--gold)]'
                        : 'border-[var(--card-border)] text-[var(--text2)] hover:border-[var(--orange-border)]'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          onClick={handleSave}
          disabled={saving}
          className={`flex items-center gap-2 border px-4 transition-all ${
            saved
              ? '!border-[var(--green)] !bg-[var(--green)]/15 !text-[var(--green)]'
              : '!border-[var(--orange)] !bg-[var(--orange)]/15 !text-[var(--orange)]'
          }`}
        >
          {saving ? (
            <Loader2 size={14} className="animate-spin" />
          ) : saved ? (
            <CheckCircle size={14} />
          ) : null}
          {saving ? 'שומר...' : saved ? 'אושר!' : '✅ אשר תוצאות'}
        </Button>
        <Button variant="destructive" size="sm" onClick={handleReset}>
          🗑️ אפס תוצאות שלב
        </Button>
      </div>
    </Card>
  )
}
