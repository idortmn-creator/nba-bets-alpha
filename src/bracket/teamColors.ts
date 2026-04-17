import { getTeamAbbr } from '@/lib/teamLogos'

// Primary brand color for each ESPN abbreviation
const TEAM_COLOR: Record<string, string> = {
  atl:  '#C8102E',
  bos:  '#007A33',
  bkn:  '#000000',
  cha:  '#1D1160',
  chi:  '#CE1141',
  cle:  '#860038',
  dal:  '#00538C',
  den:  '#0E2240',
  det:  '#C8102E',
  gs:   '#1D428A',
  hou:  '#CE1141',
  ind:  '#002D62',
  lac:  '#C8102E',
  lal:  '#552583',
  mem:  '#5D76A9',
  mia:  '#98002E',
  mil:  '#00471B',
  min:  '#0C2340',
  no:   '#0C2340',
  ny:   '#006BB6',
  okc:  '#007AC1',
  orl:  '#0077C0',
  phi:  '#006BB6',
  phx:  '#1D1160',
  por:  '#E03A3E',
  sac:  '#5A2D81',
  sa:   '#C4CED4',
  tor:  '#CE1141',
  utah: '#002B5C',
  wsh:  '#002B5C',
}

const FALLBACK = '#888888'

/** Blend `hex` toward white by `factor` (0 = original, 1 = white) */
export function lightenColor(hex: string, factor: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lerp = (c: number) => Math.round(c + (255 - c) * factor)
  return `#${[lerp(r), lerp(g), lerp(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/** Darken `hex` by `factor` (0 = original, 1 = black) */
export function darkenColor(hex: string, factor: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  const lerp = (c: number) => Math.round(c * (1 - factor))
  return `#${[lerp(r), lerp(g), lerp(b)].map((x) => x.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Get the primary color for a team by name (Hebrew or English).
 * Returns FALLBACK if the team is not found.
 */
export function getTeamColor(name: string): string {
  if (!name) return FALLBACK
  const abbr = getTeamAbbr(name)
  if (!abbr) return FALLBACK
  return TEAM_COLOR[abbr] ?? FALLBACK
}

/**
 * Given a base color and a loser-wins count (0=sweep, 1, 2, 3),
 * return a lightened shade. Sweep = lightest, 4-3 = base color.
 * OUTCOME_LIGHTNESS[loserWins] → lightness factor
 */
const OUTCOME_LIGHTNESS = [0.52, 0.33, 0.16, 0.0]

export function getOutcomeColor(baseColor: string, loserWins: number): string {
  const factor = OUTCOME_LIGHTNESS[loserWins] ?? 0
  return lightenColor(baseColor, factor)
}
