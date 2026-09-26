import { useCallback, useEffect, useRef, useState } from 'react'

// Minimal typings for the Web Speech API (not in lib.dom for all browsers)
interface RecognitionResult {
  isFinal: boolean
  0: { transcript: string }
}
interface RecognitionEvent {
  resultIndex: number
  results: ArrayLike<RecognitionResult>
}
interface Recognition {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: RecognitionEvent) => void) | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionCtor = new () => Recognition

function getRecognition(): RecognitionCtor | undefined {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

export const canListen = () => !!getRecognition()
export const canSpeak = () => 'speechSynthesis' in window

/**
 * Hold-to-talk speech recognition (en-IN). While held, recognition keeps
 * restarting (Android stops after short silences) and final text is passed to onFinal.
 */
export function useHoldToTalk(onFinal: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const rec = useRef<Recognition | null>(null)
  const held = useRef(false)
  const onFinalRef = useRef(onFinal)
  useEffect(() => {
    onFinalRef.current = onFinal
  }, [onFinal])

  const start = useCallback(() => {
    const Ctor = getRecognition()
    if (!Ctor) {
      setError('Voice isn’t supported in this browser. Type your answer instead.')
      return
    }
    stopSpeaking()
    setError(null)
    held.current = true
    const r = new Ctor()
    r.lang = 'en-IN'
    r.continuous = true
    r.interimResults = true
    r.onresult = (e) => {
      let live = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i]
        if (res.isFinal) onFinalRef.current(res[0].transcript.trim())
        else live += res[0].transcript
      }
      setInterim(live)
    }
    r.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        held.current = false
        setError('Microphone access is blocked. Allow it in your browser, or type your answer.')
      }
    }
    r.onend = () => {
      if (held.current) {
        try {
          r.start()
          return
        } catch {
          // fall through and stop
        }
      }
      setListening(false)
      setInterim('')
    }
    rec.current = r
    try {
      r.start()
      setListening(true)
    } catch {
      held.current = false
    }
  }, [])

  const stop = useCallback(() => {
    held.current = false
    rec.current?.stop()
  }, [])

  useEffect(
    () => () => {
      held.current = false
      rec.current?.abort()
    },
    [],
  )

  return { listening, interim, error, start, stop }
}

export function speak(text: string, rate = 1) {
  if (!canSpeak() || !text) return
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = 'en-IN'
  u.rate = rate
  const voice = speechSynthesis.getVoices().find((v) => v.lang === 'en-IN')
  if (voice) u.voice = voice
  speechSynthesis.speak(u)
}

export function stopSpeaking() {
  if (canSpeak()) speechSynthesis.cancel()
}

// Chrome needs a user gesture before it will speak; call this from the "Start ride" tap
export function unlockSpeech() {
  if (!canSpeak()) return
  const u = new SpeechSynthesisUtterance('')
  u.volume = 0
  speechSynthesis.speak(u)
}
