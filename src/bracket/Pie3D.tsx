export interface PieSlice {
  value: number   // raw count
  color: string   // hex fill
  label: string   // tooltip / legend
}

interface Props {
  slices: PieSlice[]
  size?: number   // SVG size in px (square)
}

const GAP_DEG = 1.5  // degrees of gap between segments

function donutSegment(
  cx: number, cy: number,
  outerR: number, innerR: number,
  startRad: number, endRad: number,
): string {
  // Inset each edge by half the gap
  const gapRad = (GAP_DEG * Math.PI) / 180
  const s = startRad + gapRad / 2
  const e = endRad   - gapRad / 2
  if (e <= s) return ''

  const largeArc = e - s > Math.PI ? 1 : 0
  const ox1 = cx + outerR * Math.cos(s), oy1 = cy + outerR * Math.sin(s)
  const ox2 = cx + outerR * Math.cos(e), oy2 = cy + outerR * Math.sin(e)
  const ix1 = cx + innerR * Math.cos(s), iy1 = cy + innerR * Math.sin(s)
  const ix2 = cx + innerR * Math.cos(e), iy2 = cy + innerR * Math.sin(e)

  return [
    `M ${ox1} ${oy1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${ox2} ${oy2}`,
    `L ${ix2} ${iy2}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix1} ${iy1}`,
    'Z',
  ].join(' ')
}

export default function DonutChart({ slices, size = 100 }: Props) {
  const total = slices.reduce((s, sl) => s + sl.value, 0)
  if (total === 0 || slices.length === 0) return null

  const cx      = size / 2
  const cy      = size / 2
  const outerR  = size * 0.46
  const innerR  = size * 0.28
  const TWO_PI  = Math.PI * 2

  let cumAngle = -Math.PI / 2  // start at 12 o'clock

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ display: 'block', flexShrink: 0 }}>
      {slices.map((sl) => {
        if (sl.value <= 0) return null
        const span = (sl.value / total) * TWO_PI
        const startAngle = cumAngle
        const endAngle   = cumAngle + span
        cumAngle = endAngle
        const d = donutSegment(cx, cy, outerR, innerR, startAngle, endAngle)
        if (!d) return null
        return (
          <path key={sl.label} d={d} fill={sl.color}>
            <title>{sl.label}</title>
          </path>
        )
      })}
      {/* Total count in the center */}
      <text
        x={cx} y={cy - 4}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.18}
        fontWeight="700"
        fill="rgba(255,255,255,0.9)"
      >
        {total}
      </text>
      <text
        x={cx} y={cy + size * 0.13}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={size * 0.11}
        fill="rgba(255,255,255,0.45)"
      >
        ניחושים
      </text>
    </svg>
  )
}
