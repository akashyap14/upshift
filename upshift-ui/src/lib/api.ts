// Client for upshift-backend (see upshift-backend/README.md)

export interface Question {
  id: number
  question: string
  topic: string
  difficulty: string
}

export interface GenerateResponse {
  profession: string
  questions: Question[]
}

export interface AnsweredQuestion {
  id: number
  question: string
  answer: string
}

export interface QuestionResult {
  id: number
  question: string
  score: number
  feedback: string
  idealAnswer: string
}

export interface EvaluateResponse {
  profession: string
  overallScore: number
  summary: string
  strengths: string[]
  improvements: string[]
  results: QuestionResult[]
}

const BASE = import.meta.env.VITE_API_BASE ?? ''

async function post<T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(BASE + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new Error('Can’t reach the Upshift server. Check your connection and try again.')
  }
  if (!res.ok) {
    let message = ''
    try {
      message = (await res.json()).message ?? ''
    } catch {
      // body wasn't JSON
    }
    if (res.status === 502) throw new Error('The coach is busy right now. Try again in a moment.')
    throw new Error(message || `Something went wrong (${res.status}).`)
  }
  return res.json() as Promise<T>
}

export function generateQuestions(
  req: { profession: string; count: number; difficulty: string },
  signal?: AbortSignal,
) {
  return post<GenerateResponse>('/api/questions/generate', req, signal)
}

export function evaluateAnswers(req: { profession: string; answers: AnsweredQuestion[] }, signal?: AbortSignal) {
  return post<EvaluateResponse>('/api/questions/evaluate', req, signal)
}
