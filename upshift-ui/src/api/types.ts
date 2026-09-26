// API contract for Upshift v3 (UPSHIFT-SPEC §2 data model, §6 API).
// The backend lives in upshift-backend; see ../../API.md for the endpoint list.
// Endpoints marked "addition" in API.md are ones the UI needs beyond the spec table.

export type Role = 'employee' | 'manager' | 'leader'
export type Level = 1 | 2 | 3
export type QuestionType = 'decide' | 'ai_move'
export type PackStatus = 'draft' | 'approved' | 'archived'
export type RewardKind = 'sponsor' | 'skill_upgrade' | 'company'

export interface User {
  id: number
  company_id: number
  company_name: string
  name: string
  role: Role
  team: string
  /** Profession id, e.g. "sde" (see lib/professions.ts) */
  profession: string
  level: Level
  points: number
}

export interface DocumentSummary {
  id: number
  title: string
  filename: string
  mime: string
  words: number
  created_at: string
  /** Number of packs generated from this document */
  packs: number
}

export interface Assignment {
  id: number
  pack_id: number
  team: string
  /** YYYY-MM-DD */
  due_date: string
}

export interface PackSummary {
  id: number
  title: string
  document_id: number | null
  document_title: string | null
  profession: string
  level: Level
  status: PackStatus
  question_count: number
  unverified_count: number
  assignments: Assignment[]
  created_at: string
}

export interface ReviewQuestion {
  id: number
  pack_id: number
  type: QuestionType
  scenario: string
  question: string
  /** Always three options, A/B/C */
  options: [string, string, string]
  best: 0 | 1 | 2
  second_best: 0 | 1 | 2 | null
  why: string
  source_quote: string
  source_location: string
  /** True when source_quote was found word for word in the document (checked in code) */
  verified: boolean
  /** ai_move only: one-line open question answerable in ~20 seconds */
  open_question: string | null
}

export interface Pack extends PackSummary {
  questions: ReviewQuestion[]
}

export interface GenerateRequest {
  profession: string
  level: Level
  count: number
}

// ---- Play (mobile) ----

export interface PlayOption {
  /** Original option index on the server; send this back as `chosen` */
  index: number
  text: string
}

export interface PlayRound {
  id: number
  type: QuestionType
  scenario: string
  question: string
  /** Shuffled by the server */
  options: PlayOption[]
  open_question: string | null
  pack: {
    id: number
    title: string
    /** "assigned" = company pack for the player's team; "news" = today's news round */
    kind: 'assigned' | 'news'
    due_date: string | null
  }
}

export interface RoundsResponse {
  rounds: PlayRound[]
  /** Assigned packs for the player's team, with progress, for the home screen */
  assigned: { pack_id: number; title: string; due_date: string; total: number; done: number }[]
}

export interface AnswerRequest {
  user_id: number
  question_id: number
  chosen: number
  open_text?: string
}

export interface OpenGrade {
  rubric: { task_fit: number; context: number; verification: number; human_line: number; data_care: number }
  /** 0–10 */
  total: number
  stronger_answer: string
  missed_check: string | null
}

export interface AnswerResponse {
  correct: boolean
  /** True when the pick was the second-best option (worth 5 at Mid/Leader) */
  second_best_pick: boolean
  best: number
  second_best: number | null
  why: string
  source_quote: string
  source_location: string
  /** Document title for company packs, publication for news rounds */
  source_title: string
  source_url: string | null
  open: OpenGrade | null
  /** Points awarded for this answer (0 on a repeat attempt or when the daily cap is hit) */
  points: number
  /** Player's balance after this answer */
  points_total: number
  repeat: boolean
}

export interface FinishRequest {
  user_id: number
  question_ids: number[]
}

export interface FinishResponse {
  /** Ride bonus + any pack-on-time and streak bonuses */
  bonus_points: number
  bonus_reasons: string[]
  points_total: number
  streak_days: number
}

// ---- Rewards ----

export interface Reward {
  id: number
  title: string
  kind: RewardKind
  cost_points: number
  sponsor_name: string | null
  stock: number
}

export interface RewardsResponse {
  balance: number
  rewards: Reward[]
}

export interface RedeemResponse {
  /** One-time code, e.g. "UPS-7K2Q" */
  code: string
  balance: number
  reward: Reward
}

export interface Redemption {
  id: number
  user_name: string
  team: string
  reward_title: string
  cost_points: number
  code: string
  created_at: string
}

export type RewardInput = Omit<Reward, 'id'>

// ---- Dashboard ----

export interface Tile {
  value: number
  /** Same metric last week, for the "change against last week" line */
  previous: number
}

export interface Dashboard {
  tiles: {
    active_players: Tile
    sessions_completed: Tile
    /** 0–100 */
    avg_score: Tile
    points_earned: Tile
  }
  score_by_team: { team: string; score: number; answers: number }[]
  score_by_pack: { pack_id: number; title: string; score: number; answers: number }[]
  weakest: { question_id: number; question: string; pack_title: string; miss_rate: number; answers: number }[]
  leaderboard: { user_id: number; name: string; team: string; points: number }[]
  completion: {
    assignment_id: number
    pack_title: string
    team: string
    due_date: string
    done: number
    in_progress: number
    not_started: number
  }[]
}

export interface ApiError {
  status: number
  message: string
}
