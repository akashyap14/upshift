// Browser-side mock of the Upshift v3 API, for building the UI before upshift-backend has it.
// Enabled with `npm run dev:mock` (VITE_MOCK=1). State lives in localStorage; reset with
// localStorage.removeItem('upshift.mock.v1'). Follows spec §4 points rules and §5.2 quote check.
import type {
  AnswerResponse,
  Dashboard,
  FinishResponse,
  Level,
  OpenGrade,
  PackStatus,
  PlayRound,
  QuestionType,
  Reward,
  RewardKind,
  Role,
} from '../types'
import {
  COMPANY,
  GENERAL_NEWS,
  NEWS_QUESTIONS,
  POLICY_FILENAME,
  POLICY_QUESTIONS,
  POLICY_TEXT,
  POLICY_TITLE,
  SEED_REWARDS,
  SEED_USERS,
  type SeedQuestion,
} from './seed'

const STORE = 'upshift.mock.v1'
const DAY = 864e5
const DAILY_CAP = 200
const POINTS = { correct: 10, second: 5, ride: 5, packOnTime: 20, streak5: 15 }

interface UserRow { id: number; company_id: number; name: string; role: Role; team: string; profession: string; level: Level; points: number }
interface DocRow { id: number; company_id: number; title: string; filename: string; mime: string; text: string; uploaded_by: number; created_at: string }
interface PackRow { id: number; company_id: number; document_id: number | null; title: string; profession: string; level: Level; status: PackStatus; kind: 'company' | 'news'; created_at: string }
interface QuestionRow extends SeedQuestion { id: number; pack_id: number; verified: boolean }
interface AssignmentRow { id: number; pack_id: number; team: string; due_date: string }
interface AnswerRow { id: number; user_id: number; question_id: number; chosen: number; correct: boolean; open_score: number | null; points: number; created_at: string }
interface RewardRow { id: number; title: string; kind: RewardKind; cost_points: number; sponsor_name: string | null; stock: number }
interface RedemptionRow { id: number; user_id: number; reward_id: number; code: string; created_at: string }
interface PointsRow { user_id: number; reason: string; points: number; created_at: string }

interface Db {
  nextId: number
  users: UserRow[]
  documents: DocRow[]
  packs: PackRow[]
  questions: QuestionRow[]
  assignments: AssignmentRow[]
  answers: AnswerRow[]
  rewards: RewardRow[]
  redemptions: RedemptionRow[]
  points_log: PointsRow[]
}

class MockError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}
const fail = (status: number, message: string): never => {
  throw new MockError(status, message)
}

