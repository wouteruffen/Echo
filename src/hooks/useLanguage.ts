import { useState, useEffect } from 'react'
import type { Lang } from '../i18n/translations'

const STORAGE_KEY = 'echo-lang'

export function useLanguage() {
  const [lang, setLangState] = useState<Lang>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved === 'nl' || saved === 'en') return saved as Lang
    } catch {}
    return 'nl'
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, lang) } catch {}
  }, [lang])

  const toggle = () => setLangState(l => (l === 'nl' ? 'en' : 'nl'))
  const setLang = (l: Lang) => setLangState(l)

  return { lang, toggle, setLang }
}
