// Company web app (LMS) at /admin: demo sign-in, sidebar layout and nested routes (spec §3, §8).
import { useMemo, useSyncExternalStore, type CSSProperties } from 'react'
import { Link, NavLink, Navigate, Route, Routes } from 'react-router'
import { useUsers } from '../api/hooks'
import { useSession } from '../api/session'
import type { User } from '../api/types'
import { DemoLogin } from '../components/DemoLogin'
import { Brand } from '../components/Logo'
import { byId } from '../lib/professions'
import './admin.css'
import { Assign } from './Assign'
import { Dashboard } from './Dashboard'
import { Documents } from './Documents'
import { PackReview } from './PackReview'
import { Packs } from './Packs'
import { Rewards } from './Rewards'

const NAV = [
  { to: 'documents', label: 'Documents' },
  { to: 'packs', label: 'Packs' },
  { to: 'assign', label: 'Assign' },
  { to: 'dashboard', label: 'Dashboard' },
  { to: 'rewards', label: 'Rewards' },
]

// Follow the phone/OS dark mode so the accent can be lightened at night (DESIGN.md §1)
const darkQuery = () => matchMedia('(prefers-color-scheme: dark)')
function useNight() {
  return useSyncExternalStore(
    (cb) => {
      const mq = darkQuery()
      mq.addEventListener('change', cb)
      return () => mq.removeEventListener('change', cb)
    },
    () => darkQuery().matches,
  )
}
function lighten(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  return `rgb(${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * 0.45)).join(',')})`
}

/** Company accent: the deep colour of the main profession in the user's team */
function useAccent(user: User | null) {
  const users = useUsers()
  const night = useNight()
  return useMemo(() => {
    if (!user) return {}
    const counts = new Map<string, number>()
    for (const u of users.data ?? []) if (u.team === user.team && byId[u.profession]) counts.set(u.profession, (counts.get(u.profession) ?? 0) + 1)
    const main = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? user.profession
    const p = byId[main] ?? byId.sde
    return { '--deep': night ? lighten(p.deep) : p.deep, '--tint': p.tint, '--tint-2': p.tint2 } as CSSProperties
  }, [user, users.data, night])
}

export default function AdminRoot() {
  const { user, signOut } = useSession()
  const accent = useAccent(user)

  if (!user || user.role === 'employee') {
    return (
      <main className="admin-auth">
        <Brand size={40} />
        <p className="muted">Company training from your own documents.</p>
        <div className="card">
          <h2>Sign in</h2>
          {user?.role === 'employee' && (
            <p className="alert warn">
              {user.name}, the company web app is for managers and leaders. <Link to="/app">Open the mobile app</Link> to play your
              rounds, or sign in as someone else below.
            </p>
          )}
          <DemoLogin roles={['manager', 'leader']} />
        </div>
      </main>
    )
  }

  return (
    <div className="admin" style={accent}>
      <header className="admin-top">
        <Link to="/admin" className="admin-brand" aria-label="UpShift company home">
          <Brand size={24} />
        </Link>
        <span className="company">{user.company_name}</span>
        <span className="grow" />
        <span className="who">
          <b>{user.name}</b> <span className="chip plain">{user.role === 'leader' ? 'Leader' : 'Manager'}</span>
        </span>
        <button type="button" className="btn" onClick={signOut}>
          Sign out
        </button>
      </header>
      <div className="admin-body">
        <nav className="side" aria-label="Company web app">
          {NAV.map((n) => (
            <NavLink key={n.to} to={`/admin/${n.to}`} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <main className="admin-main">
          <Routes>
            <Route index element={<Navigate to={user.role === 'leader' ? '/admin/dashboard' : '/admin/documents'} replace />} />
            <Route path="documents" element={<Documents />} />
            <Route path="packs" element={<Packs />} />
            <Route path="packs/:id" element={<PackReview />} />
            <Route path="assign" element={<Assign />} />
            <Route path="dashboard" element={<Dashboard companyId={user.company_id} />} />
            <Route path="rewards" element={<Rewards />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}
