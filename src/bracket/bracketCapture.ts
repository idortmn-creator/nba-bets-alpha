import { getTeamAbbr } from '@/lib/teamLogos'
import {
  BRACKET_SERIES,
  BRACKET_POSITIONS,
  BRACKET_CONNECTOR_LINES,
  CARD_W, CARD_H, TOTAL_H, TOTAL_W,
  getBracketTeams,
} from './bracketConstants'
import type { BracketPick, BracketSeriesMap } from './bracketConstants'

export const SHARE_TEXT = 'גם אני משתתף בהימורי הברקט של אפליקציית הימורי הפלייאוף 2026! 🏀'

// ── Canvas layout constants ──────────────────────────────────────────────────

const SCALE       = 2        // retina
const PADDING     = 20
const HEADER_H    = 48
const BRACKET_TOP = 28       // room for conf labels

const CANVAS_W = TOTAL_W + PADDING * 2
const CANVAS_H = TOTAL_H + BRACKET_TOP + HEADER_H + PADDING * 2

const BG    = '#0f0f15'
const SURF  = '#1a1a24'

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

function label(name: string): string {
  if (!name) return '?'
  const abbr = getTeamAbbr(name)
  if (abbr) return abbr.toUpperCase()
  // fallback: first 3 chars
  return name.slice(0, 3).toUpperCase()
}

// ── Main draw function ───────────────────────────────────────────────────────

