// Hybrid mode (npm run dev:hybrid): the parts of the v3 flow that upshift-backend can already do
// go to the real backend; the mock handles the rest. See upshift-backend/README.md for these endpoints.
import type { SeedQuestion } from './seed'

type RealFetch = typeof fetch

const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? ''
const LETTERS = ['A', 'B', 'C', 'D'] as const

interface BackendOption {
  id: string
  text: string
}

class BackendError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function json<T>(res: Response): Promise<T> {
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new BackendError(res.status, data?.message ?? `Backend returned ${res.status}`)
  return data as T
}

export const DIFFICULTY: Record<number, string> = { 1: 'easy', 2: 'medium', 3: 'hard' }

// ---- Admin: questions from a PDF (POST /api/admin/documents/questions) ----

interface AdminQuestion {
  question: string
  options: BackendOption[]
  correctAnswer: string
  explanation: string
  topic: string
  sourcePage: number | null
}

/** Real Claude questions from the PDF, trimmed to the spec's three options (best + two others). */
export async function questionsFromPdf(realFetch: RealFetch, file: File, count: number, level: number) {
  if (!ADMIN_KEY) throw new BackendError(503, 'Hybrid mode needs VITE_ADMIN_KEY in upshift-ui/.env.local (same value as ADMIN_API_KEY in upshift-backend/.env).')
  const form = new FormData()
  form.append('file', file)
  form.append('count', String(Math.max(1, Math.min(20, count))))
  form.append('difficulty', DIFFICULTY[level] ?? 'medium')
  const res = await realFetch('/api/admin/documents/questions', { method: 'POST', headers: { 'X-Admin-Key': ADMIN_KEY }, body: form })
  const data = await json<{ questions: AdminQuestion[] }>(res)
  return data.questions.map((q, i): SeedQuestion & { verified: boolean } => {
    const best = q.options.find((o) => o.id === q.correctAnswer) ?? q.options[0]
    const others = q.options.filter((o) => o !== best).slice(0, 2)
    // Put the best option in a varying position so it isn't always A
    const slot = i % 3
    const three = [...others]
    three.splice(slot, 0, best)
    return {
      type: i % 2 ? 'ai_move' : 'decide',
      scenario: q.topic ? `Topic: ${q.topic}.` : '',
      question: q.question,
      options: three.map((o) => o.text) as [string, string, string],
      best: slot as 0 | 1 | 2,
      second_best: null,
      why: q.explanation,
      // The backend doesn't return a quote; it checks the source page itself (null when invalid)
      source_quote: '',
      source_location: q.sourcePage ? `Page ${q.sourcePage}` : 'Page not found',
      open_question: null,
      verified: q.sourcePage !== null,
    }
  })
}

// ---- News rounds: one quiz per ride (POST /api/questions/generate + /evaluate) ----

export interface NewsQuestion {
  quiz_id: string
  question_id: number
  question: string
  topic: string
  options: string[]
  sources: { title: string; url: string }[]
}

/** One quiz for the ride's news rounds, so its questions don't repeat each other. */
export async function newsQuestions(realFetch: RealFetch, profession: string, level: number, count: number): Promise<NewsQuestion[]> {
  const res = await realFetch('/api/questions/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profession, count, difficulty: DIFFICULTY[level] ?? 'medium' }),
  })
  const quiz = await json<{ quizId: string; questions: { id: number; question: string; topic: string; options: BackendOption[] }[]; sources?: { title: string; url: string }[] }>(res)
  if (!quiz.questions.length) throw new BackendError(502, 'The backend returned no questions.')
  return quiz.questions.map((q) => ({ quiz_id: quiz.quizId, question_id: q.id, question: q.question, topic: q.topic, options: q.options.map((o) => o.text), sources: quiz.sources ?? [] }))
}

/**
 * Submits the first pick. A quiz can only be submitted once, and the response carries the answer
 * key for every question in it, so later rounds of the same ride are graded from that key.
 */
export async function gradeNews(realFetch: RealFetch, quizId: string, questionId: number, chosen: number) {
  const res = await realFetch('/api/questions/evaluate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ quizId, answers: [{ questionId, selectedOption: LETTERS[chosen] }] }),
  })
  const data = await json<{ results: { questionId: number; correctAnswer: string; explanation: string }[]; sources?: { title: string; url: string }[] }>(res)
  const results = new Map(data.results.map((r) => [r.questionId, { best: LETTERS.indexOf(r.correctAnswer as (typeof LETTERS)[number]), why: r.explanation }]))
  return { results, sources: data.sources ?? [] }
}

export { BackendError }
