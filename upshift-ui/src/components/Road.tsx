import { useEffect, useRef } from 'react'

// Fixed bottom bar: minutes to go, traffic status and a car dot that eases to its target
export function Road({ eta, target }: { eta: number; target: number }) {
  const fill = useRef<HTMLDivElement>(null)
  const car = useRef<HTMLDivElement>(null)
  const etaText = useRef<HTMLSpanElement>(null)
  const sigText = useRef<HTMLSpanElement>(null)
  const goal = useRef({ eta, target })
  const progress = useRef(target)

  useEffect(() => {
    goal.current = { eta, target }
    // Going back to setup resets the road instantly
    if (target < progress.current) progress.current = target
  }, [eta, target])

  useEffect(() => {
    let raf = 0
    let prev = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(50, now - prev) / 16.67
      prev = now
      progress.current += (goal.current.target - progress.current) * 0.02 * dt
      // The bar can unmount between frames (leaving a ride); stop quietly
      if (!fill.current || !car.current || !etaText.current || !sigText.current) return
      const pr = progress.current
      const col = pr < 0.4 ? '#E8963A' : pr < 0.85 ? '#D8B533' : '#3FA96A'
      fill.current.style.width = `${pr * 100}%`
      fill.current.style.background = col
      car.current.style.left = `${pr * 100}%`
      car.current.style.color = col
      etaText.current.textContent = `${Math.max(0, Math.round(goal.current.eta * (1 - pr)))} min to go`
      sigText.current.textContent = pr < 0.4 ? 'Heavy traffic' : pr < 0.85 ? 'Moving' : 'Almost there'
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div className="road" aria-hidden="true">
      <div className="road-in">
        <div className="road-meta">
          <span ref={etaText} />
          <span ref={sigText} />
        </div>
        <div className="track">
          <div className="fill" ref={fill} />
          <div className="car" ref={car} />
        </div>
      </div>
    </div>
  )
}
