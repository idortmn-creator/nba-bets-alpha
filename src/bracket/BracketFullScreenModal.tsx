import { useEffect } from 'react'
import { toast } from 'sonner'
import { TeamName } from '@/components/ui/TeamName'
import BracketShareBar from './BracketShareBar'
import { drawBracketImage, shareBracketImage } from './bracketCapture'
import {
  BRACKET_SERIES, BRACKET_POSITIONS, BRACKET_CONNECTOR_LINES,
  CARD_W, CARD_H, TOTAL_H, TOTAL_W,
  getBracketTeams,
} from './bracketConstants'
import type { BracketPick, BracketSeriesMap, BracketMvpPick } from './bracketConstants'

const MVP_LABELS: Record<string, string> = {
  cf_east: 'גמר מזרח MVP',
  cf_west: 'גמר מערב MVP',
  finals:  'גמר NBA MVP',
}

interface ReadonlyCardProps {
  seriesKey: string
  pick: BracketPick
  globalR1: Record<string, { home: string; away: string }>
  bracketSeries: BracketSeriesMap
}

function ROCard({ seriesKey, pick, globalR1, bracketSeries }: ReadonlyCardProps) {
  const teams   = getBracketTeams(seriesKey, pick, globalR1, bracketSeries)
  const p       = pick[seriesKey] || { homeWins: 0, awayWins: 0 }
  const homeWon = p.homeWins === 4
  const awayWon = p.awayWins === 4
  const noTeams = !teams.home && !teams.away

  const def = BRACKET_SERIES.find((s) => s.key === seriesKey)
  const conf = def?.conf || ''
  const borderColor =
    conf === 'east' ? 'rgba(79,195,247,0.35)' :
    conf === 'west' ? 'rgba(255,107,0,0.35)'  :
    'rgba(255,215,0,0.5)'

  return (
    <div
      className="br-card"
      style={{
        position: 'absolute',
        left: BRACKET_POSITIONS[seriesKey]?.x,
        top:  BRACKET_POSITIONS[seriesKey]?.y,
        width: CARD_W, height: CARD_H,
        borderColor,
      }}
    >
      {noTeams ? (
        <div className="br-card-empty">?</div>
      ) : (
        <>
          <div className={`br-team-row${homeWon ? ' br-winner' : awayWon ? ' br-loser' : ''}`}>
            <span className="br-team-name"><TeamName name={teams.home || '?'} size={12} /></span>
            <span className={`br-win-num-ro${homeWon ? ' br-win-bold' : ''}`}>{p.homeWins}</span>
          </div>
          <div className={`br-team-row${awayWon ? ' br-winner' : homeWon ? ' br-loser' : ''}`}>
            <span className="br-team-name"><TeamName name={teams.away || '?'} size={12} /></span>
            <span className={`br-win-num-ro${awayWon ? ' br-win-bold' : ''}`}>{p.awayWins}</span>
          </div>
        </>
      )}
    </div>
  )
}

const CONF_LABELS = [
  { text: '🔵 מזרח', x: TOTAL_W - CARD_W / 2, y: 12, anchor: 'middle' },
  { text: '🔴 מערב', x: CARD_W / 2,            y: 12, anchor: 'middle' },
  { text: 'גמר',     x: 504 + CARD_W / 2,      y: 12, anchor: 'middle' },
]

interface Props {
  pick: BracketPick
  mvpPick: BracketMvpPick
  globalR1: Record<string, { home: string; away: string }>
  bracketSeries: BracketSeriesMap
  username: string
  onClose: () => void
}

export default function BracketFullScreenModal({
  pick, mvpPick, globalR1, bracketSeries, username, onClose,
}: Props) {
  async function handleShare() {
    try {
      const blob = await drawBracketImage(pick, globalR1, bracketSeries, username)
      await shareBracketImage(blob)
    } catch (e: unknown) {
      toast('❌ ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  // Lock body scroll while modal is open
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const mvpEntries = Object.entries(MVP_LABELS).filter(([k]) => mvpPick[k as keyof BracketMvpPick])

  return (
    <div className="brfs-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="brfs-modal">
        {/* Header */}
        <div className="brfs-header">
          <div className="brfs-title">
            <span className="brfs-username">{username}</span>
            <span className="brfs-subtitle"> — הברקט שלי</span>
          </div>
          <div className="brfs-header-right">
            <BracketShareBar onShare={handleShare} />
            <button className="brfs-close" onClick={onClose} aria-label="סגור">✕</button>
          </div>
        </div>

        {/* Bracket canvas */}
        <div className="brfs-canvas-wrap">
          <div style={{ overflowX: 'auto', overflowY: 'hidden', paddingBottom: 8, direction: 'ltr' }}>
            <div style={{ position: 'relative', width: TOTAL_W, height: TOTAL_H + 30 }}>
              <svg style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }} width={TOTAL_W} height={TOTAL_H + 30}>
                {CONF_LABELS.map((l, i) => (
                  <text key={i} x={l.x} y={l.y} textAnchor={l.anchor as 'middle'}
                    fontSize={10} fontWeight={700} fill="rgba(255,255,255,0.4)"
                    fontFamily="Heebo, sans-serif">
                    {l.text}
                  </text>
                ))}
                <g transform="translate(0,24)">
                  {BRACKET_CONNECTOR_LINES.map(([x1, y1, x2, y2], i) => (
                    <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="rgba(255,255,255,0.18)" strokeWidth={1.5} />
                  ))}
                </g>
              </svg>
              <div style={{ position: 'absolute', top: 24, left: 0 }}>
                {BRACKET_SERIES.map((s) => (
                  <ROCard key={s.key} seriesKey={s.key} pick={pick} globalR1={globalR1} bracketSeries={bracketSeries} />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* MVP picks */}
        {mvpEntries.length > 0 && (
          <div className="brfs-mvp">
            {mvpEntries.map(([k, label]) => (
              <div key={k} className="brfs-mvp-row">
                <span className="brfs-mvp-label">{label}:</span>
                <span className="brfs-mvp-value">{mvpPick[k as keyof BracketMvpPick]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
