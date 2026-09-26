import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { reducedMotion } from '../lib/theme'

export interface BloomHandle {
  bloom(x: number, y: number, palette: string[]): void
}

interface Bit {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  c: string
}

// Soft circles that bloom and float up when an answer is revealed
export const Bloom = forwardRef<BloomHandle>(function Bloom(_, ref) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const state = useRef({ bits: [] as Bit[], running: false, W: 0, H: 0 })

  useEffect(() => {
    const cv = canvas.current!
    const cx = cv.getContext('2d')!
    function resize() {
      const d = Math.min(devicePixelRatio || 1, 2)
      state.current.W = innerWidth
      state.current.H = innerHeight
      cv.width = innerWidth * d
      cv.height = innerHeight * d
      cx.setTransform(d, 0, 0, d, 0, 0)
    }
    addEventListener('resize', resize)
    resize()
    return () => removeEventListener('resize', resize)
  }, [])

  useImperativeHandle(ref, () => ({
    bloom(x, y, palette) {
      if (reducedMotion()) return
      const s = state.current
      const cx = canvas.current!.getContext('2d')!
      for (let i = 0; i < 26; i++) {
        const a = Math.random() * Math.PI * 2
        const v = 0.6 + Math.random() * 2.2
        s.bits.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 0.8, r: 3 + Math.random() * 7, life: 1, c: palette[i % palette.length] })
      }
      if (s.running) return
      s.running = true
      const loop = () => {
        cx.clearRect(0, 0, s.W, s.H)
        s.bits = s.bits.filter((b) => b.life > 0)
        for (const b of s.bits) {
          b.x += b.vx
          b.y += b.vy
          b.vy -= 0.02
          b.life -= 0.012
          cx.globalAlpha = Math.max(0, b.life) * 0.9
          cx.fillStyle = b.c
          cx.beginPath()
          cx.arc(b.x, b.y, b.r * (1.4 - b.life * 0.4), 0, Math.PI * 2)
          cx.fill()
        }
        cx.globalAlpha = 1
        if (s.bits.length) requestAnimationFrame(loop)
        else s.running = false
      }
      requestAnimationFrame(loop)
    },
  }))

  return <canvas ref={canvas} className="fx" aria-hidden="true" />
})
