import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { BloomHandle } from '../components/Bloom'
import { Kinetic } from '../components/Kinetic'
import { Motif } from '../components/Motif'
import { ProfessionPicker } from '../components/ProfessionPicker'
import { evaluateAnswers, generateQuestions, type Question, type QuestionResult } from '../lib/api'
import {
  COACH_TONE,
  LEVEL_DIFFICULTY,
  WORD_DELAY_MS,
  professionForTrack,
  roundsForEta,
  type Level,
  type Profession,
  type Track,
} from '../lib/professions'
import { canListen, speak, stopSpeaking, useHoldToTalk } from '../lib/speech'

export interface RideResult {
  questions: Question[]
  answers: string[]
  results: QuestionResult[]
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

export function Round(props: Props) {
  const { prof, shown, level, track, eta, voice, bloom, onProgress, onArrive } = props
  const count = roundsForEta(eta)
  const profession = professionForTrack(prof, track)

  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [idx, setIdx] = useState(0)
  const [answer, setAnswer] = useState('')
  const [answers, setAnswers] = useState<string[]>([])
  const [results, setResults] = useState<QuestionResult[]>([])
  const [grading, setGrading] = useState(false)
  const [gradeError, setGradeError] = useState<string | null>(null)
  const coachRef = useRef<HTMLDivElement>(null)

  // Load this ride's rounds (the component remounts when the profession changes)
  useEffect(() => {
    const ctrl = new AbortController()
    generateQuestions({ profession, count, difficulty: LEVEL_DIFFICULTY[level] }, ctrl.signal)
      .then((r) => {
        if (!r.questions?.length) throw new Error('No rounds came back. Try again.')
        setQuestions(r.questions.slice(0, count))
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setLoadError(e.message)
      })
    return () => ctrl.abort()
  }, [profession, count, level, attempt])

  const q = questions?.[idx]
  const result = results[idx]
  const isLast = questions ? idx === questions.length - 1 : false

  // Read each round aloud (everything spoken is also on screen)
  useEffect(() => {
    if (q && voice) speak(q.question, level === 3 ? 1.1 : 1)
    return () => stopSpeaking()
  }, [q, voice, level])

  const appendSpoken = useCallback((text: string) => {
    if (text) setAnswer((a) => (a ? `${a.trimEnd()} ${text}` : text))
  }, [])
  const mic = useHoldToTalk(appendSpoken)

  async function check() {
    if (!q || !answer.trim() || grading) return
    mic.stop()
    setGrading(true)
    setGradeError(null)
    try {
      const r = await evaluateAnswers({ profession, answers: [{ id: q.id, question: q.question, answer: answer.trim() }] })
      const res = r.results?.[0]
      if (!res) throw new Error('The coach didn’t send feedback. Try again.')
      setAnswers((a) => [...a.slice(0, idx), answer.trim()])
      setResults((rs) => [...rs.slice(0, idx), res])
      onProgress(0.12 + 0.8 * ((idx + 1) / questions!.length))
      const tone = COACH_TONE[level]
      const lead = res.score >= 8 ? tone.good : res.score >= 5 ? tone.ok : tone.low
      if (voice) speak(`${lead} ${res.feedback}`, level === 3 ? 1.1 : 1)
      requestAnimationFrame(() => {
        const rc = coachRef.current?.getBoundingClientRect()
        if (rc) bloom.current?.bloom(rc.left + rc.width / 2, rc.top + 20, [prof.tint, prof.tint2, getComputedStyle(document.documentElement).getPropertyValue('--deep').trim()])
        coachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      })
    } catch (e) {
      setGradeError((e as Error).message)
    } finally {
      setGrading(false)
    }
  }

  function next() {
    stopSpeaking()
    if (isLast) {
      onArrive({ questions: questions!, answers, results })
      return
    }
    setIdx((i) => i + 1)
    setAnswer('')
    setGradeError(null)
    scrollTo(0, 0)
  }

  const per = WORD_DELAY_MS[level]
  const tone = COACH_TONE[level]
  const hint = mic.error
    ? mic.error
    : mic.listening
      ? 'Listening… release when you’re done.'
      : canListen()
        ? 'Hold the mic and talk it through, or type.'
        : 'Voice isn’t supported in this browser. Type your answer.'

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

            <div className="answer">
              <label className="lab" htmlFor="answer">
                Your answer
              </label>
              <textarea
                id="answer"
                rows={4}
                value={answer + (mic.interim ? (answer ? ' ' : '') + mic.interim : '')}
                onChange={(e) => setAnswer(e.target.value)}
                readOnly={!!result || mic.listening}
                placeholder="Say it out loud or type it here"
              />
            </div>

            {!result && (
              <>
                <div className={mic.listening ? 'talk on' : 'talk'}>
                  <button
                    className="mic"
                    type="button"
                    aria-label="Hold to answer by voice"
                    aria-pressed={mic.listening}
                    disabled={grading}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      mic.start()
                    }}
                    onPointerUp={mic.stop}
                    onPointerLeave={mic.stop}
                    onPointerCancel={mic.stop}
                    onKeyDown={(e) => {
                      if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && !mic.listening) {
                        e.preventDefault()
                        mic.start()
                      }
                    }}
                    onKeyUp={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') mic.stop()
                    }}
                  >
                    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="currentColor"
                        d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12h-2Z"
                      />
                    </svg>
                  </button>
                  <div className="wave" aria-hidden="true">
                    {Array.from({ length: 10 }, (_, i) => (
                      <i key={i} style={{ animationDelay: `${i * 70}ms` }} />
                    ))}
                  </div>
                </div>
                <p className="hint" aria-live="polite">
                  {hint}
                </p>
              </>
            )}

            {gradeError && (
              <p className="coach err" role="alert">
                {gradeError}
              </p>
            )}

            {result && (
              <div className="coach-wrap" ref={coachRef} aria-live="polite">
                <div className="grade">
                  <span className="grade-score">
                    {result.score}
                    <small>/10</small>
                  </span>
                  <b>{result.score >= 8 ? tone.good : result.score >= 5 ? tone.ok : tone.low}</b>
                </div>
                <p className="coach">{result.feedback}</p>
                {result.idealAnswer && (
                  <div className="stronger">
                    <b>✓ Stronger answer</b>
                    <p>{result.idealAnswer}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {result ? (
            <button className="go" type="button" onClick={next}>
              {isLast ? 'Arrive' : 'Next round'}
            </button>
          ) : (
            <button className="go" type="button" disabled={!answer.trim() || grading || mic.listening} onClick={check}>
              {grading ? <span className="spin" aria-hidden="true" /> : null}
              {grading ? 'Checking…' : 'Check my answer'}
            </button>
          )}
        </>
      )}
    </section>
  )
}
