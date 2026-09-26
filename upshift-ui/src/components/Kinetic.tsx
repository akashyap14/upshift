// Words fade up one by one (DESIGN.md §3)
export function Kinetic({ text, delay, per, className }: { text: string; delay: number; per: number; className: string }) {
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <p className={className}>
      {words.map((w, i) => (
        <span key={i}>
          <span className="w" style={{ animationDelay: `${delay + i * per}ms` }}>
            {w}
          </span>{' '}
        </span>
      ))}
    </p>
  )
}

