import { useEffect, useState } from 'react'
import { evaluateAnswers, type EvaluateResponse } from '../lib/api'
import { LEVEL_NAME, type Level, type Profession } from '../lib/professions'
import type { RideResult } from './Round'

interface Props {
  prof: Profession
  profession: string
  level: Level
  eta: number
  ride: RideResult
  onAgain(): void
  onChange(): void
}

export function GearCard({ prof, profession, level, eta, ride, onAgain, onChange }: Props) {
  const [summary, setSummary] = useState<EvaluateResponse | null>(null)
  const [summaryFailed, setSummaryFailed] = useState(false)

  const score = ride.results.reduce((s, r) => s + r.score, 0)
  const max = ride.results.length * 10
  const best = [...ride.results].sort((a, b) => b.score - a.score)[0]
  const weakest = [...ride.results].sort((a, b) => a.score - b.score)[0]

  // One summary pass over the whole ride for strengths and what to work on next
  useEffect(() => {
    const ctrl = new AbortController()
    evaluateAnswers(
      {
        profession,
        answers: ride.questions.map((q, i) => ({ id: q.id, question: q.question, answer: ride.answers[i] ?? '' })),
      },
      ctrl.signal,
    )
      .then(setSummary)
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setSummaryFailed(true)
      })
    return () => ctrl.abort()
  }, [profession, ride])

  const loading = !summary && !summaryFailed
  const insight = summary?.strengths?.[0] ?? best?.feedback
  const move = summary?.improvements?.[0] ?? weakest?.idealAnswer
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <section className="screen">
      <div className="hero">
        <p className="hello">You arrived</p>
        <h1 className="who swap">{prof.name}</h1>
      </div>
      <div className="gcard">
        <div className="glow" aria-hidden="true" />
        <div className="lab">
          Gear Card · {LEVEL_NAME[level]} · {date}
        </div>
        <div className="score">
          {score}
          <small> / {max}</small>
        </div>
        <div className="lab">{eta} minutes of traffic turned into practice</div>
        {summary?.summary && <p className="summary">{summary.summary}</p>}
        <div className="row">
          <b>Best insight</b>
          {loading ? <span className="skel" /> : <span>{insight}</span>}
        </div>
        <div className="row">
          <b>Tomorrow’s move</b>
          {loading ? <span className="skel" /> : <span>{move}</span>}
        </div>
      </div>
      <button className="go" type="button" onClick={onAgain}>
        Ride again
      </button>
      <button className="link" type="button" onClick={onChange}>
        Change profession
      </button>
    </section>
  )
}
