// Formatting helpers and labels for the company web app.
import type { Level } from '../api/types'
import { byId } from '../lib/professions'

export const LEVELS: { value: Level; label: string }[] = [
  { value: 1, label: 'Junior' },
  { value: 2, label: 'Mid' },
  { value: 3, label: 'Leader' },
]
export const levelName = (l: number) => LEVELS.find((x) => x.value === l)?.label ?? `Level ${l}`
export const professionName = (id: string) => (id === 'all' ? 'All staff' : (byId[id]?.name ?? id))

export const todayIso = () => new Date().toISOString().slice(0, 10)
export const inDaysIso = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10)
export function formatDate(iso: string) {
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
