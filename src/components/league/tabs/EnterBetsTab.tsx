import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Card, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SelectNative } from '@/components/ui/select-native'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { useLeagueStore } from '@/store/league.store'
import { useAuthStore } from '@/store/auth.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { saveBet, clearBet } from '@/services/global.service'
import { STAGE_MATCHES, STAGE_KEYS, GAPS, PREBETS } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'

export default function EnterBetsTab() {
  const leagueData = useLeagueStore((s) => s.currentLeagueData)
  const currentUser = useAuthStore((s) => s.currentUser)
  const { getGlobal, canBetOnStage, isSeriesLocked, isBonusLocked, isSingleBonusLocked, getTeams, teamLabel, getPlayinFinalTeams, getBonusBets, isPreBetsLocked } = useGlobalHelpers()
  const tiebreakerQuestion = getGlobal('tiebreakerQuestion', '') as string
  const [stage, setStage] = useState<StageKey>(0)
  const [cbd, setCbd] = useState<Record<string, string>>({})

  const stageIdx = STAGE_KEYS.indexOf(stage)
  const locked = (getGlobal('stageLocked', [] as boolean[]))[stageIdx] || false
  const matches = STAGE_MATCHES[stage] || []

  // Load existing bets when stage changes
  useEffect(() => {
    if (!leagueData || !currentUser) return
    const existing = ((leagueData.bets || {})[currentUser.uid] || {})['stage' + stage] || {}
    setCbd({ ...existing })
  }, [stage, leagueData, currentUser])

  function pick(key: string, val: string) { setCbd((p) => ({ ...p, [key]: val })) }

  async function handleSave() {
    if (!leagueData || !currentUser) return
    try {
      await saveBet(leagueData.id, currentUser.uid, stage, cbd)
      toast('✅ הימורים נשמרו!')
    } catch (e: unknown) { toast('❌ שגיאה: ' + (e instanceof Error ? e.message : String(e))) }
  }

  async function handleClear() {
    if (!leagueData || !currentUser) return
    setCbd({})
    await clearBet(leagueData.id, currentUser.uid, stage)
    toast('✅ הימורים נוקו!')
  }

  function autoFill() {
    const newCbd = { ...cbd }
    if (stage === 0 || stage === '0b') {
      for (const m of matches) {
        const t = getTeams(stage, m.key)
        const teams = [t.home, t.away].filter(Boolean)
        if (teams.length) newCbd[m.key] = teams[Math.floor(Math.random() * teams.length)]
      }
    } else {
      for (const m of matches) {
        if (isSeriesLocked(stage, m.key)) continue
        const t = getTeams(stage, m.key)
        const teams = [t.home, t.away].filter(Boolean)
        if (teams.length) {
          newCbd[m.key + '_winner'] = teams[Math.floor(Math.random() * teams.length)]
          newCbd[m.key + '_result'] = GAPS[Math.floor(Math.random() * GAPS.length)]
        }
      }
      if (stage === 1 && !isPreBetsLocked()) {
        const eastT: string[] = [], westT: string[] = []
        for (const m of STAGE_MATCHES[1]) {
          const t = getTeams(1, m.key)
          if (m.conf === 'east') { if (t.home) eastT.push(t.home); if (t.away) eastT.push(t.away) }
          else { if (t.home) westT.push(t.home); if (t.away) westT.push(t.away) }
        }
        const allT = [...eastT, ...westT]
        if (allT.length) {
          newCbd['champion'] = allT[Math.floor(Math.random() * allT.length)]
          if (eastT.length) newCbd['east_champ'] = eastT[Math.floor(Math.random() * eastT.length)]
          if (westT.length) newCbd['west_champ'] = westT[Math.floor(Math.random() * westT.length)]
        }
      }
    }
    const bonuses = getBonusBets(stage).filter((b) => !isSingleBonusLocked(stage, b))
    for (const b of bonuses) {
      if (b.answers?.length) newCbd['bonus_' + b.id] = b.answers[Math.floor(Math.random() * b.answers.length)]
    }
    setCbd(newCbd)
    toast('🎲 מילוי אוטומטי הושלם')
  }

  const stageOptions: { value: string; label: string }[] = [
    { value: '0', label: 'פליי-אין סיבוב א (4 משחקים)' },
    { value: '0b', label: 'פליי-אין גמר (2 משחקים)' },
    { value: '1', label: 'סיבוב ראשון' },
    { value: '2', label: 'סיבוב שני' },
    { value: '3', label: 'גמר איזורי' },
    { value: '4', label: 'גמר NBA' },
  ]

  return (
    <Card>
      <div className="mb-3 rounded-lg border border-[var(--orange-border)] bg-[var(--dark3)] p-3 text-xs font-semibold"><strong>📌</strong> בחר שלב ולחץ על ההימורים שלך.</div>
      <div className="mb-4">
        <Label>שלב</Label>
        <SelectNative value={String(stage)} onChange={(e) => setStage(e.target.value === '0b' ? '0b' : (parseInt(e.target.value) as StageKey))}>
          {stageOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </SelectNative>
      </div>

      {locked ? (
        <LockedView stage={stage} cbd={cbd} matches={matches} teamLabel={teamLabel} tiebreakerQuestion={tiebreakerQuestion} />
      ) : !canBetOnStage(stage) ? (
        <div className="text-sm text-[var(--text2)]">⏳ ניתן להמר רק לאחר הזנת תוצאות השלב הקודם</div>
      ) : (
        <>
          <Separator />
          {(stage === 0 || stage === '0b') ? (
            <PlayinForm stage={stage} matches={matches} cbd={cbd} pick={pick} getTeams={getTeams} getPlayinFinalTeams={getPlayinFinalTeams} />
          ) : (
            <SeriesForm stage={stage} matches={matches} cbd={cbd} pick={pick} getTeams={getTeams} isSeriesLocked={isSeriesLocked} />
          )}

          {stage === 0 && tiebreakerQuestion && (
            <>
              <Separator />
              <TiebreakerForm question={tiebreakerQuestion} value={cbd['tiebreaker'] || ''} onChange={(v) => pick('tiebreaker', v)} />
            </>
          )}

          {stage === 1 && !isPreBetsLocked() && <PreBetsForm stage={stage} cbd={cbd} pick={pick} getTeams={getTeams} />}

          <BonusBetsForm stage={stage} cbd={cbd} pick={pick} getBonusBets={getBonusBets} isBonusLocked={isBonusLocked} isSingleBonusLocked={isSingleBonusLocked} />

          <div className="mt-4 flex flex-wrap gap-2">
            <Button onClick={handleSave}>💾 שמור הימורים</Button>
            <Button variant="secondary" size="sm" onClick={autoFill} className="!bg-[rgba(255,215,0,0.1)] !border-[rgba(255,215,0,0.3)] !text-[var(--gold)]">🎲 מילוי אוטומטי</Button>
            <Button variant="secondary" size="sm" onClick={handleClear}>🔄 נקה ושמור</Button>
          </div>
        </>
      )}
    </Card>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function LockedView({ stage, cbd, matches, teamLabel, tiebreakerQuestion }: any) {
  if (Object.keys(cbd).length === 0) return <div className="rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/5 p-3 text-sm text-[var(--red)]">🔒 שלב זה נעול ולא הזנת הימורים</div>
  return (
    <div>
      <div className="mb-3 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/5 p-3 text-sm text-[var(--red)]">🔒 שלב זה נעול — ההימורים שלך:</div>
      {(stage === 0 || stage === '0b') ?
        matches.map((m: any) => <div key={m.key} className="bet-item"><span className="bet-label">{teamLabel(stage, m.key, m.label)}</span><span className="bet-value pending">{cbd[m.key] || '-'}</span></div>) :
        matches.map((m: any) => <div key={m.key} className="bet-item"><span className="bet-label">{teamLabel(stage, m.key, m.label)}</span><span className="bet-value pending">{cbd[m.key + '_winner'] || '-'} ({cbd[m.key + '_result'] || '-'})</span></div>)
      }
      {stage === 0 && tiebreakerQuestion && (
        <div className="bet-item mt-2 border-t border-[var(--border)] pt-2">
          <span className="bet-label text-[var(--gold)]">🎯 {tiebreakerQuestion}</span>
          <span className="bet-value pending">{cbd['tiebreaker'] || '-'}</span>
        </div>
      )}
    </div>
  )
}

function TiebreakerForm({ question, value, onChange }: { question: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="tiebreaker-card">
      <div className="tiebreaker-header">
        <span className="tiebreaker-icon">🎯</span>
        <span className="tiebreaker-title">שאלת שובר שוויון</span>
      </div>
      <p className="tiebreaker-q">{question}</p>
      <p className="tiebreaker-hint">תשובה מספרית — תשמש לשבירת שוויון בסוף הפלייאוף</p>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="הכנס מספר..."
        className="tiebreaker-input"
      />
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PlayinForm({ stage, matches, cbd, pick, getTeams, getPlayinFinalTeams }: any) {
  return (
    <div>
      <CardTitle>🎯 בחר מנצחת</CardTitle>
      {matches.map((m: any) => {
        let t1: string, t2: string
        if (stage === '0b') { const ft = getPlayinFinalTeams(m.conf); t1 = ft.home; t2 = ft.away }
        else { const t = getTeams(stage, m.key); t1 = t.home || 'קבוצה 1'; t2 = t.away || 'קבוצה 2' }
        return (
          <div key={m.key} className="playin-card">
            <div className="match-label">🏀 {t1 && t2 ? `${t1} מול ${t2}` : m.label}</div>
            <div className="team-btns">
              <button className={`team-btn ${cbd[m.key] === t1 ? 'selected' : ''}`} onClick={() => pick(m.key, t1)}>{t1}</button>
              <button className={`team-btn ${cbd[m.key] === t2 ? 'selected' : ''}`} onClick={() => pick(m.key, t2)}>{t2}</button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SeriesForm({ stage, matches, cbd, pick, getTeams, isSeriesLocked }: any) {
  return (
    <div>
      <CardTitle>🎯 בחר תוצאה</CardTitle>
      {matches.map((m: any) => {
        const t = getTeams(stage, m.key)
        const home = t.home || 'ביתית', away = t.away || 'אורחת'
        if (isSeriesLocked(stage, m.key)) {
          return <div key={m.key} className="matchup-bet-card opacity-50 pointer-events-none"><div className="match-label">🏀 {home} מול {away} 🔒</div><div className="p-2 text-center text-sm text-[var(--text2)]">סדרה זו ננעלה</div></div>
        }
        return (
          <div key={m.key} className="matchup-bet-card">
            <div className="match-label">🏀 {home && away ? `${home} מול ${away}` : m.label}</div>
            <div className="mt-2 flex gap-2.5">
              <div className="flex flex-1 flex-col gap-1 rounded-lg border border-[var(--blue)]/15 bg-[var(--blue)]/5 p-2">
                <div className="mb-0.5 text-center text-[0.7rem] font-bold text-[var(--blue)]">{home} 🏠</div>
                {GAPS.map((r) => <button key={r} className={`bet-opt ${cbd[m.key + '_winner'] === home && cbd[m.key + '_result'] === r ? 'sel-home' : ''}`} onClick={() => { pick(m.key + '_winner', home); pick(m.key + '_result', r) }}><span className="opt-res">{r}</span></button>)}
              </div>
              <div className="flex flex-1 flex-col gap-1 rounded-lg border border-[var(--orange)]/15 bg-[var(--orange)]/5 p-2">
                <div className="mb-0.5 text-center text-[0.7rem] font-bold text-[var(--orange)]">{away} ✈️</div>
                {GAPS.map((r) => <button key={r} className={`bet-opt ${cbd[m.key + '_winner'] === away && cbd[m.key + '_result'] === r ? 'sel-away' : ''}`} onClick={() => { pick(m.key + '_winner', away); pick(m.key + '_result', r) }}><span className="opt-res">{r}</span></button>)}
              </div>
            </div>
            {m.hasMvp && (
              <div className="mt-2"><Label>🏅 MVP</Label><Input value={cbd[m.key + '_mvp'] || ''} onChange={(e) => pick(m.key + '_mvp', e.target.value)} placeholder="שם שחקן..." /></div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function PreBetsForm({ stage, cbd, pick, getTeams }: any) {
  const eastT: string[] = [], westT: string[] = []
  for (const m of STAGE_MATCHES[1]) {
    const t = getTeams(1, m.key)
    if (m.conf === 'east') { if (t.home) eastT.push(t.home); if (t.away) eastT.push(t.away) }
    else { if (t.home) westT.push(t.home); if (t.away) westT.push(t.away) }
  }
  const allT = [...eastT, ...westT].sort((a, b) => a.localeCompare(b, 'he'))
  if (!allT.length) return <div className="mt-3 text-sm text-[var(--text2)]">⏳ ממתין לקביעת קבוצות סיבוב ראשון</div>
  return (
    <>
      <Separator />
      <CardTitle>🏆 הימורים מראש</CardTitle>
      {PREBETS.map((p) => {
        const opts = p.key === 'east_champ' ? eastT : p.key === 'west_champ' ? westT : allT
        return (
          <div key={p.key} className="mb-3">
            <Label>{p.label}</Label>
            <SelectNative value={cbd[p.key] || ''} onChange={(e) => pick(p.key, e.target.value)}>
              <option value="">בחר קבוצה...</option>
              {opts.sort((a, b) => a.localeCompare(b, 'he')).map((t) => <option key={t} value={t}>{t}</option>)}
            </SelectNative>
          </div>
        )
      })}
    </>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function BonusBetsForm({ stage, cbd, pick, getBonusBets, isBonusLocked, isSingleBonusLocked }: any) {
  const bonuses = getBonusBets(stage)
  if (!bonuses.length) return null
  if (isBonusLocked(stage)) return <div className="mt-3 rounded-lg border border-[var(--red)]/30 bg-[var(--red)]/5 p-3 text-sm text-[var(--red)]">🔒 הימורי הבונוס ננעלו</div>
  const available = bonuses.filter((b: any) => !isSingleBonusLocked(stage, b))
  if (!available.length && bonuses.length) return <div className="mt-3 text-sm text-[var(--text2)]">כל הימורי הבונוס לשלב זה ננעלו</div>
  return (
    <>
      <Separator />
      <CardTitle>⭐ הימורי בונוס</CardTitle>
      {available.map((b: any) => (
        <div key={b.id} className="bonus-bet-card">
          <div className="bonus-label"><span>⭐ {b.question}</span><span className="bonus-pts-badge">{b.points} נק'</span></div>
          <div className="bonus-opts">
            {(b.answers || []).map((a: string) => (
              <button key={a} className={`bonus-opt ${cbd['bonus_' + b.id] === a ? 'selected' : ''}`} onClick={() => pick('bonus_' + b.id, a)}>{a}</button>
            ))}
          </div>
        </div>
      ))}
    </>
  )
}
