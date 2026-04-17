import type { ReactNode } from 'react'
import { darkenColor } from './teamColors'

export interface PieSlice {
  value: number    // raw count (will be normalized to fraction)
  color: string    // fill hex color for the top face
  label: string    // text label shown on hover / in legend
}

interface Props {
  slices: PieSlice[]
  cx?: number
  cy?: number
  rx?: number      // horizontal radius of the top ellipse
  ry?: number      // vertical radius of the top ellipse (defaults rx * 0.36)
  depth?: number   // cylinder depth in px
  size?: number    // SVG viewBox size (square)
}

function polarX(cx: number, rx: number, angleRad: number) {
  return cx + rx * Math.cos(angleRad)
}
function polarY(cy: number, ry: number, angleRad: number) {
  return cy + ry * Math.sin(angleRad)
}

function arcPath(
  cx: number, cy: number, rx: number, ry: number,
  startAngle: number, endAngle: number,
  largeArc: 0 | 1
): string {
  const x1 = polarX(cx, rx, startAngle)
  const y1 = polarY(cy, ry, startAngle)
  const x2 = polarX(cx, rx, endAngle)
  const y2 = polarY(cy, ry, endAngle)
  return `M ${cx} ${cy} L ${x1} ${y1} A ${rx} ${ry} 0 ${largeArc} 1 ${x2} ${y2} Z`
}

function sideQuadPath(
  cx: number, cyt: number, cyb: number, rx: number, ry: number,
  startAngle: number, endAngle: number,
): string {
  // Only render side for the front half: angles in (0, π) → sin > 0
  const steps = 12
  const pts: [number, number][] = []
  for (let i = 0; i <= steps; i++) {
    const a = startAngle + (endAngle - startAngle) * (i / steps)
    pts.push([polarX(cx, rx, a), polarY(cyt, ry, a)])
  }
  const topPath = pts.map(([x, y], i) => (i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`)).join(' ')
  const botPath = [...pts].reverse().map(([x, y]) => `L ${x} ${y - cyt + cyb}`).join(' ')
  return `${topPath} ${botPath} Z`
}

export default function Pie3D({
  slices,
  cx: cxProp,
  cy: cyProp,
  rx: rxProp,
  ry: ryProp,
  depth: depthProp,
  size = 140,
}: Props) {
  const cx    = cxProp    ?? size / 2
  const rx    = rxProp    ?? size * 0.40
  const ry    = ryProp    ?? rx * 0.36
  const depth = depthProp ?? rx * 0.45
  const cyt   = cyProp    ?? size * 0.38
  const cyb   = cyt + depth

  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0 || slices.length === 0) return null

  // Build angle entries
  interface Segment {
    slice: PieSlice
    startAngle: number
    endAngle: number
    midAngle: number
    largeArc: 0 | 1
    isFront: boolean
  }

  const TWO_PI = Math.PI * 2
  const segments: Segment[] = []
  let cumAngle = -Math.PI / 2  // start at top (−90°)

  for (const sl of slices) {
    if (sl.value <= 0) continue
    const span = (sl.value / total) * TWO_PI
    const startAngle = cumAngle
    const endAngle   = cumAngle + span
    const midAngle   = (startAngle + endAngle) / 2
    const largeArc   = span > Math.PI ? 1 : 0
    // "Front" = midpoint is in lower half of ellipse (sin > 0)
    const isFront = Math.sin(midAngle) > 0
    segments.push({ slice: sl, startAngle, endAngle, midAngle, largeArc, isFront })
    cumAngle = endAngle
  }

  // Painter's algorithm: render back segments top faces first, then side faces of front
  // segments back-to-front, then top faces of front segments
  const backSegs  = segments.filter((s) => !s.isFront)
  const frontSegs = [...segments.filter((s) => s.isFront)].sort(
    (a, b) => Math.sin(a.midAngle) - Math.sin(b.midAngle)
  )

  const sideElems: ReactNode[] = []
  for (const seg of [...backSegs, ...frontSegs]) {
    // Only draw side if segment crosses the front half (any point with sin > 0)
    const sinStart = Math.sin(seg.startAngle)
    const sinMid   = Math.sin(seg.midAngle)
    const sinEnd   = Math.sin(seg.endAngle)
    if (sinStart <= 0 && sinMid <= 0 && sinEnd <= 0) continue

    const sideColor = darkenColor(seg.slice.color, 0.35)
    sideElems.push(
      <path
        key={`side-${seg.slice.label}`}
        d={sideQuadPath(cx, cyt, cyb, rx, ry, seg.startAngle, seg.endAngle)}
        fill={sideColor}
        stroke="rgba(0,0,0,0.15)"
        strokeWidth={0.5}
      />
    )
  }

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      style={{ overflow: 'visible', display: 'block' }}
    >
      {/* Back-half top faces */}
      {backSegs.map((seg) => (
        <path
          key={`top-back-${seg.slice.label}`}
          d={arcPath(cx, cyt, rx, ry, seg.startAngle, seg.endAngle, seg.largeArc)}
          fill={seg.slice.color}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth={0.8}
        >
          <title>{seg.slice.label}</title>
        </path>
      ))}

      {/* Side faces (painter's order) */}
      {sideElems}

      {/* Front-half top faces (drawn last — on top) */}
      {frontSegs.map((seg) => (
        <path
          key={`top-front-${seg.slice.label}`}
          d={arcPath(cx, cyt, rx, ry, seg.startAngle, seg.endAngle, seg.largeArc)}
          fill={seg.slice.color}
          stroke="rgba(0,0,0,0.2)"
          strokeWidth={0.8}
        >
          <title>{seg.slice.label}</title>
        </path>
      ))}
    </svg>
  )
}
