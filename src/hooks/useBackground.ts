import { useEffect, useState } from 'react'

export const BACKGROUND_PRESETS = [
  { id: 'echo', label: 'ECHO Dark', description: 'Standaard ECHO-achtergrond', swatch: '#070a0f' },
  { id: 'midnight', label: 'Midnight Blue', description: 'Diep nachtblauw', swatch: '#0b1430' },
  { id: 'soft', label: 'Soft Light', description: 'Zacht en warm', swatch: '#f4f1ea' },
  { id: 'forest', label: 'Forest', description: 'Rustig bosgroen', swatch: '#0b1a13' },
] as const

export type BackgroundId = typeof BACKGROUND_PRESETS[number]['id']

const STORAGE_KEY = 'echo-background'
export const DEFAULT_BACKGROUND: BackgroundId = 'echo'

function isBackgroundId(value: string | null): value is BackgroundId {
  return BACKGROUND_PRESETS.some((preset) => preset.id === value)
}

export function useBackground() {
  const [background, setBackground] = useState<BackgroundId>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (isBackgroundId(saved)) return saved
    } catch { /* storage unavailable */ }
    return DEFAULT_BACKGROUND
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-bg', background)
    try { localStorage.setItem(STORAGE_KEY, background) } catch { /* storage unavailable */ }
  }, [background])

  return { background, setBackground, reset: () => setBackground(DEFAULT_BACKGROUND) }
}
