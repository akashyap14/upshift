// Shared state for the mobile app: ride time, road progress, read-aloud and the bloom effect.
import { createContext, useContext, type RefObject } from 'react'
import type { BloomHandle } from '../components/Bloom'

export interface AppState {
  eta: number
  setEta(eta: number): void
  /** Road bar target, 0–1 */
  setRoad(target: number): void
  voice: boolean
  bloom: RefObject<BloomHandle | null>
  /** Soft circles in the profession's colours at a screen point */
  bloomAt(x: number, y: number): void
}

export const AppContext = createContext<AppState | null>(null)

export function useApp() {
  const s = useContext(AppContext)
  if (!s) throw new Error('useApp must be used inside the /app shell')
  return s
}