// ---------- Seed ----------
function seed(): Db {
  const db: Db = { nextId: 1, users: [], documents: [], packs: [], questions: [], assignments: [], answers: [], rewards: [], redemptions: [], points_log: [] }
  const id = () => db.nextId++
  const iso = (msAgo: number) => new Date(Date.now() - msAgo).toISOString()

  for (const u of SEED_USERS) db.users.push({ id: id(), company_id: COMPANY.id, ...u })
  for (const r of SEED_REWARDS) db.rewards.push({ id: id(), ...r })

  const doc: DocRow = { id: id(), company_id: COMPANY.id, title: POLICY_TITLE, filename: POLICY_FILENAME, mime: 'application/pdf', text: POLICY_TEXT, uploaded_by: db.users.find((u) => u.role === 'manager')!.id, created_at: iso(9 * DAY) }
  db.documents.push(doc)
  const pack: PackRow = { id: id(), company_id: COMPANY.id, document_id: doc.id, title: 'AI Usage Policy essentials', profession: 'all', level: 2, status: 'approved', kind: 'company', created_at: iso(8 * DAY) }
  db.packs.push(pack)
  for (const q of POLICY_QUESTIONS) db.questions.push({ id: id(), pack_id: pack.id, ...q, verified: true })
  db.assignments.push({ id: id(), pack_id: pack.id, team: 'Marketing', due_date: dateOnly(Date.now() + 5 * DAY) })

  const newsSets: [string, SeedQuestion[]][] = [...Object.entries(NEWS_QUESTIONS), ['all', GENERAL_NEWS]]
  for (const [profession, qs] of newsSets) {
    const p: PackRow = { id: id(), company_id: COMPANY.id, document_id: null, title: 'Today’s news round', profession, level: 2, status: 'approved', kind: 'news', created_at: iso(DAY) }
    db.packs.push(p)
    for (const q of qs) db.questions.push({ id: id(), pack_id: p.id, ...q, verified: true })
  }

  // Some history so the dashboard has something to show: Marketing played the policy pack.
  const policyQs = db.questions.filter((q) => q.pack_id === pack.id)
  let r = 7
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280)
  for (const u of db.users.filter((x) => x.team === 'Marketing')) {
    const n = 2 + Math.floor(rand() * 4)
    policyQs.slice(0, n).forEach((q, i) => {
      const correct = rand() > (i === 4 ? 0.8 : 0.35)
      const when = iso((1 + rand() * 12) * DAY)
      db.answers.push({ id: id(), user_id: u.id, question_id: q.id, chosen: correct ? q.best : (q.best + 1) % 3, correct, open_score: null, points: correct ? POINTS.correct : 0, created_at: when })
      db.points_log.push({ user_id: u.id, reason: 'correct', points: correct ? POINTS.correct : 0, created_at: when })
    })
    db.points_log.push({ user_id: u.id, reason: 'ride', points: POINTS.ride, created_at: iso((1 + rand() * 12) * DAY) })
  }
  return db
}

function load(): Db {
  try {
    const raw = localStorage.getItem(STORE)
    if (raw) return JSON.parse(raw) as Db
  } catch {
    // corrupted: reseed
  }
  const db = seed()
  save(db)
  return db
}
function save(db: Db) {
  localStorage.setItem(STORE, JSON.stringify(db))
}

// ---------- Helpers ----------
function dateOnly(ms: number) {
  return new Date(ms).toISOString().slice(0, 10)
}
const today = () => dateOnly(Date.now())
const normalise = (s: string) =>
  s.toLowerCase().replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim()
