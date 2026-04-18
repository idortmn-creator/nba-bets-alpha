import { getTeamAbbr } from '@/lib/teamLogos'

// Official primary or most-distinctive brand color per ESPN abbreviation.
// Where the primary color is too dark (near-black), the team's secondary / alternate
// color is used so it reads clearly on the app's dark background.
// No two teams that could realistically face each other in the same series share a
// similar color — where the primary conflicted, a secondary brand color was chosen.
const TEAM_COLOR: Record<string, string> = {
  atl:  '#C8102E',  // Hawks        — primary red
  bos:  '#007A33',  // Celtics       — primary green
  bkn:  '#0053A0',  // Nets          — classic blue (primary is black; blue used for visibility)
  cha:  '#00788C',  // Hornets       — teal (secondary; avoids PHX/LAL purple conflict)
  chi:  '#CE1141',  // Bulls         — primary red
  cle:  '#86002C',  // Cavaliers     — wine red
  dal:  '#003DA5',  // Mavericks     — darker royal blue
  den:  '#FEC524',  // Nuggets       — primary gold (very distinctive)
  det:  '#C8102E',  // Pistons       — primary red
  gs:   '#FFC72C',  // Warriors      — iconic gold
  hou:  '#CE1141',  // Rockets       — primary red
  ind:  '#FDBB30',  // Pacers        — gold (secondary; avoids navy overlap)
  lac:  '#C8102E',  // Clippers      — primary red
  lal:  '#552583',  // Lakers        — primary purple
  mem:  '#5D76A9',  // Grizzlies     — steel blue
  mia:  '#98002E',  // Heat          — dark red / maroon
  mil:  '#00471B',  // Bucks         — dark green
  min:  '#00843D',  // Timberwolves  — aurora green (secondary; avoids DAL/OKC blue)
  no:   '#85714D',  // Pelicans      — gold (secondary; distinct from dark navy)
  ny:   '#F58426',  // Knicks        — orange (distinct from PHI blue)
  okc:  '#007AC1',  // Thunder       — bright blue
  orl:  '#0B77BD',  // Magic         — medium blue
  phi:  '#006BB6',  // 76ers         — royal blue
  phx:  '#E56020',  // Suns          — orange (secondary; avoids CHA teal / LAL purple)
  por:  '#E03A3E',  // Trail Blazers — primary red
  sac:  '#B4975A',  // Kings         — gold (secondary; avoids LAL purple conflict)
  sa:   '#1A1A1A',  // Spurs         — near-black (brand identity; not neutral gray)
  tor:  '#CE1141',  // Raptors       — primary red
  utah: '#002B5C',  // Jazz          — primary navy
  wsh:  '#E31837',  // Wizards       — bright red (secondary; distinct from UTAH navy)
}

const FALLBACK = '#4A6FA5'  // neutral blue — never gray

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
 * Returns FALLBACK (blue) if the team is not recognised — never gray.
 */
export function getTeamColor(name: string): string {
  if (!name) return FALLBACK
  const abbr = getTeamAbbr(name)
  if (!abbr) return FALLBACK
  return TEAM_COLOR[abbr] ?? FALLBACK
}

/**
 * Given a base color and a loser-wins count (0 = sweep, 1, 2, 3),
 * return a lightened shade with clearly distinct steps.
 *
 *   4-0 (sweep)  → 72% toward white  (lightest)
 *   4-1          → 48% toward white
 *   4-2          → 22% toward white
 *   4-3          → base color        (darkest)
 */
const OUTCOME_LIGHTNESS = [0.72, 0.48, 0.22, 0.0]

export function getOutcomeColor(baseColor: string, loserWins: number): string {
  const factor = OUTCOME_LIGHTNESS[loserWins] ?? 0
  return lightenColor(baseColor, factor)
}
