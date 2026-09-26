import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { PROFESSIONS, type Profession } from '../lib/professions'

function Dot({ p }: { p: Profession }) {
  return (
    <span className="dot" style={{ background: p.tint }}>
      {p.mono}
    </span>
  )
}

interface Props {
  value: string
  onChange(id: string): void
  /** Called while hovering/arrowing through options; null restores the chosen one */
  onPreview(id: string | null): void
  label: string
  compact?: boolean
}

export function ProfessionPicker({ value, onChange, onPreview, label, compact }: Props) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const current = PROFESSIONS.find((p) => p.id === value)!

  const close = (restore: boolean) => {
    setOpen(false)
    if (restore) onPreview(null)
  }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) close(true)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    list.current?.focus()
    list.current?.children[active]?.scrollIntoView({ block: 'nearest' })
  }, [open, active])

  const toggle = () => {
    if (open) return close(true)
    setActive(PROFESSIONS.findIndex((p) => p.id === value))
    setOpen(true)
  }

  const choose = (id: string) => {
    close(false)
    onChange(id)
    btn.current?.focus()
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      const next = Math.max(0, Math.min(PROFESSIONS.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)))
      setActive(next)
      onPreview(PROFESSIONS[next].id)
      e.preventDefault()
    } else if (e.key === 'Enter' || e.key === ' ') {
      choose(PROFESSIONS[active].id)
      e.preventDefault()
    } else if (e.key === 'Escape') {
      close(true)
      btn.current?.focus()
    }
  }

  return (
    <div className={compact ? 'dd dd-compact' : 'dd'} ref={root}>
      <button
        ref={btn}
        className="dd-btn"
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label}: ${current.name}`}
        onClick={toggle}
      >
        <Dot p={current} />
        <span>{current.name}</span>
        <svg className="chev" width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="currentColor" d="M7 10l5 5 5-5z" />
        </svg>
      </button>
      {open && (
        <ul
          ref={list}
          className="dd-list"
          role="listbox"
          tabIndex={-1}
          aria-label="Profession"
          aria-activedescendant={`o-${PROFESSIONS[active].id}`}
          onKeyDown={onKey}
          onMouseLeave={() => onPreview(null)}
        >
          {PROFESSIONS.map((p, i) => (
            <li
              key={p.id}
              id={`o-${p.id}`}
              role="option"
              aria-selected={p.id === value}
              className={i === active ? 'active' : undefined}
              onClick={() => choose(p.id)}
              onMouseEnter={() => {
                setActive(i)
                onPreview(p.id)
              }}
            >
              <Dot p={p} />
              <span>
                <span className="n">{p.name}</span>
                <small>{p.sub}</small>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
