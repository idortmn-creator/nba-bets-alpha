import { useState } from 'react'
import { Users, BarChart2 } from 'lucide-react'
import { useLeagueStore } from '@/store/league.store'
import { useGlobalStore } from '@/store/global.store'
import { useGlobalHelpers } from '@/hooks/useGlobalHelpers'
import { scoreStage, scoreStageDetail } from '@/services/scoring'
import { STAGE_KEYS, STAGE_SHORT, STAGE_MATCHES, PREBETS } from '@/lib/constants'
import type { StageKey } from '@/lib/constants'
import { Card } from '@/components/ui/card'
import { TeamName } from '@/components/ui/TeamName'

export default function BetsViewTab() {
  const leagueData = useLeagueStore((s) => s.currentLeagueData)
  const globalData = useGlobalStore((s) => s.globalData)
  const { getGlobal, isSeriesLocked, teamLabel, isSingleBonusLocked, getBonusBets, getBonusResults, isPreBetsLocked } = useGlobalHelpers()
  const [stage, setStage] = useState<StageKey>(0)
  const [subTab, setSubTab] = useState<'participant' | 'series'>('participant')

  if (!leagueData) return null

  const stageLocked = getGlobal('stageLocked', [false, false, false, false, false, false] as boolean[]) as boolean[]
  const locked = stageLocked[STAGE_KEYS.indexOf(stage)] || false
  const result = (getGlobal('results', {} as Record<string, Record<string, string> | null>))['stage' + stage] || {}
  const matches = STAGE_MATCHES[stage] || []
  const members = leagueData.members || []
  const memberInfo = leagueData.memberInfo || {}
  const bonuses = getBonusBets(stage)
  const bonusRes = getBonusResults(stage)

  function canView() {
    if (locked) return true
    if (stage === 0 || stage === '0b') return matches.some((m) => isSeriesLocked(stage, m.key))
    return false
  }

  return (
    <div className="pb-4">
      {/* ── Stage scrollable tab bar ── */}
      <div className="mb-3 -mx-0 flex overflow-x-auto border-b border-[var(--border)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {STAGE_SHORT.map((label, i) => {
          const sk = STAGE_KEYS[i]
          const isActive = stage === sk
          const isLocked = stageLocked[i] ?? false
          return (
            <button
              key={i}
              onClick={() => setStage(sk)}
              className={[
                'flex-shrink-0 px-5 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                'border-b-2 -mb-px',
                isActive
                  ? 'border-[var(--orange)] text-white'
                  : 'border-transparent text-[var(--text2)] hover:text-[var(--text1)]',
              ].join(' ')}
            >
              {label}{isLocked ? ' 🔒' : ''}
            </button>
          )
        })}
      </div>

      {/* ── Segmented control ── */}
      <div className="mb-3 flex rounded-lg border border-white/10 bg-white/5 p-0.5">
        <button
          onClick={() => setSubTab('participant')}
          className={[
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-all',
            subTab === 'participant'
              ? 'bg-[var(--orange)] text-white shadow-sm'
              : 'text-[var(--text2)] hover:text-[var(--text1)]',
          ].join(' ')}
        >
          <Users size={14} />לפי משתתף
        </button>
        <button
          onClick={() => setSubTab('series')}
          className={[
            'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-all',
            subTab === 'series'
              ? 'bg-[var(--orange)] text-white shadow-sm'
              : 'text-[var(--text2)] hover:text-[var(--text1)]',
          ].join(' ')}
        >
          <BarChart2 size={14} />לפי סדרה
        </button>
      </div>

      {/* ── Content ── */}
      {!canView() ? (
        <Card>
          <div className="py-8 text-center text-[var(--text2)]">
            <div className="mb-2 text-3xl">🔒</div>
            <p>ניתן לצפות לאחר נעילת השלב</p>
          </div>
        </Card>
      ) : subTab === 'participant' ? (
        <ParticipantView
          stage={stage} members={members} memberInfo={memberInfo}
          result={result as Record<string, string>} matches={matches}
          bonuses={bonuses} bonusRes={bonusRes}
          leagueData={leagueData} globalData={globalData}
          isSeriesLocked={isSeriesLocked} teamLabel={teamLabel}
          isSingleBonusLocked={isSingleBonusLocked} isPreBetsLocked={isPreBetsLocked}
        />
      ) : (
        <SeriesView
          stage={stage} members={members} memberInfo={memberInfo}
          result={result as Record<string, string>} matches={matches}
          bonuses={bonuses} bonusRes={bonusRes}
          leagueData={leagueData}
          isSeriesLocked={isSeriesLocked} teamLabel={teamLabel}
          isSingleBonusLocked={isSingleBonusLocked}
        />
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ParticipantView({ stage, members, memberInfo, result, matches, bonuses, bonusRes, leagueData, globalData, isSeriesLocked, teamLabel, isSingleBonusLocked, isPreBetsLocked }: any) {
  return (
    <div>
      <div className="grid gap-2">
        {members.map((uid: string) => {
          const info = memberInfo[uid] || { username: uid }
          const bet = ((leagueData.bets || {})[uid] || {})['stage' + stage] || {}
          const stageScore = scoreStage(uid, stage, leagueData, globalData)
          const detail = scoreStageDetail(uid, stage, leagueData, globalData)
          const hasResult = Object.keys(result || {}).length > 0
          return (
            <div key={uid} className="bet-card-compact">
              {/* Header */}
              <div className="bet-header-compact">
                <div className="min-w-0">
                  <div className="bet-username-compact">{info.username || uid}</div>
                  {info.displayName && <div className="bet-displayname-compact">{info.displayName}</div>}
                </div>
                <div className="bet-pts-compact">
                  {stageScore > 0 || hasResult ? `${stageScore} נק'` : '⏳'}
                </div>
              </div>

              {/* Bets */}
              <div className="bet-rows-compact">
                {(stage === 0 || stage === '0b') ? matches.map((m: any) => {
                  if (!isSeriesLocked(stage, m.key)) return (
                    <div key={m.key} className="series-not-started">
                      <span className="series-not-started-label">{teamLabel(stage, m.key, m.label)}</span>
                      <span className="series-not-started-msg">🔒 טרם נעל</span>
                    </div>
                  )
                  const bv = bet[m.key] || '-'
                  const cls = result[m.key] ? (bv.toLowerCase() === result[m.key].toLowerCase() ? 'correct' : 'wrong') : 'pending'
                  const pts = detail.seriesPoints[m.key]
                  return (
                    <div key={m.key} className="bet-item">
                      <span className="bet-label">{teamLabel(stage, m.key, m.label)}</span>
                      <span className={`bet-value ${cls}`}>
                        <TeamName name={bv} size={13} />
                        {pts ? <span className="pts-badge">+{pts}</span> : ''}
                      </span>
                    </div>
                  )
                }) : matches.map((m: any) => {
                  if (!isSeriesLocked(stage, m.key)) return (
                    <div key={m.key} className="series-not-started">
                      <span className="series-not-started-label">{teamLabel(stage, m.key, m.label)}</span>
                      <span className="series-not-started-msg">🔒 טרם החלה</span>
                    </div>
                  )
                  const bW = bet[m.key + '_winner'] || '-'
                  const bR = bet[m.key + '_result'] || '-'
                  const winMatch = result[m.key + '_winner'] && bW.toLowerCase() === result[m.key + '_winner'].toLowerCase()
                  const resMatch = result[m.key + '_result'] && bR === result[m.key + '_result']
                  let wC = 'pending'
                  if (result[m.key + '_winner']) {
                    wC = winMatch && resMatch ? 'correct-exact' : winMatch ? 'correct' : 'wrong'
                  }
                  const pts = detail.seriesPoints[m.key]
                  return (
                    <div key={m.key}>
                      <div className="bet-item">
                        <span className="bet-label">{teamLabel(stage, m.key, m.label)}</span>
                        <span className={`bet-value ${wC}`}>
                          <TeamName name={bW} size={13} />
                          <span className="opacity-60 text-[0.75em]">({bR})</span>
                          {pts ? <span className="pts-badge">+{pts}</span> : ''}
                        </span>
                      </div>
                      {m.hasMvp && (
                        <div className="bet-item">
                          <span className="bet-label">MVP</span>
                          <span className={`bet-value ${result[m.key + '_mvp'] ? (bet[m.key + '_mvp']?.toLowerCase() === result[m.key + '_mvp']?.toLowerCase() ? 'correct' : 'wrong') : 'pending'}`}>
                            {bet[m.key + '_mvp'] || '-'}
                          </span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {stage === 0 && globalData?.tiebreakerQuestion && (
                  <div className="bet-item mt-1 border-t border-[var(--border)] pt-1">
                    <span className="bet-label text-[var(--gold)]">🎯 {globalData.tiebreakerQuestion}</span>
                    <span className="bet-value pending">{bet['tiebreaker'] || '-'}</span>
                  </div>
                )}

                {stage === 1 && isPreBetsLocked() && PREBETS.map((p: any) => {
                  const bv = bet[p.key] || '-'
                  const cls = result[p.key] ? (bv.toLowerCase() === (result[p.key] || '').toLowerCase() ? 'correct' : 'wrong') : 'pending'
                  return (
                    <div key={p.key} className="bet-item">
                      <span className="bet-label">{p.label}</span>
                      <span className={`bet-value ${cls}`}>{bv}</span>
                    </div>
                  )
                })}

                {bonuses.filter((b: any) => isSingleBonusLocked(stage, b)).map((b: any) => {
                  const bonusBet = ((leagueData.bets || {})[uid] || {})['stage0'] || {}
                  const bv = bonusBet['bonus_' + b.id] || '-'
                  const cls = bonusRes[b.id] ? (bv.toLowerCase() === bonusRes[b.id].toLowerCase() ? 'correct' : 'wrong') : 'pending'
                  const bpts = detail.bonusBetPoints[b.id]
                  return (
                    <div key={b.id} className="bet-item">
                      <span className="bet-label text-gold">⭐ {b.question}</span>
                      <span className={`bet-value ${cls}`}>{bv}{bpts ? <span className="pts-badge">+{bpts}</span> : ''}</span>
                    </div>
                  )
                })}

                {detail.bonusRows.length > 0 && (
                  <>
                    <div className="bonus-rows-divider">בונוסים</div>
                    {detail.bonusRows.map((row: any, ri: number) => (
                      <div key={ri} className="bet-item">
                        <span className="bet-label text-gold">⭐ {row.label}</span>
                        <span className="pts-badge">+{row.pts}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Actual results card */}
      {Object.keys(result || {}).length > 0 && (
        <Card className="mt-3 !border-[rgba(79,195,247,0.3)]">
          <div className="mb-2 font-oswald text-base text-[var(--blue)]">📊 תוצאות אמיתיות</div>
          {(stage === 0 || stage === '0b') ? <>
            {matches.map((m: any) => (
              <div key={m.key} className="bet-item">
                <span className="bet-label">{teamLabel(stage, m.key, m.label)}</span>
                <span className="bet-value text-blue"><TeamName name={result[m.key] || '-'} size={13} /></span>
              </div>
            ))}
            {stage === 0 && globalData?.tiebreakerQuestion && globalData?.tiebreakerAnswer !== null && globalData?.tiebreakerAnswer !== undefined && (
              <div className="bet-item mt-1 border-t border-[var(--border)] pt-1">
                <span className="bet-label text-[var(--gold)]">🎯 {globalData.tiebreakerQuestion}</span>
                <span className="bet-value text-blue">{globalData.tiebreakerAnswer}</span>
              </div>
            )}
          </> : matches.map((m: any) => (
            <div key={m.key}>
              <div className="bet-item">
                <span className="bet-label">{teamLabel(stage, m.key, m.label)}</span>
                <span className="bet-value text-blue">
                  <TeamName name={result[m.key + '_winner'] || '-'} size={13} />
                  <span className="opacity-60 text-[0.75em]">({result[m.key + '_result'] || '-'})</span>
                </span>
              </div>
              {m.hasMvp && result[m.key + '_mvp'] && (
                <div className="bet-item">
                  <span className="bet-label">MVP</span>
                  <span className="bet-value text-blue">{result[m.key + '_mvp']}</span>
                </div>
              )}
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function SeriesView({ stage, members, memberInfo, result, matches, bonuses, bonusRes, leagueData, isSeriesLocked, teamLabel, isSingleBonusLocked }: any) {
  const visibleMatches = matches.filter((m: any) => isSeriesLocked(stage, m.key))

  return (
    <div>
      {visibleMatches.map((m: any) => {
        const rW = result[m.key + '_winner'] || result[m.key] || ''
        const rR = result[m.key + '_result'] || ''
        const tally: Record<string, { count: number; correct: boolean; exact: boolean; users: string[] }> = {}
        members.forEach((uid: string) => {
          const bet = ((leagueData.bets || {})[uid] || {})['stage' + stage] || {}
          const pick = (stage === 0 || stage === '0b') ? (bet[m.key] || '') : (bet[m.key + '_winner'] || '')
          const res = (stage === 0 || stage === '0b') ? '' : (bet[m.key + '_result'] || '')
          const key = (stage === 0 || stage === '0b') ? pick : (pick ? (pick + (res ? ` (${res})` : '')) : '')
          if (!key) return
          if (!tally[key]) tally[key] = { count: 0, correct: false, exact: false, users: [] }
          tally[key].count++
          tally[key].users.push(memberInfo[uid]?.username || uid)
          if (rW && pick.toLowerCase() === rW.toLowerCase()) { tally[key].correct = true; if (rR && res === rR) tally[key].exact = true }
        })
        const total = members.length || 1
        return (
          <Card key={m.key} className="!mb-2.5">
            <div className="mb-1 font-oswald text-base text-[var(--orange)]">🏀 {teamLabel(stage, m.key, m.label)}</div>
            {rW && <div className="mb-2 text-xs text-[var(--blue)]">תוצאה: {rW}{rR ? ` (${rR})` : ''}</div>}
            {Object.entries(tally).sort(([, a], [, b]) => (b as any).count - (a as any).count).map(([pick, t]: [string, any]) => {
              const cls = rW ? (t.correct ? (t.exact ? 'correct-exact' : 'correct') : 'wrong') : 'pending'
              const pct = Math.round(t.count / total * 100)
              const parenIdx = pick.lastIndexOf(' (')
              const pickTeam = parenIdx >= 0 ? pick.slice(0, parenIdx) : pick
              const pickSuffix = parenIdx >= 0 ? pick.slice(parenIdx) : ''
              return (
                <div key={pick} className="series-tally-row">
                  <span className={`bet-value ${cls}`} style={{ minWidth: 110 }}>
                    <TeamName name={pickTeam} size={13} />{pickSuffix}
                  </span>
                  <div className="tally-bar-wrap"><div className="tally-bar" style={{ width: `${pct}%` }} /></div>
                  <span className="tally-count">{t.count}/{total}</span>
                  <div className="tally-names">{t.users.join(', ')}</div>
                </div>
              )
            })}
          </Card>
        )
      })}
      {bonuses.filter((b: any) => isSingleBonusLocked(stage, b)).map((b: any) => {
        const correctAns = bonusRes[b.id] || ''
        const tally: Record<string, { count: number; correct: boolean; users: string[] }> = {}
        members.forEach((uid: string) => {
          const bet = ((leagueData.bets || {})[uid] || {})['stage0'] || {}
          const pick = bet['bonus_' + b.id] || ''
          if (!pick) return
          if (!tally[pick]) tally[pick] = { count: 0, correct: false, users: [] }
          tally[pick].count++
          tally[pick].users.push(memberInfo[uid]?.username || uid)
          if (correctAns && pick.toLowerCase() === correctAns.toLowerCase()) tally[pick].correct = true
        })
        const total = members.length || 1
        return (
          <Card key={b.id} className="!mb-2.5">
            <div className="mb-1 font-oswald text-base text-[var(--gold)]">⭐ {b.question}</div>
            {correctAns && <div className="mb-2 text-xs text-[var(--blue)]">תשובה נכונה: {correctAns}</div>}
            {Object.entries(tally).sort(([, a], [, b]) => (b as any).count - (a as any).count).map(([pick, t]: [string, any]) => {
              const cls = correctAns ? ((t as any).correct ? 'correct' : 'wrong') : 'pending'
              const pct = Math.round((t as any).count / total * 100)
              return (
                <div key={pick} className="series-tally-row">
                  <span className={`bet-value ${cls}`} style={{ minWidth: 90 }}>{pick}</span>
                  <div className="tally-bar-wrap"><div className="tally-bar" style={{ width: `${pct}%` }} /></div>
                  <span className="tally-count">{(t as any).count}/{total}</span>
                  <div className="tally-names">{(t as any).users.join(', ')}</div>
                </div>
              )
            })}
          </Card>
        )
      })}
    </div>
  )
}
