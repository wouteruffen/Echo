import type { Lang } from '../i18n/translations'

const STORAGE_KEY = 'echo_selected_voice'

// Fallback priority — partial name matches, checked in order
const FALLBACK_NL = [
  'Microsoft Frank',
  'Google Nederlands',
]

const FALLBACK_EN = [
  'Google UK English Female',
  'Microsoft Zira',
  'Google US English',
  'Microsoft Mark',
]

export function getStoredVoiceName(): string | null {
  try { return localStorage.getItem(STORAGE_KEY) } catch { return null }
}

export function storeVoiceName(name: string): void {
  try { localStorage.setItem(STORAGE_KEY, name) } catch { /* ignore */ }
}

export function clearStoredVoice(): void {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

// overrideName === undefined → read from localStorage
// overrideName === null      → skip stored, use fallback only
export function selectVoice(lang: Lang, overrideName?: string | null): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null

  const nameToUse = overrideName !== undefined ? overrideName : getStoredVoiceName()
  if (nameToUse) {
    const match = voices.find(v => v.name === nameToUse)
    if (match) {
      console.log(`[ECHO Voice] "${match.name}" | ${match.lang} | source: selected`)
      return match
    }
  }

  const fallbackList = lang === 'nl' ? FALLBACK_NL : FALLBACK_EN
  for (const fragment of fallbackList) {
    const match = voices.find(v => v.name.includes(fragment))
    if (match) {
      console.log(`[ECHO Voice] "${match.name}" | ${match.lang} | source: fallback`)
      return match
    }
  }

  const prefix = lang === 'nl' ? 'nl' : 'en'
  const langMatch = voices.find(v => v.lang.startsWith(prefix)) ?? voices[0] ?? null

  if (langMatch) {
    console.warn(`[ECHO Voice] "${langMatch.name}" | ${langMatch.lang} | source: lang-prefix fallback`)
  } else {
    console.warn('[ECHO Voice] No voice available on this system.')
  }

  return langMatch
}
