import { useLayoutEffect, useRef, type CSSProperties } from 'react'
import { MOTIF_PATHS, type Motif as MotifName } from '../lib/professions'

// The profession's line drawing: draws itself, holds, undraws; a dot rides along the path
export function Motif({ motif, height = 120 }: { motif: MotifName; height?: number }) {
  const draw = useRef<SVGPathElement>(null)
  const d = MOTIF_PATHS[motif]

  useLayoutEffect(() => {
    const path = draw.current!
    path.style.setProperty('--len', String(Math.ceil(path.getTotalLength?.() ?? 600)))
  }, [d])

  return (
    <svg className="motif" viewBox="0 0 320 120" aria-hidden="true" style={{ height } as CSSProperties}>
      <path className="soft" d={d} />
      {/* key restarts the draw animation when the motif changes */}
      <path key={d} ref={draw} className="draw" d={d} />
      <circle className="rider" r="4.5">
        <animateMotion key={d} dur="6s" repeatCount="indefinite" rotate="auto" path={d} />
      </circle>
    </svg>
  )
}
