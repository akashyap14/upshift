// Client for upshift-backend (see upshift-backend/README.md)

export type OptionId = 'A' | 'B' | 'C' | 'D'

export interface Option {
  id: OptionId
  text: string
}

// A multiple-choice round. The correct answer stays on the server until the quiz is submitted.
export interface Question {
  id: number
  question: string
  options: Option[]
  topic: string
  difficulty: string
}

// A web page the questions drew on (only when web search was used). Show these to the user.
export interface Source {
  title: string
  url: string
}

export interface GenerateResponse {
  quizId: string
  profession: string
  count: number
  expiresAt: string
  questions: Question[]
  webSearch: boolean
  sources: Source[]
}

export interface SelectedAnswer {
  questionId: number
  selectedOption: OptionId
}

export interface QuestionResult {
  questionId: number
  question: string
  options: Option[]
  selectedOption: OptionId | null
  correctAnswer: OptionId
  correct: boolean
  explanation: string
}

export interface EvaluateResponse {
  quizId: string
  profession: string
  totalQuestions: number
  answered: number
  correct: number
  scorePercent: number
  results: QuestionResult[]
  sources: Source[]
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
    // 502/503/504: the AI behind the coach failed or is busy; the backend's message is for developers.
    if (res.status === 502 || res.status === 503 || res.status === 504) {
      throw new Error('The coach is busy right now. Try again in a moment.')
    }
    throw new Error(message || `Something went wrong (${res.status}).`)
  }
  return res.json() as Promise<T>
}

export function generateQuestions(
  req: { profession: string; count: number; difficulty: string; webSearch?: boolean },
  signal?: AbortSignal,
) {
  return post<GenerateResponse>('/api/questions/generate', req, signal)
}

// One submission per quiz: the server grades it and only then reveals the answers.
export function evaluateAnswers(req: { quizId: string; answers: SelectedAnswer[] }, signal?: AbortSignal) {
  return post<EvaluateResponse>('/api/questions/evaluate', req, signal)
}
