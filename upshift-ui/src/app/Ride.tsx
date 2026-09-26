// A ride: load rounds sized to the ETA, play them one by one, then show the Gear Card.
import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { api } from '../api/client'
import { useSession } from '../api/session'
import type { AnswerResponse, PlayRound } from '../api/types'
import { Motif } from '../components/Motif'
import { byId, PROFESSIONS, roundsForEta } from '../lib/professions'
import { useApp } from './context'
import { GearCard } from './GearCard'
import { RoundCard } from './RoundCard'

export interface Played {
  round: PlayRound
  result: AnswerResponse
}

export function Ride() {
  const { user, patchUser } = useSession()
  const { setRoad } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const ride = location.state as { eta: number; startedAt: number } | null

  const [rounds, setRounds] = useState<PlayRound[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [idx, setIdx] = useState(0)
  const [played, setPlayed] = useState<Played[]>([])
  const [arrived, setArrived] = useState(false)
  const [plus, setPlus] = useState<{ n: number; key: number } | null>(null)

  const prof = byId[user!.profession] ?? PROFESSIONS[0]
  const userId = user!.id
  const eta = ride?.eta ?? 10

  useEffect(() => {
    if (!ride) return
    let live = true
    api
      .rounds(userId, eta)
      .then((r) => live && setRounds(r.rounds.slice(0, roundsForEta(eta))))
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [ride, userId, eta, attempt])

  useEffect(() => setRoad(0.12), [setRoad])

  // Show "+N" when points land, and keep the points pill in sync
  const popPoints = useCallback((n: number, total: number) => {
    patchUser({ points: total })
    if (n > 0) setPlus({ n, key: Date.now() })
  }, [patchUser])

  useEffect(() => {
    if (!plus) return
    const t = setTimeout(() => setPlus(null), 1200)
    return () => clearTimeout(t)
  }, [plus])

  const onAnswered = useCallback(
    (result: AnswerResponse) => {
      setPlayed((p) => [...p, { round: rounds![idx], result }])
      setRoad(0.12 + 0.8 * ((idx + 1) / rounds!.length))
      popPoints(result.points, result.points_total)
    },
    [rounds, idx, setRoad, popPoints],
  )

  function next() {
    if (idx < rounds!.length - 1) {
      setIdx((i) => i + 1)
      scrollTo(0, 0)
    } else {
      setRoad(1)
      setArrived(true)
      scrollTo(0, 0)
    }
  }

  if (!ride) return <Navigate to="/app" replace />

  const PlusPop = (
    <AnimatePresence>
      {plus && (
        <motion.div
          key={plus.key}
          className="plus"
          aria-hidden="true"
          initial={{ y: 20, opacity: 0, scale: 0.6 }}
          animate={{ y: -10, opacity: 1, scale: 1 }}
          exit={{ opacity: 0, y: -60 }}
          transition={{ type: 'spring', stiffness: 380, damping: 16 }}
        >
          +{plus.n}
        </motion.div>
      )}
    </AnimatePresence>
  )

  if (arrived) {
    return (
      <>
        <GearCard played={played} eta={eta} onBonus={popPoints} onAgain={() => navigate('/app')} />
        {PlusPop}
      </>
    )
  }

  return (
    <section className="screen">
      <Motif motif={prof.motif} height={64} />

      {!rounds && !error && (
        <div className="panel" aria-busy="true" aria-live="polite">
          <span className="kind">Getting your rounds ready</span>
          <div className="skel" style={{ width: '90%' }} />
          <div className="skel" style={{ width: '70%' }} />
          <div className="skel tall" />
        </div>
      )}

      {error && (
        <div className="panel" role="alert">
          <p className="q">Couldn’t load your rounds</p>
          <p className="hint">{error}</p>
          <button
            className="go"
            type="button"
            onClick={() => {
              setError(null)
              setAttempt((a) => a + 1)
            }}
          >
            Try again
          </button>
        </div>
      )}

      {rounds && rounds.length === 0 && (
        <div className="panel empty-state">
          <p className="q">You’re all caught up</p>
          <p className="hint">No new rounds right now. Fresh ones arrive with new packs and tomorrow’s news.</p>
          <Link className="go" to="/app">
            Back home
          </Link>
        </div>
      )}

      {rounds && rounds[idx] && (
        <AnimatePresence mode="wait">
          <motion.div
            key={rounds[idx].id}
            className="round"
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            <RoundCard round={rounds[idx]} index={idx} total={rounds.length} userId={user!.id} level={user!.level} onAnswered={onAnswered} onNext={next} />
          </motion.div>
        </AnimatePresence>
      )}
      {PlusPop}
    </section>
  )
}
