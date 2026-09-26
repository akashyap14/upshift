// Play home: assigned packs first, then today's news round, ride time and passenger check.
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { api } from '../api/client'
import { useSession } from '../api/session'
import { Motif } from '../components/Motif'
import { byId, LEVEL_NAME, PROFESSIONS, roundsForEta } from '../lib/professions'
import { unlockSpeech } from '../lib/speech'
import { useApp } from './context'

const dueLabel = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

export function Home() {
  const { user, signOut } = useSession()
  const { eta, setEta, setRoad } = useApp()
  const navigate = useNavigate()
  const [passenger, setPassenger] = useState(true)
  const prof = byId[user!.profession] ?? PROFESSIONS[0]
  const rounds = roundsForEta(eta)

  // Summary of what's waiting: assigned packs and whether news rounds remain
  const home = useQuery({ queryKey: ['play-home', user!.id], queryFn: () => api.rounds(user!.id, 60, true), refetchOnMount: 'always' })
  const assigned = home.data?.assigned ?? []
  const newsLeft = home.data?.rounds.filter((r) => r.pack.kind === 'news').length ?? 0
  const assignedLeft = assigned.reduce((s, a) => s + (a.total - a.done), 0)

  useEffect(() => setRoad(0.06), [setRoad])

  function start() {
    unlockSpeech() // this tap is the user gesture Chrome needs before it will speak
    navigate('/app/ride', { state: { eta, startedAt: Date.now() } })
  }

  return (
    <section className="screen">
      <div className="hero">
        <p className="hello">Hi {user!.name.split(' ')[0]}. Stuck in traffic?</p>
        <h1 className="who swap" key={prof.id}>
          {prof.name}
        </h1>
        <p className="lede">
          {LEVEL_NAME[user!.level]} · {user!.team}
        </p>
        <Motif motif={prof.motif} height={96} />
      </div>

      <div className="panel">
        <h2 className="panel-title">Assigned to your team</h2>
        {home.isPending && <div className="skel" />}
        {home.isError && (
          <p className="alert bad" role="alert">
            {home.error.message}
          </p>
        )}
        {home.data && assigned.length === 0 && <p className="hint">Nothing assigned right now. Your manager’s packs will show up here.</p>}
        <ul className="assigned">
          {assigned.map((a) => {
            const done = a.done >= a.total
            return (
              <li key={a.pack_id}>
                <div className="assigned-top">
                  <b className="grow">{a.title}</b>
                  <span className={done ? 'tag good' : 'tag'}>{done ? '✓ Done' : `Due ${dueLabel(a.due_date)}`}</span>
                </div>
                <div className="meter" role="progressbar" aria-valuemin={0} aria-valuemax={a.total} aria-valuenow={a.done} aria-label={`${a.title} progress`}>
                  <i style={{ width: `${a.total ? (a.done / a.total) * 100 : 0}%` }} />
                </div>
                <small className="muted">
                  {a.done} of {a.total} questions done
                </small>
              </li>
            )
          })}
        </ul>
        <div className="news-line">
          <span className="news-dot" aria-hidden="true" />
          <span className="grow">
            <b>Today’s news round</b>
            <small className="muted">{newsLeft ? `${newsLeft} fresh ${newsLeft === 1 ? 'round' : 'rounds'} for ${prof.name.toLowerCase()}s` : 'You’re up to date on the news'}</small>
          </span>
        </div>
      </div>

      <div className="panel">
        <div>
          <label className="lab" htmlFor="eta">
            Ride time
          </label>
          <div className="eta">
            <b>{eta} min</b>
            <span>
              {rounds} {rounds === 1 ? 'round' : 'rounds'}
            </span>
          </div>
          <input type="range" id="eta" min={5} max={60} step={1} value={eta} onChange={(e) => setEta(+e.target.value)} />
        </div>
        <label className="check">
          <input type="checkbox" checked={passenger} onChange={(e) => setPassenger(e.target.checked)} />
          I’m a passenger, not driving
        </label>
        <button className="go" type="button" disabled={!passenger || (home.data && assignedLeft + newsLeft === 0)} onClick={start}>
          {home.data && assignedLeft + newsLeft === 0 ? 'You’re all caught up' : 'Start ride'}
        </button>
      </div>

      <p className="signed-in">
        Signed in as {user!.name} ·{' '}
        <button type="button" className="text-btn" onClick={signOut}>
          Switch person
        </button>
      </p>
    </section>
  )
}
