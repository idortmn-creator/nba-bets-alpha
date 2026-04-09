import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SelectNative } from '@/components/ui/select-native'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { saveResults, resetStageResults, savePreBetResults } from '@/services/global.service'
import { STAGE_MATCHES, GAPS } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

export default function ResultsPanel() {
  const { globalData, getGlobal, getTeams, getPlayinFinalTeams, getBonusBets, getBonusResults } = useGlobalHelpers()
  const [selectedStage, setSelectedStage] = useState<string>('0')
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStage, globalData])

  function setR(key: string, val: string) { setResults((p) => ({ ...p, [key]: val })) }

  async function handleSave() {
    const resultToSave = Object.keys(results).length > 0 ? results : null
    await saveResults(si, resultToSave, bonuses, bonusResultsState, globalData)
    if (si === 4) {
      const r1update: Record<string, string> = {}
      if (results.champion) r1update.champion = results.champion
      if (results.east_champ) r1update.east_champ = results.east_champ
      if (results.west_champ) r1update.west_champ = results.west_champ
      if (Object.keys(r1update).length) await savePreBetResults(r1update, globalData)
    }
    toast('✅ תוצאות נשמרו!')
  }

  async function handleReset() {
    if (!confirm('אפס את כל תוצאות השלב? פעולה זו בלתי הפיכה.')) return
    await resetStageResults(si)
    toast('🗑️ תוצאות השלב אופסו')
  }

  return (
    <Card>
      <CardTitle>📊 הזן תוצאות</CardTitle>
      <SelectNative value={selectedStage} onChange={(e) => setSelectedStage(e.target.value)} className="!w-auto mb-3">
        <option value="0">פליי-אין סיבוב א</option>
        <option value="0b">פליי-אין גמר</option>
        <option value="1">סיבוב ראשון</option>
        <option value="2">סיבוב שני</option>
        <option value="3">גמר איזורי</option>
        <option value="4">גמר NBA</option>
      </SelectNative>

      {(si === 0 || si === '0b') ? matches.map((m) => {
        let opts: string[]
        if (si === '0b') { const ft = getPlayinFinalTeams(m.conf); opts = [ft.home, ft.away].filter(Boolean) }
        else { const t = getTeams(si, m.key); opts = [t.home || 'קבוצה 1', t.away || 'קבוצה 2'] }
        return (
          <div key={m.key} className="mb-2"><Label>🏀 {m.label}</Label>
            <SelectNative value={results[m.key] || ''} onChange={(e) => setR(m.key, e.target.value)}>
              <option value="">בחר מנצחת...</option>
              {opts.map((o) => <option key={o} value={o}>{o}</option>)}
            </SelectNative>
          </div>
        )
      }) : (
        <>
          {matches.map((m) => {
            const t = getTeams(si, m.key), home = t.home || 'ביתית', away = t.away || 'אורחת'
            const allOpts = [...GAPS.map((r) => ({ w: home, r, l: `${home} ${r}` })), ...GAPS.map((r) => ({ w: away, r, l: `${away} ${r}` }))]
            const curV = results[m.key + '_winner'] && results[m.key + '_result'] ? `${results[m.key + '_winner']}|${results[m.key + '_result']}` : ''
            return (
              <div key={m.key} className="mb-2">
                <Label>🏀 {home && away ? `${home} מול ${away}` : m.label}</Label>
                <SelectNative value={curV} onChange={(e) => {
                  const p = e.target.value.split('|')
                  setR(m.key + '_winner', p[0]); if (p[1]) setR(m.key + '_result', p[1])
                }}>
                  <option value="">בחר תוצאה...</option>
                  {allOpts.map((o) => <option key={`${o.w}|${o.r}`} value={`${o.w}|${o.r}`}>{o.l}</option>)}
                </SelectNative>
                {m.hasMvp && <div className="mt-1"><Label>🏅 MVP</Label><Input value={results[m.key + '_mvp'] || ''} onChange={(e) => setR(m.key + '_mvp', e.target.value)} placeholder="שם שחקן..." /></div>}
              </div>
            )
          })}
          {si === 4 && (
            <>
              <Separator />
              <div className="mb-2 font-bold text-[var(--orange)]">🏆 תוצאות הימורי מראש</div>
              {['champion', 'east_champ', 'west_champ'].map((key) => (
                <div key={key} className="mb-2"><Label>{key === 'champion' ? '🏆 אלוף NBA' : key === 'east_champ' ? '🔵 אלופת המזרח' : '🔴 אלופת המערב'}</Label>
                  <Input value={results[key] || ''} onChange={(e) => setR(key, e.target.value)} placeholder="שם קבוצה..." />
                </div>
              ))}
            </>
          )}
        </>
      )}

      {bonuses.length > 0 && (
        <>
          <Separator />
          <div className="mb-2 font-bold text-[var(--gold)]">⭐ תוצאות הימורי בונוס</div>
          {bonuses.map((b) => (
            <div key={b.id} className="mb-2"><Label>{b.question} ({b.points} נק')</Label>
              <SelectNative value={bonusResultsState[b.id] || ''} onChange={(e) => setBonusResultsState((p) => ({ ...p, [b.id]: e.target.value }))}>
                <option value="">בחר תשובה נכונה...</option>
                {(b.answers || []).map((a) => <option key={a} value={a}>{a}</option>)}
              </SelectNative>
            </div>
          ))}
        </>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={handleSave}>💾 שמור תוצאות</Button>
        <Button variant="destructive" size="sm" onClick={handleReset}>🗑️ אפס תוצאות שלב</Button>
      </div>
    </Card>
  )
}
