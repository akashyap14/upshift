import type { Profession } from './professions'

export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches
export const isNight = () => matchMedia('(prefers-color-scheme: dark)').matches

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// At night each profession's deep colour is lightened 45% towards white (DESIGN.md §1)
export function lighten(hex: string): string {
  const c = hexToRgb(hex).map((v) => Math.round(v + (255 - v) * 0.45))
  return `rgb(${c.join(',')})`
}

export function applyProfessionTheme(p: Profession) {
  const root = document.documentElement.style
  root.setProperty('--tint', p.tint)
  root.setProperty('--tint-2', p.tint2)
  root.setProperty('--deep', isNight() ? lighten(p.deep) : p.deep)
}
