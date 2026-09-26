import { useEffect, useRef, useState } from 'react'
import { Bloom, type BloomHandle } from './components/Bloom'
import { Road } from './components/Road'
import { Sky } from './components/Sky'
import { LEVEL_NAME, MOTION_SPEED, byId } from './lib/professions'
import { applyProfessionTheme, reducedMotion } from './lib/theme'
import { canSpeak, stopSpeaking, unlockSpeech } from './lib/speech'
import { GearCard } from './screens/GearCard'
import { Round, type RideResult } from './screens/Round'
import { Setup, type SetupValues } from './screens/Setup'

type Screen = 'setup' | 'round' | 'card'

export default function App() {
  const [values, setValues] = useState<SetupValues>(() => ({
    profId: 'sde',
    level: 2,
    track: 'mixed',
    eta: 24,
    passenger: true,
    // Web search is opt-in: it's slower and each search is billed (matches the backend default).
    web: localStorage.getItem('upshift.web') === 'on',
  }))
  const [preview, setPreview] = useState<string | null>(null)
  const [screen, setScreen] = useState<Screen>('setup')
  const [rideId, setRideId] = useState(0)
  const [ride, setRide] = useState<RideResult | null>(null)
  const [road, setRoad] = useState(0.06)
  const [voice, setVoice] = useState(() => canSpeak() && localStorage.getItem('upshift.voice') !== 'off')
  const bloom = useRef<BloomHandle>(null)

  const prof = byId[values.profId]
  const shown = byId[preview ?? values.profId]

  // Tokens follow the shown profession (including dropdown previews) and the phone's dark mode
  useEffect(() => {
    applyProfessionTheme(shown)
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyProfessionTheme(shown)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [shown])

  useEffect(() => {
    localStorage.setItem('upshift.web', values.web ? 'on' : 'off')
  }, [values.web])

  useEffect(() => {
    localStorage.setItem('upshift.voice', voice ? 'on' : 'off')
    if (!voice) stopSpeaking()
  }, [voice])

  const patch = (p: Partial<SetupValues>) => setValues((v) => ({ ...v, ...p }))
  const show = (s: Screen) => {
    setScreen(s)
    scrollTo(0, 0)
  }

  function startRide() {
    unlockSpeech() // this tap is the user gesture Chrome needs before it will speak
    setPreview(null)
    setRide(null)
    setRideId((n) => n + 1)
    setRoad(0.12)
    show('round')
  }

  function arrive(r: RideResult) {
    setRide(r)
    setRoad(1)
    show('card')
    if (!reducedMotion()) {
      setTimeout(() => bloom.current?.bloom(innerWidth / 2, innerHeight * 0.4, [prof.tint, prof.tint2, getComputedStyle(document.documentElement).getPropertyValue('--deep').trim()]), 300)
    }
  }

  return (
    <>
      <Sky tint={shown.tint} tint2={shown.tint2} speed={MOTION_SPEED[values.level]} />
      <Bloom ref={bloom} />

      <div className="app">
        <header className="bar">
          <div className="logo">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path fill="currentColor" d="M12 3 4 12h5v9h6v-9h5z" />
            </svg>
            Upshift
          </div>
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
            <div className="gears" aria-label={`Level: ${LEVEL_NAME[values.level]}`}>
              {[1, 2, 3].map((n) => (
                <i key={n} className={n <= values.level ? 'on' : undefined} />
              ))}
              <span>{LEVEL_NAME[values.level]}</span>
            </div>
          </div>
        </header>

        {screen === 'setup' && (
          <Setup values={values} shown={shown} onChange={patch} onPreview={setPreview} onStart={startRide} />
        )}

        {screen === 'round' && (
          <Round
            key={`${rideId}-${values.profId}`}
            prof={prof}
            shown={shown}
            level={values.level}
            track={values.track}
            eta={values.eta}
            voice={voice}
            web={values.web}
            bloom={bloom}
            onChangeProf={(id) => {
              setPreview(null)
              patch({ profId: id })
              setRoad(0.12)
            }}
            onPreview={setPreview}
            onProgress={setRoad}
            onArrive={arrive}
          />
        )}

        {screen === 'card' && ride && (
          <GearCard
            prof={prof}
            level={values.level}
            eta={values.eta}
            ride={ride}
            onAgain={startRide}
            onChange={() => {
              setRoad(0.06)
              show('setup')
            }}
          />
        )}
      </div>

      <Road eta={values.eta} target={road} />
    </>
  )
}
