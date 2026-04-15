import { getTeamAbbr } from './teamLogos'

// ESPN public API — no key required
// Response format: { athletes: Array<{ items: Array<{ fullName: string }> }> }
//                  or { athletes: Array<{ fullName: string }> } (flat)

export async function fetchTeamRoster(teamName: string): Promise<string[]> {
  const abbr = getTeamAbbr(teamName)
  if (!abbr) return []
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${abbr}/roster`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const json = await res.json()

    const athletes: unknown[] = json?.athletes ?? []
    const names: string[] = []

    for (const group of athletes) {
      if (typeof group !== 'object' || group === null) continue
      // Grouped format: { items: [...] }
      const items = (group as Record<string, unknown>).items
      if (Array.isArray(items)) {
        for (const p of items) {
          const n = (p as Record<string, unknown>).fullName
          if (typeof n === 'string' && n) names.push(n)
        }
      } else {
        // Flat format: athlete object directly
        const n = (group as Record<string, unknown>).fullName
        if (typeof n === 'string' && n) names.push(n)
      }
    }

    return names.sort()
  } catch {
    return []
  }
}

export async function fetchTwoTeamRoster(home: string, away: string): Promise<string[]> {
  const [h, a] = await Promise.all([fetchTeamRoster(home), fetchTeamRoster(away)])
  // Deduplicate and sort: home first, then away
  const all = [...h, ...a]
  return [...new Set(all)].sort()
}