const quoteFound = (quote: string, text: string) => quote.trim().length > 8 && normalise(text).includes(normalise(quote))
const wordCount = (s: string) => s.split(/\s+/).filter(Boolean).length

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function code() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'UPS-' + Array.from({ length: 4 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

const userOut = (u: UserRow) => ({ ...u, company_name: COMPANY.name })
const getUser = (db: Db, id: unknown) => db.users.find((u) => u.id === Number(id)) ?? fail(404, 'User not found.')
const packDoc = (db: Db, p: PackRow) => (p.document_id ? db.documents.find((d) => d.id === p.document_id) : undefined)

function packSummary(db: Db, p: PackRow) {
  const qs = db.questions.filter((q) => q.pack_id === p.id)
  return {
    id: p.id,
    title: p.title,
    document_id: p.document_id,
    document_title: packDoc(db, p)?.title ?? null,
    profession: p.profession,
    level: p.level,
    status: p.status,
    question_count: qs.length,
    unverified_count: qs.filter((q) => !q.verified).length,
    assignments: db.assignments.filter((a) => a.pack_id === p.id),
    created_at: p.created_at,
  }
}

function questionOut(q: QuestionRow) {
  return {
    id: q.id,
    pack_id: q.pack_id,
    type: q.type,
    scenario: q.scenario,
    question: q.question,
    options: q.options,
    best: q.best,
    second_best: q.second_best,
    why: q.why,
    source_quote: q.source_quote,
    source_location: q.source_location,
    verified: q.verified,
    open_question: q.open_question,
  }
}

function earnedToday(db: Db, userId: number) {
  return db.points_log.filter((p) => p.user_id === userId && p.created_at.slice(0, 10) === today()).reduce((s, p) => s + p.points, 0)
}

function award(db: Db, user: UserRow, reason: string, pts: number) {
  const given = Math.max(0, Math.min(pts, DAILY_CAP - earnedToday(db, user.id)))
  if (given <= 0) return 0
  db.points_log.push({ user_id: user.id, reason, points: given, created_at: new Date().toISOString() })
  user.points += given
  return given
}

function streakDays(db: Db, userId: number) {
  const days = new Set(db.answers.filter((a) => a.user_id === userId).map((a) => a.created_at.slice(0, 10)))
  let n = 0
  for (let t = Date.now(); days.has(dateOnly(t)); t -= DAY) n++
  return n
}

// ---------- AI stand-ins ----------
function sentencesOf(text: string) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter((s) => wordCount(s) >= 8 && wordCount(s) <= 30)
}

function questionFromSentence(s: string, i: number, heading: string): SeedQuestion {
  const aiMove = i % 2 === 1
  return {
    type: aiMove ? 'ai_move' : 'decide',
    scenario: aiMove
      ? 'A teammate wants to use an AI tool for a task this document covers and asks what the rule is. [Mock question: written without the AI.]'
      : 'A colleague asks what your company document says about this situation. [Mock question: written without the AI.]',
    question: 'Which statement matches the document?',
    options: [s, 'There is no rule about this; use your judgement.', 'It depends on what your manager prefers.'],
    best: 0,
    second_best: 1,
    why: 'This is what the document says.',
    source_quote: s,
    source_location: heading,
    open_question: aiMove ? 'In one line: how would you check the AI’s output here?' : null,
  }
}

function generateFrom(doc: DocRow, count: number): QuestionRow[] {
  if (doc.text === POLICY_TEXT) {
    const picked = Array.from({ length: count }, (_, i) => POLICY_QUESTIONS[i % POLICY_QUESTIONS.length])
    // The last one gets a paraphrased quote so the ✗ badge and "fix before approve" flow can be demoed.
    return picked.map((q, i) => ({
      ...q,
      id: 0,
      pack_id: 0,
      source_quote: i === count - 1 ? 'Always check AI facts with a reliable source before you share anything.' : q.source_quote,
      verified: i !== count - 1,
    }))
  }
  const sentences = sentencesOf(doc.text)
  if (!sentences.length) fail(422, 'We couldn’t find enough readable text in this document to write questions.')
  return Array.from({ length: count }, (_, i) => {
    const q = questionFromSentence(sentences[i % sentences.length], i, 'Uploaded document')
    const verified = i !== count - 1 || count < 3
    return { ...q, id: 0, pack_id: 0, source_quote: verified ? q.source_quote : q.source_quote.replace(/\bmust\b|\bshould\b|\bmay\b/i, 'could'), verified: verified && quoteFound(q.source_quote, doc.text) }
  })
}

function gradeOpen(text: string): OpenGrade {
  const t = text.toLowerCase()
  const has = (...w: string[]) => w.some((x) => t.includes(x))
  const rubric = {
    task_fit: has('draft', 'summar', 'first', 'test', 'review', 'code', 'query') ? 2 : 1,
    context: has('context', 'give it', 'prompt', 'input', 'example', 'data') ? 2 : wordCount(t) > 8 ? 1 : 0,
    verification: has('check', 'verify', 'review', 'test', 'compare', 'source', 'trusted') ? 2 : 0,
    human_line: has('i would', 'sign off', 'approve', 'human', 'myself', 'manager', 'decide') ? 2 : 1,
    data_care: has('personal', 'anonym', 'remove', 'identif', 'approved tool', 'confidential', 'pii') ? 2 : 1,
  }
  const total = Object.values(rubric).reduce((s, v) => s + v, 0)
  return {
    rubric,
    total,
    stronger_answer:
      'Hand AI the first draft with the right context, then check every figure and change against a trusted source. Keep the final call, and any personal data, with a person.',
    missed_check: rubric.verification < 2 ? 'You didn’t say how you would check the AI’s output against a trusted source.' : null,
  }
}

// ---------- Routes ----------
type Handler = (ctx: { db: Db; params: string[]; query: URLSearchParams; body: unknown }) => unknown | Promise<unknown>
const routes: [string, RegExp, Handler][] = []
const route = (method: string, path: string, h: Handler) =>
  routes.push([method, new RegExp('^/api' + path.replace(/:\w+/g, '(\\d+)') + '$'), h])

route('GET', '/users', ({ db }) => db.users.map((u) => userOut(u)))
route('POST', '/login', ({ db, body }) => userOut(getUser(db, (body as { user_id: number }).user_id)))

// Documents
route('GET', '/docs', ({ db }) =>
  db.documents
    .map((d) => ({ id: d.id, title: d.title, filename: d.filename, mime: d.mime, words: wordCount(d.text), created_at: d.created_at, packs: db.packs.filter((p) => p.document_id === d.id).length }))
    .reverse(),
)
route('POST', '/docs', async ({ db, body }) => {
  const fd = body as FormData
  const file = fd.get('file')
  if (!(file instanceof File)) return fail(400, 'Choose a file to upload.')
  if (file.size > 20 * 1024 * 1024) fail(413, 'Files can be up to 20 MB.')
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (!['pdf', 'docx', 'txt', 'md'].includes(ext)) fail(415, 'Upload a PDF, DOCX, TXT or MD file.')
  // The mock can't read PDF/DOCX in the browser, so those use the sample policy text.
  const text = ext === 'txt' || ext === 'md' ? await file.text() : POLICY_TEXT
  if (text.trim().length < 200) fail(422, 'We could not read enough text from this file.')
  const title = String(fd.get('title') || file.name.replace(/\.[^.]+$/, ''))
  const doc: DocRow = { id: db.nextId++, company_id: COMPANY.id, title, filename: file.name, mime: file.type || ext, text, uploaded_by: 0, created_at: new Date().toISOString() }
  db.documents.push(doc)
  return { id: doc.id, title, filename: doc.filename, mime: doc.mime, words: wordCount(text), created_at: doc.created_at, packs: 0 }
})
route('DELETE', '/docs/:id', ({ db, params }) => {
  const id = Number(params[0])
  const packIds = db.packs.filter((p) => p.document_id === id).map((p) => p.id)
  db.questions = db.questions.filter((q) => !packIds.includes(q.pack_id))
  db.assignments = db.assignments.filter((a) => !packIds.includes(a.pack_id))
  db.packs = db.packs.filter((p) => p.document_id !== id)
  db.documents = db.documents.filter((d) => d.id !== id)
  return null
})
route('POST', '/docs/:id/generate', async ({ db, params, body }) => {
  const doc = db.documents.find((d) => d.id === Number(params[0])) ?? fail(404, 'Document not found.')
  const { profession = 'all', level = 2, count = 8 } = (body ?? {}) as { profession?: string; level?: Level; count?: number }
  await new Promise((r) => setTimeout(r, 1800)) // feels like the model thinking
  const pack: PackRow = { id: db.nextId++, company_id: COMPANY.id, document_id: doc.id, title: doc.title, profession, level, status: 'draft', kind: 'company', created_at: new Date().toISOString() }
  db.packs.push(pack)
  for (const q of generateFrom(doc, Math.max(3, Math.min(15, count)))) db.questions.push({ ...q, id: db.nextId++, pack_id: pack.id })
  return { pack_id: pack.id }
})

// Packs
route('GET', '/packs', ({ db }) => db.packs.filter((p) => p.kind === 'company').map((p) => packSummary(db, p)).reverse())
route('GET', '/packs/:id', ({ db, params }) => {
  const p = db.packs.find((x) => x.id === Number(params[0]) && x.kind === 'company') ?? fail(404, 'Pack not found.')
  return { ...packSummary(db, p), questions: db.questions.filter((q) => q.pack_id === p.id).map(questionOut) }
})
route('POST', '/packs/:id/approve', ({ db, params }) => {
  const p = db.packs.find((x) => x.id === Number(params[0])) ?? fail(404, 'Pack not found.')
  const qs = db.questions.filter((q) => q.pack_id === p.id)
  if (!qs.length) fail(400, 'This pack has no questions.')
  const bad = qs.filter((q) => !q.verified).length
  if (bad) fail(400, `${bad} question${bad === 1 ? ' has a quote' : 's have quotes'} we couldn’t find in the document. Fix or delete ${bad === 1 ? 'it' : 'them'} first.`)
  p.status = 'approved'
  return packSummary(db, p)
})
route('DELETE', '/packs/:id', ({ db, params }) => {
  const id = Number(params[0])
  db.questions = db.questions.filter((q) => q.pack_id !== id)
  db.assignments = db.assignments.filter((a) => a.pack_id !== id)
  db.packs = db.packs.filter((p) => p.id !== id)
  return null
})
route('PATCH', '/questions/:id', ({ db, params, body }) => {
  const q = db.questions.find((x) => x.id === Number(params[0])) ?? fail(404, 'Question not found.')
  const p = db.packs.find((x) => x.id === q.pack_id)!
  Object.assign(q, body as Partial<QuestionRow>)
  const doc = packDoc(db, p)
  q.verified = doc ? quoteFound(q.source_quote, doc.text) : true
  return questionOut(q)
})
route('DELETE', '/questions/:id', ({ db, params }) => {
  db.questions = db.questions.filter((q) => q.id !== Number(params[0]))
  return null
})
route('POST', '/questions/:id/regenerate', async ({ db, params }) => {
  const q = db.questions.find((x) => x.id === Number(params[0])) ?? fail(404, 'Question not found.')
  const doc = packDoc(db, db.packs.find((p) => p.id === q.pack_id)!) ?? fail(400, 'Only document questions can be regenerated.')
  await new Promise((r) => setTimeout(r, 1200))
  const used = new Set(db.questions.filter((x) => x.pack_id === q.pack_id).map((x) => x.source_quote))
  const pool = doc.text === POLICY_TEXT ? POLICY_QUESTIONS : sentencesOf(doc.text).map((s, i) => questionFromSentence(s, i, 'Uploaded document'))
  const next = pool.find((c) => !used.has(c.source_quote)) ?? pool[0]
  Object.assign(q, { ...next, type: q.type === next.type ? next.type : next.type, verified: quoteFound(next.source_quote, doc.text) })
  return questionOut(q)
})
route('POST', '/assignments', ({ db, body }) => {
  const { pack_id, team, due_date } = body as { pack_id: number; team: string; due_date: string }
  const p = db.packs.find((x) => x.id === Number(pack_id)) ?? fail(404, 'Pack not found.')
  if (p.status !== 'approved') fail(400, 'Approve the pack before assigning it.')
  if (!team || !/^\d{4}-\d{2}-\d{2}$/.test(due_date)) fail(400, 'Pick a team and a due date.')
  if (due_date < today()) fail(400, 'The due date can’t be in the past.')
  const a = { id: db.nextId++, pack_id: p.id, team, due_date }
  db.assignments.push(a)
  return a
})

// Play
const assignedPacks = (db: Db, u: UserRow) =>
  db.assignments
    .filter((a) => a.team === u.team || a.team === 'Everyone')
    .map((a) => ({ a, p: db.packs.find((p) => p.id === a.pack_id && p.status === 'approved') }))
    .filter((x): x is { a: AssignmentRow; p: PackRow } => !!x.p)
    .sort((x, y) => x.a.due_date.localeCompare(y.a.due_date))

route('GET', '/play/rounds', ({ db, query }) => {
  const u = getUser(db, query.get('user_id'))
  const eta = Math.max(5, Math.min(60, Number(query.get('eta')) || 10))
  const count = Math.max(1, Math.min(12, Math.floor(eta / 2.5)))
  const seen = new Set(db.answers.filter((a) => a.user_id === u.id).map((a) => a.question_id))
  const assigned = assignedPacks(db, u)
  const rounds: PlayRound[] = []
  const toRound = (q: QuestionRow, p: PackRow, kind: 'assigned' | 'news', due: string | null): PlayRound => ({
    id: q.id,
    type: q.type as QuestionType,
    scenario: q.scenario,
    question: q.question,
    options: shuffle(q.options.map((text, index) => ({ index, text }))),
    open_question: q.open_question,
    pack: { id: p.id, title: p.title, kind, due_date: due },
  })
  for (const { a, p } of assigned)
    for (const q of db.questions.filter((x) => x.pack_id === p.id && x.verified && !seen.has(x.id))) {
      if (rounds.length >= count) break
      if (!rounds.some((r) => r.id === q.id)) rounds.push(toRound(q, p, 'assigned', a.due_date))
    }
  const news = db.packs.find((p) => p.kind === 'news' && p.profession === u.profession) ?? db.packs.find((p) => p.kind === 'news' && p.profession === 'all')!
  for (const q of db.questions.filter((x) => x.pack_id === news.id && !seen.has(x.id))) {
    if (rounds.length >= count) break
    rounds.push(toRound(q, news, 'news', null))
  }
  return {
    rounds,
    assigned: assigned.map(({ a, p }) => {
      const qs = db.questions.filter((q) => q.pack_id === p.id && q.verified)
      return { pack_id: p.id, title: p.title, due_date: a.due_date, total: qs.length, done: qs.filter((q) => seen.has(q.id)).length }
    }),
  }
})

route('POST', '/play/answer', ({ db, body }) => {
  const b = body as { user_id: number; question_id: number; chosen: number; open_text?: string }
  const u = getUser(db, b.user_id)
  const q = db.questions.find((x) => x.id === Number(b.question_id)) ?? fail(404, 'Question not found.')
  const p = db.packs.find((x) => x.id === q.pack_id)!
  if (![0, 1, 2].includes(b.chosen)) fail(400, 'chosen must be 0, 1 or 2.')
  const repeat = db.answers.some((a) => a.user_id === u.id && a.question_id === q.id)
  const correct = b.chosen === q.best
  const secondPick = !correct && q.second_best !== null && b.chosen === q.second_best
  const open = b.open_text?.trim() && q.open_question ? gradeOpen(b.open_text) : null
  let points = 0
  if (!repeat) {
    const before = streakDays(db, u.id)
    if (correct) points += award(db, u, 'correct', POINTS.correct)
    else if (secondPick && u.level >= 2) points += award(db, u, 'second_best', POINTS.second)
    if (open) points += award(db, u, 'open', Math.min(5, Math.round(open.total / 2)))
    db.answers.push({ id: db.nextId++, user_id: u.id, question_id: q.id, chosen: b.chosen, correct, open_score: open?.total ?? null, points, created_at: new Date().toISOString() })
    if (before < 5 && streakDays(db, u.id) === 5) points += award(db, u, 'streak5', POINTS.streak5)
  }
  const doc = packDoc(db, p)
  const res: AnswerResponse = {
    correct,
    second_best_pick: secondPick,
    best: q.best,
    second_best: q.second_best,
    why: q.why,
    source_quote: q.source_quote,
    source_location: q.source_location,
    source_title: doc?.title ?? q.source_location,
    source_url: q.source_url ?? null,
    open,
    points,
    points_total: u.points,
    repeat,
  }
  return res
})

route('POST', '/play/finish', ({ db, body }) => {
  const b = body as { user_id: number; question_ids: number[] }
  const u = getUser(db, b.user_id)
  const reasons: string[] = []
  let bonus = 0
  const recentRide = db.points_log.some((p) => p.user_id === u.id && p.reason === 'ride' && Date.now() - Date.parse(p.created_at) < 30 * 60e3)
  if (!recentRide && b.question_ids.length) {
    const n = award(db, u, 'ride', POINTS.ride)
    if (n) {
      bonus += n
      reasons.push(`Finished the ride +${n}`)
    }
  }
  const seen = new Set(db.answers.filter((a) => a.user_id === u.id).map((a) => a.question_id))
  for (const { a, p } of assignedPacks(db, u)) {
    const qs = db.questions.filter((q) => q.pack_id === p.id && q.verified)
    const reason = `pack:${p.id}`
    if (qs.length && qs.every((q) => seen.has(q.id)) && today() <= a.due_date && !db.points_log.some((x) => x.user_id === u.id && x.reason === reason)) {
      const n = award(db, u, reason, POINTS.packOnTime)
      if (n) {
        bonus += n
        reasons.push(`${p.title} done before the due date +${n}`)
      }
    }
  }
  const res: FinishResponse = { bonus_points: bonus, bonus_reasons: reasons, points_total: u.points, streak_days: streakDays(db, u.id) }
  return res
})

// Rewards
route('GET', '/rewards', ({ db, query }) => {
  const uid = query.get('user_id')
  return { balance: uid ? getUser(db, uid).points : 0, rewards: db.rewards }
})
route('POST', '/rewards/:id/redeem', ({ db, params, body }) => {
  const u = getUser(db, (body as { user_id: number }).user_id)
  const r = db.rewards.find((x) => x.id === Number(params[0])) ?? fail(404, 'Reward not found.')
  if (r.stock <= 0) fail(409, 'This reward is out of stock.')
  if (u.points < r.cost_points) fail(400, `You need ${r.cost_points - u.points} more points for this.`)
  u.points -= r.cost_points
  r.stock -= 1
  if (r.title.startsWith('Unlock Leader')) u.level = 3
  const red = { id: db.nextId++, user_id: u.id, reward_id: r.id, code: code(), created_at: new Date().toISOString() }
  db.redemptions.push(red)
  return { code: red.code, balance: u.points, reward: r }
})
route('POST', '/rewards', ({ db, body }) => {
  const r = { ...(body as Omit<Reward, 'id'>), id: db.nextId++ }
  if (r.kind === 'sponsor' && !r.sponsor_name) r.sponsor_name = 'Demo partner'
  db.rewards.push(r)
  return r
})
route('PATCH', '/rewards/:id', ({ db, params, body }) => {
  const r = db.rewards.find((x) => x.id === Number(params[0])) ?? fail(404, 'Reward not found.')
  Object.assign(r, body as Partial<Reward>)
  return r
})
route('DELETE', '/rewards/:id', ({ db, params }) => {
  db.rewards = db.rewards.filter((r) => r.id !== Number(params[0]))
  return null
})
route('GET', '/redemptions', ({ db }) =>
  db.redemptions
    .map((d) => {
      const u = db.users.find((x) => x.id === d.user_id)
      const r = db.rewards.find((x) => x.id === d.reward_id)
      return { id: d.id, user_name: u?.name ?? 'Unknown', team: u?.team ?? '', reward_title: r?.title ?? 'Removed reward', cost_points: r?.cost_points ?? 0, code: d.code, created_at: d.created_at }
    })
    .reverse(),
)

// Dashboard
route('GET', '/dashboard', ({ db }) => {
  const now = Date.now()
  const companyQ = new Set(db.questions.filter((q) => db.packs.find((p) => p.id === q.pack_id)?.kind === 'company').map((q) => q.id))
  const inWindow = (iso: string, from: number, to: number) => {
    const t = Date.parse(iso)
    return t > now - from * DAY && t <= now - to * DAY
  }
  const answersIn = (from: number, to: number) => db.answers.filter((a) => inWindow(a.created_at, from, to))
  const tile = (f: (from: number, to: number) => number) => ({ value: f(7, 0), previous: f(14, 7) })
  const avg = (as: AnswerRow[]) => (as.length ? Math.round((as.filter((a) => a.correct).length / as.length) * 100) : 0)
  const employees = db.users.filter((u) => u.role === 'employee')
  const byUser = (id: number) => db.users.find((u) => u.id === id)!

  const companyAnswers = db.answers.filter((a) => companyQ.has(a.question_id))
  const group = <K,>(items: AnswerRow[], key: (a: AnswerRow) => K) => {
    const m = new Map<K, AnswerRow[]>()
    for (const a of items) m.set(key(a), [...(m.get(key(a)) ?? []), a])
    return m
  }
  const res: Dashboard = {
    tiles: {
      active_players: tile((f, t) => new Set(answersIn(f, t).map((a) => a.user_id)).size),
      sessions_completed: tile((f, t) => db.points_log.filter((p) => p.reason === 'ride' && inWindow(p.created_at, f, t)).length),
      avg_score: tile((f, t) => avg(answersIn(f, t))),
      points_earned: tile((f, t) => db.points_log.filter((p) => inWindow(p.created_at, f, t)).reduce((s, p) => s + p.points, 0)),
    },
    score_by_team: [...group(db.answers, (a) => byUser(a.user_id).team)].map(([team, as]) => ({ team, score: avg(as), answers: as.length })).sort((a, b) => b.score - a.score),
    score_by_pack: [...group(companyAnswers, (a) => db.questions.find((q) => q.id === a.question_id)!.pack_id)].map(([pack_id, as]) => ({ pack_id, title: db.packs.find((p) => p.id === pack_id)!.title, score: avg(as), answers: as.length })),
    weakest: [...group(companyAnswers, (a) => a.question_id)]
      .map(([qid, as]) => {
        const q = db.questions.find((x) => x.id === qid)!
        return { question_id: qid, question: q.question.length > 20 ? q.question : `${q.scenario.slice(0, 80)}… ${q.question}`, pack_title: db.packs.find((p) => p.id === q.pack_id)!.title, miss_rate: 100 - avg(as), answers: as.length }
      })
      .sort((a, b) => b.miss_rate - a.miss_rate || b.answers - a.answers)
      .slice(0, 5),
    leaderboard: [...employees].sort((a, b) => b.points - a.points).slice(0, 10).map((u) => ({ user_id: u.id, name: u.name, team: u.team, points: u.points })),
    completion: db.assignments.map((a) => {
      const p = db.packs.find((x) => x.id === a.pack_id)!
      const qs = db.questions.filter((q) => q.pack_id === p.id && q.verified).map((q) => q.id)
      const people = employees.filter((u) => a.team === 'Everyone' || u.team === a.team)
      let done = 0
      let inProgress = 0
      for (const u of people) {
        const n = qs.filter((qid) => db.answers.some((x) => x.user_id === u.id && x.question_id === qid)).length
        if (qs.length && n === qs.length) done++
        else if (n > 0) inProgress++
      }
      return { assignment_id: a.id, pack_title: p.title, team: a.team, due_date: a.due_date, done, in_progress: inProgress, not_started: people.length - done - inProgress }
    }),
  }
  return res
})

// ---------- fetch interceptor ----------
export function installMock() {
  const realFetch = window.fetch.bind(window)
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.origin)
    if (!url.pathname.startsWith('/api/')) return realFetch(input, init)
    const method = (init?.method ?? 'GET').toUpperCase()
    const match = routes.find(([m, re]) => m === method && re.test(url.pathname))
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 300))
    const json = (status: number, data: unknown) => new Response(data === null ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
    if (!match) return json(404, { message: `Mock has no route for ${method} ${url.pathname}` })
    const db = load()
    try {
      const raw = init?.body
      const body = raw instanceof FormData ? raw : typeof raw === 'string' ? JSON.parse(raw) : undefined
      const data = await match[2]({ db, params: url.pathname.match(match[1])!.slice(1), query: url.searchParams, body })
      save(db)
      return data === null ? new Response(null, { status: 204 }) : json(200, data)
    } catch (e) {
      if (e instanceof MockError) return json(e.status, { message: e.message })
      console.error(e)
      return json(500, { message: 'Mock server error' })
    }
  }
  console.info('%cUpshift mock API on', 'font-weight:bold', '— reset with localStorage.removeItem("upshift.mock.v1")')
}
