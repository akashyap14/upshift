// Arrival card: score, points this ride (answers + bonuses), balance, best insight, tomorrow's AI move.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { api } from '../api/client'
import { useSession } from '../api/session'
import type { FinishResponse } from '../api/types'
import { byId, COACH_TONE, LEVEL_NAME, PROFESSIONS } from '../lib/professions'
import { reducedMotion } from '../lib/theme'
import { useApp } from './context'
import type { Played } from './Ride'

interface Props {
  played: Played[]
  eta: number
  onBonus(points: number, total: number): void
  onAgain(): void
}

export function GearCard({ played, eta, onBonus, onAgain }: Props) {
  const { user } = useSession()
  const { bloomAt } = useApp()
  const [finish, setFinish] = useState<FinishResponse | null>(null)
  const [finishError, setFinishError] = useState<string | null>(null)
  const sent = useRef(false)

  // Ride bonus, pack-on-time and streak bonuses are awarded once, on arrival
  useEffect(() => {
    if (sent.current) return
    sent.current = true
    api
      .finish({ user_id: user!.id, question_ids: played.map((p) => p.round.id) })
      .then((f) => {
        setFinish(f)
        onBonus(f.bonus_points, f.points_total)
      })
      .catch((e: Error) => setFinishError(e.message))
    if (!reducedMotion()) setTimeout(() => bloomAt(innerWidth / 2, innerHeight * 0.35), 300)
  }, [user, played, onBonus, bloomAt])

  const prof = byId[user!.profession] ?? PROFESSIONS[0]
  const answered = played.length
  const correct = played.filter((p) => p.result.correct).length
  const pct = answered ? Math.round((correct / answered) * 100) : 0
  const tone = COACH_TONE[user!.level]
  const lead = pct >= 80 ? tone.good : pct >= 50 ? tone.ok : tone.low
  const answerPoints = played.reduce((s, p) => s + p.result.points, 0)
  const ridePoints = answerPoints + (finish?.bonus_points ?? 0)

  const insight = (played.find((p) => p.result.correct) ?? played[0])?.result.why
  const aiMove = played.find((p) => p.round.type === 'ai_move')
  const move = aiMove ? (aiMove.result.open?.stronger_answer ?? aiMove.result.why) : null
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
          Gear Card · {LEVEL_NAME[user!.level]} · {date}
        </div>
        <div className="score-line">
          <div className="score">
            {correct}
            <small> / {answered}</small>
          </div>
          <div className="pct" aria-label={`${pct} percent correct`}>
            <b>{pct}%</b>
            <span>correct</span>
          </div>
        </div>
        <p className="summary">
          <b>{lead}</b> {eta} minutes of traffic turned into practice.
        </p>

        <div className="points-row" aria-live="polite">
          <div>
            <b className="num">+{ridePoints}</b>
            <span>points this ride</span>
          </div>
          <div>
            <b className="num">{finish?.points_total ?? user!.points}</b>
            <span>total balance</span>
          </div>
          <div>
            <b className="num">{finish ? finish.streak_days : '–'}</b>
            <span>day streak</span>
          </div>
        </div>
        {finish && finish.bonus_reasons.length > 0 && (
          <ul className="bonus">
            {finish.bonus_reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        {finishError && <p className="alert warn">Ride bonus not added yet: {finishError}</p>}

        {insight && (
          <div className="row">
            <b>Best insight</b>
            <span>{insight}</span>
          </div>
        )}
        {move && (
          <div className="row">
            <b>Tomorrow’s AI move</b>
            <span>{move}</span>
          </div>
        )}
      </div>

      <button className="go go-sticky" type="button" onClick={onAgain}>
        Ride again
      </button>
      <Link className="link" to="/app/rewards">
        Spend points on rewards
      </Link>
    </section>
  )
}
