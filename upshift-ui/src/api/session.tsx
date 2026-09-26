// Demo session: the picked user is kept in localStorage (real SSO comes later, spec §1).
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { User } from './types'

const KEY = 'upshift.user'

interface Session {
  user: User | null
  signIn(user: User): void
  signOut(): void
  /** Update the cached user, e.g. after points change */
  patchUser(patch: Partial<User>): void
}

const SessionContext = createContext<Session | null>(null)

function load(): User | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

function save(user: User | null) {
  try {
    if (user) localStorage.setItem(KEY, JSON.stringify(user))
    else localStorage.removeItem(KEY)
  } catch {
    // private mode: session lasts for this tab only
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(load)

  const signIn = useCallback((u: User) => {
    save(u)
    setUser(u)
  }, [])
  const signOut = useCallback(() => {
    save(null)
    setUser(null)
  }, [])
  const patchUser = useCallback((patch: Partial<User>) => {
    setUser((u) => {
      if (!u) return u
      const next = { ...u, ...patch }
      save(next)
      return next
    })
  }, [])

  const value = useMemo(() => ({ user, signIn, signOut, patchUser }), [user, signIn, signOut, patchUser])
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSession() {
  const s = useContext(SessionContext)
  if (!s) throw new Error('useSession must be used inside <SessionProvider>')
  return s
}
