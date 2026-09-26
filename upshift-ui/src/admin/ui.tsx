// Small shared components for the company web app.
import type { ReactNode } from 'react'

export function PageHead({ title, sub, children }: { title: string; sub?: ReactNode; children?: ReactNode }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p className="muted">{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="loading muted" role="status">
      <span className="spin" aria-hidden="true" /> {label}
    </p>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <p className="alert bad" role="alert">
      {error instanceof Error ? error.message : String(error)}
    </p>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty muted">{children}</p>
}

type ChipTone = 'good' | 'bad' | 'warn' | 'plain'
export function Chip({ tone = 'plain', children }: { tone?: ChipTone; children: ReactNode }) {
  return <span className={`chip ${tone}`}>{children}</span>
}
