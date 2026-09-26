import { useEffect, useState, type RefObject } from 'react'
import type { BloomHandle } from '../components/Bloom'
import { Kinetic } from '../components/Kinetic'
import { Motif } from '../components/Motif'
import { ProfessionPicker } from '../components/ProfessionPicker'
import { evaluateAnswers, generateQuestions, type EvaluateResponse, type OptionId, type Question } from '../lib/api'
import {
  LEVEL_DIFFICULTY,
  WORD_DELAY_MS,
  professionForTrack,
  roundsForEta,
  type Level,
  type Profession,
  type Track,
} from '../lib/professions'
import { speak, stopSpeaking } from '../lib/speech'

export interface RideResult {
  questions: Question[]
  evaluation: EvaluateResponse
}

interface Props {
  prof: Profession
  shown: Profession
  level: Level
  track: Track
  eta: number
  voice: boolean
  bloom: RefObject<BloomHandle | null>
  onChangeProf(id: string): void
  onPreview(id: string | null): void
  onProgress(target: number): void
  onArrive(result: RideResult): void
}

const OPTION_KEYS: OptionId[] = ['A', 'B', 'C', 'D']

export function Round(props: Props) {
  const { prof, shown, level, track, eta, voice, onProgress, onArrive } = props
  const count = roundsForEta(eta)
  const profession = professionForTrack(prof, track)

  const [quizId, setQuizId] = useState<string | null>(null)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [idx, setIdx] = useState(0)
  const [picks, setPicks] = useState<Record<number, OptionId>>({})
  const [grading, setGrading] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)

  // Load this ride's rounds (the component remounts when the profession changes)
  useEffect(() => {
    const ctrl = new AbortController()
    generateQuestions({ profession, count, difficulty: LEVEL_DIFFICULTY[level] }, ctrl.signal)
      .then((r) => {
        if (!r.questions?.length) throw new Error('No rounds came back. Try again.')
        setQuizId(r.quizId)
        setQuestions(r.questions.slice(0, count))
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setLoadError(e.message)
      })
    return () => ctrl.abort()
  }, [profession, count, level, attempt])

  const q = questions?.[idx]
  const picked = q ? picks[q.id] : undefined
  const isLast = questions ? idx === questions.length - 1 : false

  // Read each round and its options aloud (everything spoken is also on screen)
  useEffect(() => {
    if (q && voice) {
      const options = q.options.map((o) => `${o.id}: ${o.text}.`).join(' ')
      speak(`${q.question} ${options}`, level === 3 ? 1.1 : 1)
    }
    return () => stopSpeaking()
  }, [q, voice, level])

  function pick(id: OptionId) {
    if (!q || grading) return
    setPicks((p) => ({ ...p, [q.id]: id }))
  }

  // Keyboard: A-D (or 1-4) picks an option
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || (e.target as HTMLElement)?.closest('input, textarea, [role="listbox"]')) return
      const key = e.key.toUpperCase()
      const byLetter = OPTION_KEYS.indexOf(key as OptionId)
      const byNumber = ['1', '2', '3', '4'].indexOf(key)
      const i = byLetter >= 0 ? byLetter : byNumber
      if (i >= 0 && q?.options[i]) pick(q.options[i].id)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  })

  async function submit() {
    if (!questions || !quizId || grading) return
    setGrading(true)
    setGradeError(null)
    try {
      const answers = questions
        .filter((x) => picks[x.id])
        .map((x) => ({ questionId: x.id, selectedOption: picks[x.id] }))
      const evaluation = await evaluateAnswers({ quizId, answers })
      onArrive({ questions, evaluation })
    } catch (e) {
      setGradeError((e as Error).message)
    } finally {
      setGrading(false)
    }
  }

  function next() {
    if (!picked) return
    stopSpeaking()
    onProgress(0.12 + 0.8 * ((idx + 1) / questions!.length))
    if (isLast) {
      void submit()
      return
    }
    setIdx((i) => i + 1)
    scrollTo(0, 0)
  }

  const per = WORD_DELAY_MS[level]

  return (
    <section className="screen">
      <div className="rtop">
        <ProfessionPicker label="Change profession" value={prof.id} onChange={props.onChangeProf} onPreview={props.onPreview} compact />
      </div>
      <Motif motif={shown.motif} height={70} />

      {!questions && !loadError && (
        <div className="panel" aria-live="polite" aria-busy="true">
          <span className="kind">Getting your rounds ready</span>
          <div className="skel" style={{ width: '90%' }} />
          <div className="skel" style={{ width: '70%' }} />
          <div className="skel tall" />
          <p className="hint">Picking {count} {count === 1 ? 'round' : 'rounds'} for a {prof.name.toLowerCase()} on a {eta}-minute ride…</p>
        </div>
      )}

      {loadError && (
        <div className="panel" role="alert">
          <p className="q">Couldn’t load your rounds</p>
          <p className="hint">{loadError}</p>
          <button className="go" type="button" onClick={() => {
              setLoadError(null)
              setAttempt((a) => a + 1)
            }}>
            Try again
          </button>
        </div>
      )}

      {q && (
        <>
          <div className="panel" key={q.id}>
            <span className="kind">
              Round {idx + 1} of {questions!.length}
              {q.topic ? ` · ${q.topic}` : ''}
            </span>
            <Kinetic className="q" text={q.question} delay={120} per={per * 1.3} />

            <div className="opts" role="group" aria-label="Choose one answer">
              {q.options.map((o) => (
                <button
                  key={o.id}
                  className="opt"
                  type="button"
                  aria-pressed={picked === o.id}
                  disabled={grading}
                  onClick={() => pick(o.id)}
                >
                  <span className="opt-id" aria-hidden="true">{o.id}</span>
                  <span className="opt-text">{o.text}</span>
                </button>
              ))}
            </div>
            <p className="hint" aria-live="polite">
              {picked ? `You picked ${picked}. You can still change it.` : 'Tap an answer, or press A–D.'}
            </p>

            {gradeError && (
              <p className="coach err" role="alert">
                {gradeError}
              </p>
            )}
          </div>

          <button className="go" type="button" disabled={!picked || grading} onClick={isLast && gradeError ? submit : next}>
            {grading ? <span className="spin" aria-hidden="true" /> : null}
            {grading ? 'Checking…' : isLast ? (gradeError ? 'Try again' : 'Arrive') : 'Next round'}
          </button>
        </>
      )}
    </section>
  )
}
