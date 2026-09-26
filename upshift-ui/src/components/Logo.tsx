import { motion } from 'motion/react'

const GREEN = '#66AB34'

/** Upshift mark: a figure climbing stairs, arrow up, in a circle (from upshift_1). */
export function Mark({ size = 28, draw = false }: { size?: number; draw?: boolean }) {
  const d = (delay: number) =>
    draw ? { initial: { pathLength: 0 }, animate: { pathLength: 1 }, transition: { duration: 0.7, delay, ease: 'easeInOut' as const } } : {}
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 474 474"
      fill="none"
      stroke={GREEN}
      strokeWidth={size < 40 ? 22 : 13}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flex: 'none' }}
    >
      <motion.circle cx="237" cy="237" r="168" {...d(0)} />
      <motion.circle cx="181" cy="161" r="17" fill={GREEN} {...d(0.5)} />
      <motion.path d="M161 191 H201 L196 298 H166 Z" {...d(0.6)} />
      <motion.path d="M142 326 H224 V273 H273 V222 H323 V172" {...d(0.8)} />
      <motion.path d="M305 188 L323 170 L341 188" {...d(1.3)} />
    </svg>
  )
}

/** Wordmark: "Up" green, "Shift" ink on light or white on dark. */
export function Wordmark({ dark = false, size = 20 }: { dark?: boolean; size?: number }) {
  return (
    <span className="wordmark" style={{ fontSize: size }}>
      <span style={{ color: GREEN }}>Up</span>
      <span style={{ color: dark ? '#FFFFFF' : 'var(--ink)' }}>Shift</span>
    </span>
  )
}

export function Brand({ size = 22 }: { size?: number }) {
  return (
    <span className="brand" aria-label="UpShift">
      <Mark size={size} />
      <Wordmark size={size * 0.92} />
    </span>
  )
}

/** Opening animation (~2.5 s): the mark draws itself on a dark screen and glows, then fades out. */
export function Splash({ onDone }: { onDone: () => void }) {
  return (
    <motion.div
      className="splash"
      role="presentation"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{ delay: 2.1, duration: 0.4 }}
      onAnimationComplete={onDone}
      onClick={onDone}
    >
      <motion.div
        initial={{ filter: `drop-shadow(0 0 0px ${GREEN})` }}
        animate={{ filter: [`drop-shadow(0 0 0px ${GREEN})`, `drop-shadow(0 0 28px ${GREEN})`, `drop-shadow(0 0 14px ${GREEN})`] }}
        transition={{ delay: 1.2, duration: 1 }}
      >
        <Mark size={168} draw />
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.3 }}>
        <Wordmark dark size={44} />
      </motion.div>
      <motion.p className="splash-tag" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.6 }}>
        Your commute, turned into skill time
      </motion.p>
    </motion.div>
  )
}
