import { Sources } from '../components/Sources'
import type { Option, OptionId } from '../lib/api'
import { COACH_TONE, LEVEL_NAME, type Level, type Profession } from '../lib/professions'
import type { RideResult } from './Round'

interface Props {
  prof: Profession
  level: Level
  eta: number
  ride: RideResult
  onAgain(): void
  onChange(): void
}

function optionText(options: Option[], id: OptionId | null) {
  return options.find((o) => o.id === id)?.text
}

export function GearCard({ prof, level, eta, ride, onAgain, onChange }: Props) {
  const { correct, totalQuestions, scorePercent, results } = ride.evaluation
  const tone = COACH_TONE[level]
  const lead = scorePercent >= 80 ? tone.good : scorePercent >= 50 ? tone.ok : tone.low

  const best = results.find((r) => r.correct)
  const weakest = results.find((r) => !r.correct)
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
          {correct}
          <small> / {totalQuestions}</small>
        </div>
        <div className="lab">{eta} minutes of traffic turned into practice</div>
        <p className="summary">
          <b>{lead}</b> You got {scorePercent}% right.
        </p>
        <div className="row">
          <b>Best insight</b>
          <span>{best ? best.explanation : 'Every round is a lesson. Check the answers below.'}</span>
        </div>
        <div className="row">
          <b>Tomorrow’s move</b>
          <span>{weakest ? weakest.explanation : 'Clean sweep. Try the next level up.'}</span>
        </div>
      </div>

      <div className="panel">
        <span className="kind">Your rounds</span>
        <ol className="review">
          {results.map((r) => (
            <li key={r.questionId} className={r.correct ? 'right' : 'wrong'}>
              <p className="review-q">{r.question}</p>
              <p className="review-a">
                <span className="mark" aria-hidden="true">{r.correct ? '✓' : '✗'}</span>
                {r.selectedOption ? (
                  <>
                    You picked <b>{r.selectedOption}</b>: {optionText(r.options, r.selectedOption)}
                  </>
                ) : (
                  'Not answered'
                )}
                <span className="sr-only">{r.correct ? ' (correct)' : ' (incorrect)'}</span>
              </p>
              {!r.correct && (
                <p className="review-a">
                  Answer <b>{r.correctAnswer}</b>: {optionText(r.options, r.correctAnswer)}
                </p>
              )}
              <p className="hint">{r.explanation}</p>
            </li>
          ))}
        </ol>
        <Sources sources={ride.evaluation.sources ?? []} />
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
