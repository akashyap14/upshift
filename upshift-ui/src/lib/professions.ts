export type Motif =
  | 'circuit'
  | 'chart'
  | 'waves'
  | 'roadmap'
  | 'funnel'
  | 'rise'
  | 'people'
  | 'bubble'
  | 'pulse'
  | 'spiral'

export interface Profession {
  id: string
  name: string
  sub: string
  mono: string
  tint: string
  tint2: string
  deep: string
  motif: Motif
}

// Each profession: soft sky (tint, tint2), a deep ink for contrast, and a line motif (DESIGN.md §1)
export const PROFESSIONS: Profession[] = [
  { id: 'sde', name: 'Software Engineer', sub: 'SDE, developers', mono: 'SE', tint: '#BDEBD9', tint2: '#C9E2FF', deep: '#0E6B52', motif: 'circuit' },
  { id: 'data', name: 'Data Analyst', sub: 'Analytics, BI, data science', mono: 'DA', tint: '#C9E2FF', tint2: '#E3DBFF', deep: '#1F5FBF', motif: 'chart' },
  { id: 'mkt', name: 'Marketer', sub: 'Brand, growth, content', mono: 'MK', tint: '#FFD6CC', tint2: '#FFE9B8', deep: '#B8364E', motif: 'waves' },
  { id: 'pm', name: 'Product Manager', sub: 'Product, program', mono: 'PM', tint: '#FFEDB3', tint2: '#E4F5B8', deep: '#8A5A00', motif: 'roadmap' },
  { id: 'sales', name: 'Sales & BD', sub: 'Account executives, BD', mono: 'SB', tint: '#FFDDBF', tint2: '#FFD6CC', deep: '#A04A00', motif: 'funnel' },
  { id: 'fin', name: 'Finance & Accounts', sub: 'FP&A, accounting, audit', mono: 'FA', tint: '#D8EBC8', tint2: '#C8F0F2', deep: '#3E6B1F', motif: 'rise' },
  { id: 'hr', name: 'HR & Talent', sub: 'Recruiting, people ops', mono: 'HR', tint: '#E3DBFF', tint2: '#FFD6E6', deep: '#5B3FC4', motif: 'people' },
  { id: 'cx', name: 'Customer Support', sub: 'Support, BPO, success', mono: 'CS', tint: '#C8F0F2', tint2: '#C9E2FF', deep: '#0B6E75', motif: 'bubble' },
  { id: 'ops', name: 'Operations', sub: 'Ops, supply chain, admin', mono: 'OP', tint: '#F8D5E3', tint2: '#FFEDB3', deep: '#A3305F', motif: 'pulse' },
  { id: 'founder', name: 'Founder / Coach', sub: 'Owners, coaches, consultants', mono: 'FC', tint: '#E4F5B8', tint2: '#BDEBD9', deep: '#4F6E00', motif: 'spiral' },
]

export const byId: Record<string, Profession> = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]))

// Line motifs (320 x 120). The path draws itself; a small dot rides along it.
export const MOTIF_PATHS: Record<Motif, string> = {
  circuit: 'M8 92 H70 V52 H132 V76 H196 V34 H258 V64 H312',
  chart: 'M8 104 L52 88 L96 94 L140 66 L184 72 L228 40 L272 46 L312 16',
  waves: 'M20 60 C60 10 100 110 140 60 S220 10 260 60 S300 100 312 70',
  roadmap: 'M8 40 H312 M8 80 H312 M60 40 V80 M170 40 V80 M260 40 V80',
  funnel: 'M20 14 H300 L196 70 V108 H124 V70 Z',
  rise: 'M8 100 C60 98 90 84 130 74 S200 52 240 36 S290 18 312 14',
  people:
    'M60 60 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 M160 60 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 M260 60 m-22 0 a22 22 0 1 0 44 0 a22 22 0 1 0 -44 0 M82 60 H138 M182 60 H238',
  bubble:
    'M40 20 H220 Q240 20 240 40 V70 Q240 90 220 90 H110 L80 110 V90 H40 Q20 90 20 70 V40 Q20 20 40 20 Z M262 38 Q280 55 262 72 M284 26 Q310 55 284 84',
  pulse: 'M8 64 H100 L116 64 L128 22 L144 104 L158 44 L170 64 H312',
  spiral:
    'M160 62 m0 0 c8 0 12 -8 6 -14 c-10 -10 -28 -2 -28 14 c0 22 30 30 46 14 c20 -20 6 -54 -24 -56 c-36 -2 -60 28 -52 60 c8 32 50 46 84 30 c30 -14 44 -46 36 -72',
}

export type Level = 1 | 2 | 3
export type Track = 'mixed' | 'skill' | 'ai'

export const LEVEL_NAME: Record<Level, string> = { 1: 'Junior', 2: 'Mid', 3: 'Leader' }
export const LEVEL_DIFFICULTY: Record<Level, string> = { 1: 'easy', 2: 'medium', 3: 'hard' }

// Coach voice by level (DESIGN.md §3)
export const COACH_TONE: Record<Level, { good: string; ok: string; low: string }> = {
  1: { good: 'Nice one!', ok: 'Good start!', low: 'Close! Here’s a stronger take.' },
  2: { good: 'Right call.', ok: 'Solid, with gaps.', low: 'Better approach below.' },
  3: { good: 'Correct.', ok: 'Partly there.', low: 'Stronger call below.' },
}

// Coach voice for A/B/C rounds (DESIGN.md §3): what to say when right, and before the best letter when not
export const PICK_TONE: Record<Level, { good: string; miss: string }> = {
  1: { good: 'Nice one!', miss: 'Close! The better pick is' },
  2: { good: 'Right call.', miss: 'Better option:' },
  3: { good: 'Correct. The trade-off:', miss: 'Stronger call:' },
}

// Level changes the pace: Junior slower and bouncier, Leader faster and terser
export const MOTION_SPEED: Record<Level, number> = { 1: 1.4, 2: 1, 3: 0.5 }
export const WORD_DELAY_MS: Record<Level, number> = { 1: 24, 2: 18, 3: 12 }

// Spec v3 §6: 2.5 min per round, clamped to 1–12
export const ROUND_MINUTES = 2.5
export function roundsForEta(eta: number): number {
  return Math.max(1, Math.min(12, Math.floor(eta / ROUND_MINUTES)))
}

// The backend only takes a profession string, so the track is expressed as a focus on it.
export function professionForTrack(p: Profession, track: Track): string {
  if (track === 'ai') return `${p.name} (focus: using AI tools well at work)`
  if (track === 'mixed') return `${p.name} (mix of core job skills and using AI well at work)`
  return p.name
}
