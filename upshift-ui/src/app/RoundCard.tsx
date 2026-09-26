// One round: scenario + question, three options (tap, key or voice), optional open answer, reveal.
import { motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../api/client'
import type { AnswerResponse, Level, PlayRound } from '../api/types'
import { Kinetic } from '../components/Kinetic'
import { PICK_TONE, WORD_DELAY_MS } from '../lib/professions'
import { canListen, parseChoice, speak, stopSpeaking, useHoldToTalk } from '../lib/speech'
import { reducedMotion } from '../lib/theme'
import { useApp } from './context'

// Company packs have three options; backend news rounds can have four
const KEYS = ['A', 'B', 'C', 'D']
const RUBRIC_LABELS = [
  ['task_fit', 'Right task for AI'],
  ['context', 'Gave it context'],
  ['verification', 'Checked the output'],
  ['human_line', 'Kept the human call'],
  ['data_care', 'Cared for data'],
] as const

type Phase = 'choose' | 'open' | 'sending' | 'done'

interface Props {
  round: PlayRound
  index: number
  total: number
  userId: number
  level: Level
  onAnswered(result: AnswerResponse): void
  onNext(): void
}

// "Right call." / "Better option: B." — plus a nod when their pick was the reasonable second choice
function coachLead(tone: { good: string; miss: string }, r: AnswerResponse, bestKey: string) {
  if (r.correct) return tone.good
  return `${tone.miss} ${bestKey}.${r.second_best_pick ? ' Yours is also reasonable.' : ''}`
}

const words = (s: string) => s.split(/\s+/).filter(Boolean).length

export function RoundCard({ round, index, total, userId, level, onAnswered, onNext }: Props) {
  const { voice, bloomAt } = useApp()
  const [phase, setPhase] = useState<Phase>('choose')
  const [picked, setPicked] = useState<number | null>(null)
  const [openText, setOpenText] = useState('')
  const [result, setResult] = useState<AnswerResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const optRefs = useRef<(HTMLButtonElement | null)[]>([])
  const coachRef = useRef<HTMLDivElement>(null)
  const hasOpen = round.type === 'ai_move' && !!round.open_question
  const tone = PICK_TONE[level]
  const isLast = index === total - 1

  // Words fade up one by one, then the options rise in (DESIGN.md §3)
  const per = WORD_DELAY_MS[level]
  const qStart = 120 + words(round.scenario) * per
  const optStart = qStart + words(round.question) * per * 1.3

  // Read the round aloud (everything spoken is also on screen)
  useEffect(() => {
    if (voice) speak(`${round.scenario} ${round.question} ${round.options.map((o, k) => `${KEYS[k]}: ${o.text}.`).join(' ')}`, level === 3 ? 1.1 : 1)
    return () => stopSpeaking()
  }, [round, voice, level])

  const submit = useCallback(
    async (k: number, text?: string) => {
      setPhase('sending')
      setError(null)
      try {
        const r = await api.answer({ user_id: userId, question_id: round.id, chosen: round.options[k].index, open_text: text?.trim() || undefined })
        setResult(r)
        setPhase('done')
        onAnswered(r)
        const bestK = round.options.findIndex((o) => o.index === r.best)
        const lead = coachLead(tone, r, KEYS[bestK])
        if (voice) speak(`${lead} ${r.why}`, level === 3 ? 1.1 : 1)
        requestAnimationFrame(() => {
          const rc = optRefs.current[bestK]?.getBoundingClientRect()
          if (rc && !reducedMotion()) bloomAt(rc.left + rc.width / 2, rc.top + rc.height / 2)
          coachRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        })
      } catch (e) {
        setError((e as Error).message)
        setPhase(hasOpen ? 'open' : 'choose')
      }
    },
    [userId, round, onAnswered, tone, voice, level, bloomAt, hasOpen],
  )

  const pick = useCallback(
    (k: number) => {
      if (phase !== 'choose' && phase !== 'open') return
      if (k < 0 || k >= round.options.length) return
      setPicked(k)
      if (hasOpen) setPhase('open')
      else submit(k)
    },
    [phase, hasOpen, submit, round.options.length],
  )

  // Voice: in choose mode "A/B/C", in open mode the transcript becomes the answer
  const onSpoken = useCallback(
    (text: string) => {
      if (phase === 'open') setOpenText((t) => (t ? `${t.trimEnd()} ${text}` : text))
      else if (phase === 'choose') {
        const k = parseChoice(text)
        if (k !== null) pick(k)
      }
    },
    [phase, pick],
  )
  const mic = useHoldToTalk(onSpoken)

  // Keyboard: A, B, C (or D) picks an option (not while typing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return
      const k = KEYS.indexOf(e.key.toUpperCase())
      if (k >= 0) pick(k)
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [pick])

  const bestK = result ? round.options.findIndex((o) => o.index === result.best) : -1
  const secondK = result && result.second_best !== null ? round.options.findIndex((o) => o.index === result.second_best) : -1
  // "A, B or C", or "A, B, C or D" for four-option rounds
  const letters = `${KEYS.slice(0, round.options.length - 1).join(', ')} or ${KEYS[round.options.length - 1]}`
  const hint = mic.error
    ? mic.error
    : mic.listening
      ? 'Listening… release when you’re done.'
      : !canListen()
        ? phase === 'open'
          ? 'Type your answer.'
          : `Tap an answer, or press ${letters}.`
        : phase === 'open'
          ? 'Hold the mic and say how you’d do it, or type.'
          : `Hold the mic and say ${letters}, or tap.`

  const Mic = (
    <div className={mic.listening ? 'talk on' : 'talk'}>
      <button
        className="mic"
        type="button"
        aria-label={phase === 'open' ? 'Hold to answer by voice' : `Hold and say ${letters}`}
        aria-pressed={mic.listening}
        disabled={phase === 'sending'}
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
          <path fill="currentColor" d="M12 15a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.9V21h2v-2.1A7 7 0 0 0 19 12h-2Z" />
        </svg>
      </button>
      <div className="wave" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => (
          <i key={i} style={{ animationDelay: `${i * 70}ms` }} />
        ))}
      </div>
    </div>
  )

  return (
    <>
      <div className="panel">
        <div className="chips">
          <span className="kind">
            {round.type === 'ai_move' ? 'AI Move' : 'Decide'} · Round {index + 1} of {total}
          </span>
          <span className="chip">{round.pack.kind === 'news' ? 'Today’s news' : round.pack.title}</span>
        </div>
        <Kinetic className="scn" text={round.scenario} delay={120} per={per} />
        <Kinetic className="q" text={round.question} delay={qStart} per={per * 1.3} />

        <div className="opts" role="group" aria-label="Choose one answer">
          {round.options.map((o, k) => {
            const state = !result ? (picked === k ? 'picked' : '') : k === bestK ? 'best' : k === secondK ? 'second' : 'dim'
            return (
              <motion.button
                key={o.index}
                ref={(el) => {
                  optRefs.current[k] = el
                }}
                type="button"
                className={`opt ${state}`}
                aria-pressed={picked === k}
                disabled={phase === 'sending' || phase === 'done'}
                onClick={() => pick(k)}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion() ? 0 : (optStart + k * 100) / 1000, type: 'spring', stiffness: 260, damping: 22 }}
                whileTap={{ scale: 0.98 }}
              >
                <span className="k">{KEYS[k]}</span>
                <span className="tx">{o.text}</span>
                {result && k === bestK && <span className="tag">✓ Best</span>}
                {result && k === secondK && <span className="tag soft">Also reasonable</span>}
                {result && picked === k && k !== bestK && k !== secondK && <span className="tag soft">Your pick</span>}
              </motion.button>
            )
          })}
        </div>

        {phase === 'choose' && (
          <>
            {Mic}
            <p className="hint" aria-live="polite">
              {hint}
            </p>
          </>
        )}

        {(phase === 'open' || (phase === 'sending' && hasOpen)) && (
          <div className="open">
            <p className="open-q">
              <b>Bonus, up to 5 points:</b> {round.open_question}
            </p>
            <label className="sr-only" htmlFor={`open-${round.id}`}>
              Your answer
            </label>
            <textarea
              id={`open-${round.id}`}
              rows={3}
              value={openText + (mic.interim ? (openText ? ' ' : '') + mic.interim : '')}
              onChange={(e) => setOpenText(e.target.value)}
              readOnly={mic.listening || phase === 'sending'}
              placeholder="Say it or type it, about 20 seconds"
            />
            {Mic}
            <p className="hint" aria-live="polite">
              {hint}
            </p>
            <button type="button" className="text-btn" disabled={phase === 'sending'} onClick={() => picked !== null && submit(picked)}>
              Skip the bonus
            </button>
          </div>
        )}

        {error && (
          <p className="alert bad" role="alert">
            {error}
          </p>
        )}

        {result && (
          <div className="reveal" ref={coachRef} aria-live="polite">
            <p className="coach">
              <b>
                {coachLead(tone, result, KEYS[bestK])}
              </b>{' '}
              {result.why}
              {result.points > 0 && <span className="earned"> +{result.points} points</span>}
              {result.repeat && <span className="muted"> (Already answered before, so no points this time.)</span>}
            </p>

            {result.open && (
              <div className="grade-box">
                <div className="grade-head">
                  <b>Your answer</b>
                  <span className="grade-total">
                    {result.open.total}
                    <small>/10</small>
                  </span>
                </div>
                <ul className="rubric">
                  {RUBRIC_LABELS.map(([key, label]) => {
                    const v = result.open!.rubric[key]
                    return (
                      <li key={key}>
                        <span className="grow">{label}</span>
                        <span className="bars" aria-hidden="true">
                          <i className={v >= 1 ? 'on' : ''} />
                          <i className={v >= 2 ? 'on' : ''} />
                        </span>
                        <span className="num rubric-v">{v}/2</span>
                      </li>
                    )
                  })}
                </ul>
                {result.open.missed_check && (
                  <p className="missed">
                    <b>Missed check:</b> {result.open.missed_check}
                  </p>
                )}
                <div className="stronger">
                  <b>✓ Stronger answer</b>
                  <p>{result.open.stronger_answer}</p>
                </div>
              </div>
            )}

            <p className="src">
              {result.source_url ? (
                <>
                  Source:{' '}
                  <a href={result.source_url} target="_blank" rel="noopener noreferrer">
                    {result.source_location}
                  </a>
                </>
              ) : (
                <>
                  From: {result.source_title}
                  {result.source_location && result.source_location !== result.source_title ? `, ${result.source_location}` : ''}
                </>
              )}
              {result.source_quote && <q className="quote">{result.source_quote}</q>}
            </p>
          </div>
        )}
      </div>

      {phase === 'open' || (phase === 'sending' && hasOpen) ? (
        <button className="go go-sticky" type="button" disabled={!openText.trim() || phase === 'sending' || mic.listening} onClick={() => picked !== null && submit(picked, openText)}>
          {phase === 'sending' ? <span className="spin" aria-hidden="true" /> : null}
          {phase === 'sending' ? 'Checking…' : 'Submit answer'}
        </button>
      ) : (
        <button className="go go-sticky" type="button" disabled={phase !== 'done'} onClick={onNext}>
          {phase === 'sending' ? <span className="spin" aria-hidden="true" /> : null}
          {phase === 'sending' ? 'Checking…' : phase === 'done' ? (isLast ? 'Arrive' : 'Next round') : 'Pick an answer'}
        </button>
      )}
    </>
  )
}
