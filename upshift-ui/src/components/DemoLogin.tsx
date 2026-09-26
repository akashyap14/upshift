// Demo role picker (spec §1: Employee / Manager / Leader). Real company SSO comes later.
import { useState } from 'react'
import { api } from '../api/client'
import { useUsers } from '../api/hooks'
import { useSession } from '../api/session'
import type { Role, User } from '../api/types'
import { byId } from '../lib/professions'

const ROLES: { value: Role; label: string }[] = [
  { value: 'employee', label: 'Employee' },
  { value: 'manager', label: 'Manager' },
  { value: 'leader', label: 'Leader' },
]

interface Props {
  /** Roles to offer; the admin app hides Employee */
  roles?: Role[]
  onDone?(user: User): void
}

export function DemoLogin({ roles = ['employee', 'manager', 'leader'], onDone }: Props) {
  const { signIn } = useSession()
  const users = useUsers()
  const [role, setRole] = useState<Role>(roles[0])
  const [busy, setBusy] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function pick(u: User) {
    setBusy(u.id)
    setError(null)
    try {
      const fresh = await api.login(u.id)
      signIn(fresh)
      onDone?.(fresh)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  const list = users.data?.filter((u) => u.role === role) ?? []

  return (
    <div className="demo-login">
      {roles.length > 1 && (
        <div className="seg" role="group" aria-label="Sign in as">
          {ROLES.filter((r) => roles.includes(r.value)).map((r) => (
            <button key={r.value} type="button" aria-pressed={role === r.value} onClick={() => setRole(r.value)}>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {users.isPending && <p className="muted">Loading people…</p>}
      {users.isError && (
        <p className="alert bad" role="alert">
          {users.error.message}
        </p>
      )}
      <ul className="people">
        {list.map((u) => (
          <li key={u.id}>
            <button type="button" onClick={() => pick(u)} disabled={busy !== null}>
              <span className="avatar" style={{ background: byId[u.profession]?.tint ?? 'var(--surface-2)' }} aria-hidden="true">
                {u.name
                  .split(' ')
                  .map((w) => w[0])
                  .join('')}
              </span>
              <span className="grow">
                <b>{u.name}</b>
                <small>
                  {u.team} · {byId[u.profession]?.name ?? 'All staff'}
                </small>
              </span>
              {busy === u.id ? <span className="spin" aria-hidden="true" /> : <span className="chev" aria-hidden="true">›</span>}
            </button>
          </li>
        ))}
      </ul>
      {error && (
        <p className="alert bad" role="alert">
          {error}
        </p>
      )}
      <p className="hint">Demo sign-in. Company single sign-on comes later.</p>
    </div>
  )
}
