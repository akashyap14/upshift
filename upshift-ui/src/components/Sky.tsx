import { useEffect, useRef } from 'react'
import { hexToRgb, isNight, reducedMotion } from '../lib/theme'

interface Props {
  tint: string
  tint2: string
  speed: number
}

// Soft sky: three slow colour clouds that drift and blend to the profession's tints
export function Sky({ tint, tint2, speed }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const goal = useRef<[number, number, number][]>([hexToRgb(tint), hexToRgb(tint2)])
  const speedRef = useRef(speed)

  useEffect(() => {
    goal.current = [hexToRgb(tint), hexToRgb(tint2)]
  }, [tint, tint2])
  useEffect(() => {
    speedRef.current = speed
  }, [speed])

  useEffect(() => {
    const cv = canvas.current!
    const cx = cv.getContext('2d')!
    let W = 0
    let H = 0
    let t = 0
    let raf = 0
    let prev = performance.now()
    const cols = goal.current.map((c) => [...c])
    const reduce = reducedMotion()

    function resize() {
      const d = Math.min(devicePixelRatio || 1, 2)
      W = innerWidth
      H = innerHeight
      cv.width = W * d
      cv.height = H * d
      cx.setTransform(d, 0, 0, d, 0, 0)
    }

    function frame(now: number) {
      const dt = Math.min(50, now - prev) / 16.67
      prev = now
      t += dt * (reduce ? 0 : speedRef.current)
      for (let k = 0; k < 2; k++)
        for (let c = 0; c < 3; c++) cols[k][c] += (goal.current[k][c] - cols[k][c]) * 0.04 * dt

      cx.clearRect(0, 0, W, H)
      const a = isNight() ? 0.16 : 0.75
      const size = Math.max(W, 420)
      const blobs: [number, number, number, number[]][] = [
        [W * (0.25 + 0.12 * Math.sin(t * 0.006)), H * (0.12 + 0.05 * Math.cos(t * 0.005)), size * 0.75, cols[0]],
        [W * (0.85 + 0.1 * Math.cos(t * 0.004)), H * (0.28 + 0.06 * Math.sin(t * 0.007)), size * 0.65, cols[1]],
        [W * (0.5 + 0.2 * Math.sin(t * 0.003)), H * (0.9 + 0.04 * Math.cos(t * 0.006)), size * 0.6, cols[0]],
      ]
      for (const [x, y, r, col] of blobs) {
        const g = cx.createRadialGradient(x, y, 0, x, y, r)
        const rgb = col.map(Math.round).join(',')
        g.addColorStop(0, `rgba(${rgb},${a})`)
        g.addColorStop(1, `rgba(${rgb},0)`)
        cx.fillStyle = g
        cx.fillRect(0, 0, W, H)
      }
      raf = requestAnimationFrame(frame)
    }

    addEventListener('resize', resize)
    resize()
    raf = requestAnimationFrame(frame)
    return () => {
      removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [])

  return <canvas ref={canvas} className="sky" aria-hidden="true" />
}
