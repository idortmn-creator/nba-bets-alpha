export interface MatchDef {
  key: string
  label: string
  conf: string
  singleGame?: boolean
  hasMvp?: boolean
}

export const STAGE_MATCHES: Record<string | number, MatchDef[]> = {
  0: [
    { key: 'e78', label: 'מזרח: #7 מול #8', conf: 'east' },
    { key: 'e910', label: 'מזרח: #9 מול #10', conf: 'east' },
    { key: 'w78', label: 'מערב: #7 מול #8', conf: 'west' },
    { key: 'w910', label: 'מערב: #9 מול #10', conf: 'west' },
  ],
  '0b': [
    { key: 'e_final', label: 'מזרח: גמר פליי-אין', conf: 'east', singleGame: true },
    { key: 'w_final', label: 'מערב: גמר פליי-אין', conf: 'west', singleGame: true },
  ],
  1: [
    { key: 'e1', label: "מזרח ס'1", conf: 'east' },
    { key: 'e2', label: "מזרח ס'2", conf: 'east' },
    { key: 'e3', label: "מזרח ס'3", conf: 'east' },
    { key: 'e4', label: "מזרח ס'4", conf: 'east' },
    { key: 'w1', label: "מערב ס'1", conf: 'west' },
    { key: 'w2', label: "מערב ס'2", conf: 'west' },
    { key: 'w3', label: "מערב ס'3", conf: 'west' },
    { key: 'w4', label: "מערב ס'4", conf: 'west' },
  ],
  2: [
    { key: 'e1', label: "מזרח ס'1", conf: 'east' },
    { key: 'e2', label: "מזרח ס'2", conf: 'east' },
    { key: 'w1', label: "מערב ס'1", conf: 'west' },
    { key: 'w2', label: "מערב ס'2", conf: 'west' },
  ],
  3: [
    { key: 'east', label: 'גמר מזרח', conf: 'east', hasMvp: true },
    { key: 'west', label: 'גמר מערב', conf: 'west', hasMvp: true },
  ],
  4: [{ key: 'finals', label: 'גמר NBA', conf: '', hasMvp: true }],
}

export const STAGE_NAMES = [
  'פליי-אין סיבוב א (4 משחקים)',
  'פליי-אין גמר (2 משחקים)',
  'סיבוב ראשון',
  'סיבוב שני',
  'גמר איזורי',
  'גמר NBA',
]

export const STAGE_SHORT = [
  'פליי-אין א',
  'פליי-אין ב',
  'סיבוב 1',
  'סיבוב 2',
  'גמר איזורי',
  'גמר',
]

export const GAPS = ['4-0', '4-1', '4-2', '4-3']

export const PREBETS = [
  { key: 'champion', label: '🏆 אלוף NBA' },
  { key: 'east_champ', label: '🔵 אלופת המזרח' },
  { key: 'west_champ', label: '🔴 אלופת המערב' },
]

export type StageKey = 0 | '0b' | 1 | 2 | 3 | 4
export const STAGE_KEYS: StageKey[] = [0, '0b', 1, 2, 3, 4]

export const SUPER_ADMIN_UID = 'aPgbjXex6lbB7N4X5j62Y4qqECV2'
