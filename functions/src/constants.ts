// Mirrors src/lib/constants.ts — keep in sync
export const SUPER_ADMIN_UID = 'aPgbjXex6lbB7N4X5j62Y4qqECV2'

export type StageKey = 0 | '0b' | 1 | 2 | 3 | 4
export const STAGE_KEYS: StageKey[] = [0, '0b', 1, 2, 3, 4]

// Only match keys needed — no labels required server-side
export const STAGE_MATCH_KEYS: Record<string | number, string[]> = {
  0:    ['e78', 'e910', 'w78', 'w910'],
  '0b': ['e_final', 'w_final'],
  1:    ['e1', 'e2', 'e3', 'e4', 'w1', 'w2', 'w3', 'w4'],
  2:    ['e1', 'e2', 'w1', 'w2'],
  3:    ['east', 'west'],
  4:    ['finals'],
}
