// Mobile player app (/app): splash, demo login, Play and Rewards tabs, ride and Gear Card.
import { motion } from 'motion/react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router'
import { useSession } from '../api/session'
import { Bloom, type BloomHandle } from '../components/Bloom'
import { Brand, Splash } from '../components/Logo'
import { Road } from '../components/Road'
import { Sky } from '../components/Sky'
import { byId, MOTION_SPEED, PROFESSIONS } from '../lib/professions'
import { canSpeak, stopSpeaking } from '../lib/speech'
import { applyProfessionTheme } from '../lib/theme'
import { AppContext, type AppState } from './context'
import { Home } from './Home'
import { Login } from './Login'
import { Rewards } from './Rewards'
import { Ride } from './Ride'
import './app.css'

const SPLASH_KEY = 'upshift.splash'

export default function AppRoot() {
  const { user } = useSession()
  const location = useLocation()
  const [splash, setSplash] = useState(() => sessionStorage.getItem(SPLASH_KEY) !== 'done')
  const [eta, setEta] = useState(24)
  const [road, setRoad] = useState(0.06)
  const [voice, setVoice] = useState(() => canSpeak() && localStorage.getItem('upshift.voice') !== 'off')
  const bloom = useRef<BloomHandle>(null)

  const prof = byId[user?.profession ?? ''] ?? PROFESSIONS[0]
  const riding = location.pathname.startsWith('/app/ride')

  // Tokens follow the player's profession and the phone's dark mode
  useEffect(() => {
    applyProfessionTheme(prof)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyProfessionTheme(prof)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [prof])

  useEffect(() => {
    localStorage.setItem('upshift.voice', voice ? 'on' : 'off')
    if (!voice) stopSpeaking()
  }, [voice])

  const state = useMemo<AppState>(
    () => ({
      eta,
      setEta,
      setRoad,
      voice,
      bloom,
      bloomAt: (x, y) => bloom.current?.bloom(x, y, [prof.tint, prof.tint2, getComputedStyle(document.documentElement).getPropertyValue('--deep').trim()]),
    }),
    [eta, voice, prof],
  )

  const endSplash = () => {
    sessionStorage.setItem(SPLASH_KEY, 'done')
    setSplash(false)
  }

  return (
    <AppContext.Provider value={state}>
      <div className={riding ? 'm-app riding' : 'm-app'}>
        <Sky tint={prof.tint} tint2={prof.tint2} speed={MOTION_SPEED[user?.level ?? 2]} />
        <Bloom ref={bloom} />
        {splash && <Splash onDone={endSplash} />}

        <div className="m-col">
          <header className="bar">
            <Brand size={24} />
            {user && (
              <div className="bar-right">
                {canSpeak() && (
                  <button
                    className="voice-toggle"
                    type="button"
                    aria-pressed={voice}
                    aria-label={voice ? 'Reading aloud is on' : 'Reading aloud is off'}
                    onClick={() => setVoice((v) => !v)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                      {voice ? (
                        <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4ZM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6Z" />
                      ) : (
                        <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm18.7 3-2.6-2.6-1.4 1.4 2.6 2.6-2.6 2.6 1.4 1.4 2.6-2.6 2.6 2.6 1.4-1.4-2.6-2.6 2.6-2.6-1.4-1.4-2.6 2.6Z" />
                      )}
                    </svg>
                  </button>
                )}
                <motion.span
                  key={user.points}
                  className="pts"
                  initial={{ scale: 1.3 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 14 }}
                  aria-label={`${user.points} points`}
                >
                  {user.points} pts
                </motion.span>
              </div>
            )}
          </header>

          {!user ? (
            <Login />
          ) : (
            <Routes>
              <Route index element={<Home />} />
              <Route path="ride" element={<Ride />} />
              <Route path="rewards" element={<Rewards />} />
              <Route path="*" element={<Navigate to="/app" replace />} />
            </Routes>
          )}
        </div>

        {user && riding && <Road eta={eta} target={road} />}
        {user && !riding && (
          <nav className="tabs" aria-label="App">
            <NavLink to="/app" end>
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M12 3 4 12h5v9h6v-9h5z" />
              </svg>
              Play
            </NavLink>
            <NavLink to="/app/rewards">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path fill="currentColor" d="M20 7h-2.2A3 3 0 0 0 12 4.4 3 3 0 0 0 6.2 7H4a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h1v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1Zm-6-1a1 1 0 1 1 1 1h-1V6ZM9 5a1 1 0 0 1 1 1v1H9a1 1 0 0 1 0-2Zm2 15H7v-8h4v8Zm0-10H5V9h6v1Zm6 10h-4v-8h4v8Zm2-10h-6V9h6v1Z" />
              </svg>
              Rewards
            </NavLink>
          </nav>
        )}
      </div>
    </AppContext.Provider>
  )
}
