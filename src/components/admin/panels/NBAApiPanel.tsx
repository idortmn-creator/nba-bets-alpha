import { useState } from 'react'
import { httpsCallable } from 'firebase/functions'
import { doc, updateDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { SelectNative } from '@/components/ui/select-native'
import { Separator } from '@/components/ui/separator'
import { functions, db } from '@/lib/firebase'
import { useGlobalStore } from '@/store/global.store'
import type { BracketMvpPick } from '@/bracket/bracketConstants'

const syncTeamsFn = httpsCallable(functions, 'syncTeams')
const syncResultsFn = httpsCallable(functions, 'syncResults')
const syncBracketFn = httpsCallable(functions, 'syncBracketData')

interface SyncResult {
  updated: string[]
  skipped: string[]
  resultsPayload?: Record<string, string>
  matchesFound?: string[]
  teamsPayload?: Record<string, Record<string, { home: string; away: string }>>
  totalPlayoffGamesScanned?: number
}

const STAGE_OPTIONS = [
  { value: '0',  label: 'פליי-אין סיבוב א (Stage 0)' },
  { value: '0b', label: 'פליי-אין גמר (Stage 0b)' },
  { value: '1',  label: 'סיבוב ראשון (Stage 1)' },
  { value: '2',  label: 'סיבוב שני (Stage 2)' },
  { value: '3',  label: 'גמר איזורי (Stage 3)' },
  { value: '4',  label: 'גמר NBA (Stage 4)' },
]

export default function NBAApiPanel() {
  const [season, setSeason] = useState(2025)
  const [stageKey, setStageKey] = useState<string>('1')
  const [loading, setLoading] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<{ action: string; data: SyncResult } | null>(null)

  // Actual MVP state — pre-populate from global store
  const existingMvp = useGlobalStore((s) => s.globalData.bracketActualMvp as BracketMvpPick | undefined) || {}
  const [mvpInputs, setMvpInputs] = useState<BracketMvpPick>({
    cf_east: existingMvp.cf_east || '',
    cf_west: existingMvp.cf_west || '',
    finals:  existingMvp.finals  || '',
  })

  async function handleSaveMvp() {
    setLoading('mvp')
    try {
      const payload: BracketMvpPick = {}
      if (mvpInputs.cf_east?.trim()) payload.cf_east = mvpInputs.cf_east.trim()
      if (mvpInputs.cf_west?.trim()) payload.cf_west = mvpInputs.cf_west.trim()
      if (mvpInputs.finals?.trim())  payload.finals  = mvpInputs.finals.trim()
      await updateDoc(doc(db, 'global', 'settings'), { bracketActualMvp: payload })
      toast('✅ MVP נשמר בהצלחה')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setLoading(null) }
  }

  function parseStageKey(v: string): number | string {
    return v === '0b' ? '0b' : parseInt(v)
  }

  async function handlePreview() {
    setLoading('preview')
    try {
      const res = await syncTeamsFn({ season, dryRun: true })
      const data = res.data as SyncResult & { teamsPayload: Record<string, unknown> }
      setLastResult({ action: 'preview', data: data as SyncResult })
      const count = data.matchesFound?.length ?? 0
      toast(count > 0 ? `✅ נמצאו ${count} סדרות` : '⚠️ לא נמצאו סדרות — עדכן את TEAM_CONF_SEED ב-teamMap.ts')
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setLoading(null) }
  }

  async function handleSyncTeams() {
    if (!confirm(`סנכרן קבוצות עונה ${season}? פעולה זו תכתוב קבוצות לכל הסדרות שנמצאו.`)) return
    setLoading('teams')
    try {
      const res = await syncTeamsFn({ season, dryRun: false })
      const data = res.data as SyncResult
      setLastResult({ action: 'syncTeams', data })
      toast(`✅ קבוצות עודכנו: ${data.matchesFound?.join(', ') || 'אין'}`)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setLoading(null) }
  }

  async function handleSyncResults() {
    setLoading('results')
    try {
      const res = await syncResultsFn({ season, stageKey: parseStageKey(stageKey), fullSync: true })
      const data = res.data as SyncResult
      setLastResult({ action: 'syncResults', data })
      if (data.updated.length > 0) {
        toast(`✅ תוצאות עודכנו: ${data.updated.join(', ')}`)
      } else {
        toast('⚠️ לא נמצאו סדרות שהסתיימו לשלב זה')
      }
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setLoading(null) }
  }

  async function handleSyncBracket() {
    setLoading('bracket')
    try {
      const res = await syncBracketFn({})
      const data = res.data as { ok: boolean; bracketSeries: Record<string, unknown> }
      const count = Object.keys(data.bracketSeries || {}).length
      toast(`✅ ברקט עודכן — ${count} סדרות`)
      setLastResult({ action: 'syncBracket', data: { updated: [], skipped: [] } })
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    } finally { setLoading(null) }
  }

  return (
    <Card>
      <CardTitle>🏀 NBA API Sync</CardTitle>

      {/* Setup note */}
      <div className="mb-4 rounded-lg border border-[rgba(79,195,247,0.3)] bg-[rgba(79,195,247,0.06)] p-3 text-xs leading-relaxed text-[var(--text2)]">
        <strong className="text-[var(--blue)]">הגדרה ראשונית נדרשת:</strong>
        <ol className="mt-1 list-decimal list-inside space-y-0.5">
          <li>עדכן את <code>functions/src/teamMap.ts</code> עם קבוצות הפלייאוף של העונה הנוכחית</li>
          <li>הרץ: <code>firebase functions:secrets:set RAPIDAPI_KEY</code></li>
          <li>פרוס את ה-Functions מחדש</li>
        </ol>
      </div>

      {/* Controls */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <div className="mb-1 text-xs text-[var(--text2)]">עונה (Season)</div>
          <input
            type="number"
            className="ts-inp w-24"
            value={season}
            onChange={(e) => setSeason(parseInt(e.target.value) || 2025)}
          />
        </div>
        <div>
          <div className="mb-1 text-xs text-[var(--text2)]">שלב לסנכרון תוצאות</div>
          <SelectNative
            value={stageKey}
            onChange={(e) => setStageKey(e.target.value)}
            className="!w-auto"
          >
            {STAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </SelectNative>
        </div>
      </div>

      <Separator />

      {/* Action buttons */}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePreview}
          disabled={!!loading}
          className="!bg-[rgba(79,195,247,0.1)] !border-[rgba(79,195,247,0.3)] !text-[var(--blue)]"
        >
          {loading === 'preview' ? '⏳' : '🔍'} תצוגה מקדימה
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSyncTeams}
          disabled={!!loading}
          className="!bg-[rgba(255,215,0,0.1)] !border-[rgba(255,215,0,0.3)] !text-[var(--gold)]"
        >
          {loading === 'teams' ? '⏳' : '🏀'} סנכרן קבוצות
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSyncResults}
          disabled={!!loading}
        >
          {loading === 'results' ? '⏳' : '📊'} סנכרן תוצאות
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSyncBracket}
          disabled={!!loading}
          className="!bg-[rgba(168,85,247,0.1)] !border-[rgba(168,85,247,0.3)] !text-[var(--purple,#a855f7)]"
        >
          {loading === 'bracket' ? '⏳' : '🏆'} סנכרן ברקט
        </Button>
      </div>

      {/* Result display */}
      {lastResult && (
        <div className="mt-4">
          <Separator />
          <div className="mt-3 text-xs font-bold text-[var(--text2)] mb-2">
            {lastResult.action === 'preview' ? '🔍 תצוגה מקדימה' :
             lastResult.action === 'syncTeams' ? '🏀 קבוצות שסונכרנו' :
             '📊 תוצאות שסונכרנו'}
          </div>

          {lastResult.action === 'preview' && lastResult.data.teamsPayload && (
            <div className="space-y-1">
              {Object.entries(lastResult.data.teamsPayload).map(([stage, teams]) => (
                <div key={stage}>
                  <div className="text-xs font-bold text-[var(--orange)] mb-0.5">{stage}</div>
                  {Object.entries(teams).map(([mk, t]) => (
                    <div key={mk} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="w-8 font-mono text-[var(--blue)]">{mk}</span>
                      <span>{t.home}</span>
                      <span className="text-[var(--text2)]">מול</span>
                      <span>{t.away}</span>
                    </div>
                  ))}
                </div>
              ))}
              {(lastResult.data.matchesFound?.length ?? 0) === 0 && (
                <div className="text-xs text-[var(--text2)]">לא נמצאו תאמות — עדכן את TEAM_CONF_SEED</div>
              )}
            </div>
          )}

          {lastResult.action === 'syncResults' && (
            <div>
              {lastResult.data.updated.length > 0 && (
                <div className="mb-2">
                  <div className="text-xs text-[var(--green)] mb-1">עודכנו:</div>
                  {Object.entries(lastResult.data.resultsPayload ?? {})
                    .filter(([k]) => k.endsWith('_winner') || (!k.includes('_winner') && !k.includes('_result')))
                    .map(([k, v]) => (
                      <div key={k} className="text-xs flex gap-2">
                        <span className="font-mono text-[var(--blue)]">{k.replace('_winner', '')}</span>
                        <span className="text-[var(--green)]">{v}</span>
                        {lastResult.data.resultsPayload?.[k.replace('_winner', '_result')] && (
                          <span className="text-[var(--text2)]">
                            ({lastResult.data.resultsPayload[k.replace('_winner', '_result')]})
                          </span>
                        )}
                      </div>
                    ))}
                </div>
              )}
              {lastResult.data.skipped.length > 0 && (
                <div className="text-xs text-[var(--text2)]">
                  לא הושלמו: {lastResult.data.skipped.join(', ')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scheduled sync note */}
      <div className="mt-4 rounded-lg bg-[var(--dark3)] p-2 text-xs text-[var(--text2)]">
        ⏰ סנכרון אוטומטי פועל <strong>כל שעה</strong> — קבוצות ותוצאות מתרעננות מהAPI באופן אוטומטי (כל עוד השלב הנוכחי לא נעול)
      </div>

      <Separator />

      {/* Actual MVP entry */}
      <div className="mt-4">
        <div className="mb-3 font-bold text-[var(--gold)]">🏆 הגדרת MVP בפועל (לניקוד ברקט)</div>
        <div className="space-y-2">
          {([
            { key: 'cf_east', label: 'MVP גמר מזרח (2 נק\')' },
            { key: 'cf_west', label: 'MVP גמר מערב (2 נק\')' },
            { key: 'finals',  label: 'MVP גמר NBA (5 נק\')' },
          ] as { key: keyof BracketMvpPick; label: string }[]).map(({ key, label }) => (
            <div key={key} className="flex items-center gap-3">
              <label className="w-44 text-xs text-[var(--text2)] shrink-0">{label}</label>
              <input
                type="text"
                className="ts-inp flex-1"
                placeholder="שם השחקן באנגלית..."
                value={mvpInputs[key] || ''}
                onChange={(e) => setMvpInputs((prev) => ({ ...prev, [key]: e.target.value }))}
              />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <Button
            size="sm"
            onClick={handleSaveMvp}
            disabled={!!loading}
            className="!bg-[rgba(255,215,0,0.1)] !border-[rgba(255,215,0,0.3)] !text-[var(--gold)]"
          >
            {loading === 'mvp' ? '⏳' : '💾'} שמור MVP
          </Button>
        </div>
      </div>
    </Card>
  )
}
