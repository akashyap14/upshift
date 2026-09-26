// Fetch helpers for every Upshift endpoint. React Query hooks live in ./hooks.ts.
import type {
  AnswerRequest,
  AnswerResponse,
  Assignment,
  Dashboard,
  DocumentSummary,
  FinishRequest,
  FinishResponse,
  GenerateRequest,
  Pack,
  PackSummary,
  Redemption,
  RedeemResponse,
  ReviewQuestion,
  Reward,
  RewardInput,
  RewardsResponse,
  RoundsResponse,
  User,
} from './types'

const BASE = import.meta.env.VITE_API_BASE ?? ''

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = body instanceof FormData
  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      headers: body && !isForm ? { 'Content-Type': 'application/json' } : undefined,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
    })
  } catch {
    throw new HttpError(0, 'Can’t reach the Upshift server. Check your connection and try again.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    if (res.status >= 502) throw new HttpError(res.status, 'The server is busy right now. Try again in a moment.')
    const msg = data?.message ?? data?.error
    throw new HttpError(res.status, typeof msg === 'string' && msg ? msg : `Something went wrong (${res.status}).`)
  }
  return data as T
}

const q = (params: Record<string, string | number>) => '?' + new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))

export const api = {
  // Demo login
  users: () => call<User[]>('GET', '/users'),
  login: (user_id: number) => call<User>('POST', '/login', { user_id }),

  // Documents
  documents: () => call<DocumentSummary[]>('GET', '/docs'),
  upload: (file: File, title?: string) => {
    const fd = new FormData()
    fd.append('file', file)
    if (title) fd.append('title', title)
    return call<DocumentSummary>('POST', '/docs', fd)
  },
  deleteDocument: (id: number) => call<void>('DELETE', `/docs/${id}`),
  generate: (docId: number, body: GenerateRequest) => call<{ pack_id: number }>('POST', `/docs/${docId}/generate`, body),

  // Packs
  packs: () => call<PackSummary[]>('GET', '/packs'),
  pack: (id: number) => call<Pack>('GET', `/packs/${id}`),
  approve: (id: number) => call<PackSummary>('POST', `/packs/${id}/approve`),
  deletePack: (id: number) => call<void>('DELETE', `/packs/${id}`),
  editQuestion: (id: number, body: Partial<Omit<ReviewQuestion, 'id' | 'pack_id' | 'verified'>>) =>
    call<ReviewQuestion>('PATCH', `/questions/${id}`, body),
  deleteQuestion: (id: number) => call<void>('DELETE', `/questions/${id}`),
  regenerateQuestion: (id: number) => call<ReviewQuestion>('POST', `/questions/${id}/regenerate`),
  assign: (body: { pack_id: number; team: string; due_date: string }) => call<Assignment>('POST', '/assignments', body),

  // Play
  /** preview: read-only look for the home screen (the server shouldn't create or reserve rounds) */
  rounds: (user_id: number, eta: number, preview = false) =>
    call<RoundsResponse>('GET', `/play/rounds${q(preview ? { user_id, eta, preview: 1 } : { user_id, eta })}`),
  answer: (body: AnswerRequest) => call<AnswerResponse>('POST', '/play/answer', body),
  finish: (body: FinishRequest) => call<FinishResponse>('POST', '/play/finish', body),

  // Rewards
  rewards: (user_id: number) => call<RewardsResponse>('GET', `/rewards${q({ user_id })}`),
  redeem: (reward_id: number, user_id: number) => call<RedeemResponse>('POST', `/rewards/${reward_id}/redeem`, { user_id }),
  createReward: (body: RewardInput) => call<Reward>('POST', '/rewards', body),
  updateReward: (id: number, body: Partial<RewardInput>) => call<Reward>('PATCH', `/rewards/${id}`, body),
  deleteReward: (id: number) => call<void>('DELETE', `/rewards/${id}`),
  redemptions: () => call<Redemption[]>('GET', '/redemptions'),

  // Dashboard
  dashboard: (company_id: number) => call<Dashboard>('GET', `/dashboard${q({ company_id })}`),
}