export async function drawBracketImage(
  pick: BracketPick,
  globalR1: Record<string, { home: string; away: string }>,
  bracketSeries: BracketSeriesMap,
  username: string,
): Promise<Blob> {
  const canvas = document.createElement('canvas')
  canvas.width  = CANVAS_W * SCALE
  canvas.height = CANVAS_H * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.textBaseline = 'middle'

  // ── Background ──
  ctx.fillStyle = BG
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // ── Header ──
  const hY = PADDING + HEADER_H / 2

  // App label (left)
  ctx.font = '600 12px "Heebo", Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.35)'
  ctx.textAlign = 'left'
  ctx.fillText('NBA 2026 Playoff Bracket', PADDING, hY - 7)

  // Username (left, larger)
  ctx.font = 'bold 16px "Heebo", Arial, sans-serif'
  ctx.fillStyle = '#ff6b00'
  ctx.textAlign = 'left'
  ctx.fillText(username, PADDING, hY + 11)

  // Divider under header
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(PADDING, PADDING + HEADER_H)
  ctx.lineTo(CANVAS_W - PADDING, PADDING + HEADER_H)
  ctx.stroke()

  // ── Canvas origin for the bracket ──
  const OX = PADDING
  const OY = PADDING + HEADER_H + BRACKET_TOP

  // ── Conference labels ──
  const confLabels = [
    { text: 'WEST', x: OX + CARD_W / 2 },
    { text: 'NBA Finals', x: OX + 504 + CARD_W / 2 },
    { text: 'EAST', x: OX + TOTAL_W - CARD_W / 2 },
  ]
  ctx.font = 'bold 9px "Heebo", Arial, sans-serif'
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  for (const l of confLabels) {
    ctx.textAlign = 'center'
    ctx.fillText(l.text, l.x, OY - 12)
  }

  // ── Connector lines ──
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1.5
  for (const [x1, y1, x2, y2] of BRACKET_CONNECTOR_LINES) {
    ctx.beginPath()
    ctx.moveTo(OX + x1, OY + y1)
    ctx.lineTo(OX + x2, OY + y2)
    ctx.stroke()
  }

  // ── Series cards ──
  for (const s of BRACKET_SERIES) {
    const pos = BRACKET_POSITIONS[s.key]
    if (!pos) continue

    const cx = OX + pos.x
    const cy = OY + pos.y

    const teams = getBracketTeams(s.key, pick, globalR1, bracketSeries)
    const p     = pick[s.key] || { homeWins: 0, awayWins: 0 }
    const homeWon = p.homeWins === 4
    const awayWon = p.awayWins === 4
    const noTeams = !teams.home && !teams.away

    // Card bg
    ctx.fillStyle = SURF
    roundRect(ctx, cx, cy, CARD_W, CARD_H, 5)
    ctx.fill()

    // Card border color
    const conf = s.conf
    ctx.strokeStyle =
      conf === 'east' ? 'rgba(79,195,247,0.45)' :
      conf === 'west' ? 'rgba(255,107,0,0.45)' :
      'rgba(255,215,0,0.55)'
    ctx.lineWidth = 1
    roundRect(ctx, cx, cy, CARD_W, CARD_H, 5)
    ctx.stroke()

    if (noTeams) {
      ctx.font = '13px Arial, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.25)'
      ctx.textAlign = 'center'
      ctx.fillText('?', cx + CARD_W / 2, cy + CARD_H / 2)
      continue
    }

    const rowH = CARD_H / 2
    const rows = [
      { name: teams.home, wins: p.homeWins, won: homeWon, lost: awayWon },
      { name: teams.away, wins: p.awayWins, won: awayWon, lost: homeWon },
    ]

    rows.forEach((row, i) => {
      const ry = cy + i * rowH

      // Row bg highlight if winner
      if (row.won) {
        ctx.fillStyle = 'rgba(34,197,94,0.12)'
        const r = i === 0 ? [5, 5, 0, 0] : [0, 0, 5, 5]
        ctx.beginPath()
        ctx.moveTo(cx + r[0], ry)
        ctx.lineTo(cx + CARD_W - r[1], ry)
        ctx.arcTo(cx + CARD_W, ry, cx + CARD_W, ry + r[1], r[1])
        ctx.lineTo(cx + CARD_W, ry + rowH - r[2])
        ctx.arcTo(cx + CARD_W, ry + rowH, cx + CARD_W - r[2], ry + rowH, r[2])
        ctx.lineTo(cx + r[3], ry + rowH)
        ctx.arcTo(cx, ry + rowH, cx, ry + rowH - r[3], r[3])
        ctx.lineTo(cx, ry + r[0])
        ctx.arcTo(cx, ry, cx + r[0], ry, r[0])
        ctx.closePath()
        ctx.fill()
      }

      const midY = ry + rowH / 2

      // Divider
      if (i === 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.08)'
        ctx.lineWidth = 0.5
        ctx.beginPath()
        ctx.moveTo(cx + 2, cy + rowH)
        ctx.lineTo(cx + CARD_W - 2, cy + rowH)
        ctx.stroke()
      }

      // Score (right side)
      ctx.font = row.won ? 'bold 13px Arial, sans-serif' : '12px Arial, sans-serif'
      ctx.fillStyle = row.won ? '#22c55e' : row.lost ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.75)'
      ctx.textAlign = 'right'
      ctx.fillText(String(row.wins), cx + CARD_W - 6, midY)

      // Team abbreviation (left side)
      ctx.font = row.won ? 'bold 11px Arial, sans-serif' : '10px Arial, sans-serif'
      ctx.fillStyle = row.won ? '#ffffff' : row.lost ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)'
      ctx.textAlign = 'left'
      ctx.fillText(label(row.name), cx + 7, midY)
    })
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Canvas capture failed'))),
      'image/png',
    )
  })
}

// ── Share / download ─────────────────────────────────────────────────────────

export async function shareBracketImage(blob: Blob): Promise<void> {
  const file    = new File([blob], 'my-bracket-2026.png', { type: 'image/png' })
  const appUrl  = typeof window !== 'undefined' ? window.location.origin : ''
  const shareText = appUrl ? `${SHARE_TEXT}\n${appUrl}` : SHARE_TEXT

  // Web Share API with file (works on mobile — opens native share sheet for WA/FB/X/etc.)
  if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ files: [file], text: shareText })
    return
  }

  // Desktop fallback: download the image
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = 'my-bracket-2026.png'
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
