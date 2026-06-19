import { useState, useCallback, useEffect } from 'react'
import type { Lang } from '../i18n/translations'
import { selectVoice, getStoredVoiceName, storeVoiceName, clearStoredVoice } from '../utils/voiceSelector'

export function useSpeech(lang: Lang) {
  const [enabled, setEnabled]       = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [voices, setVoices]         = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoiceName, setSelectedVoiceNameState] = useState<string | null>(getStoredVoiceName)
  const [wordBoundaryCount, setWordBoundaryCount]       = useState(0)
  const [currentWordLength, setCurrentWordLength]       = useState(0)

  const supported =
    typeof window !== 'undefined' && 'speechSynthesis' in window

  useEffect(() => {
    if (!supported) return

    const load = () => {
      const all = window.speechSynthesis.getVoices()
      if (all.length) setVoices(all)
    }

    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      window.speechSynthesis.cancel()
    }
  }, [supported])

  const setSelectedVoice = useCallback((name: string | null) => {
    if (name) storeVoiceName(name)
    else clearStoredVoice()
    setSelectedVoiceNameState(name)
  }, [])

  // Attach word-boundary tracking so useVoiceMeter can react to real speech rhythm.
  // charLength is not always populated (Firefox/Safari), so we fall back to scanning
  // the utterance text from charIndex when it is 0 or missing.
  const attachBoundary = useCallback((utterance: SpeechSynthesisUtterance) => {
    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name !== 'word') return
      let len = e.charLength ?? 0
      if (len === 0) {
        const rest = utterance.text.slice(e.charIndex)
        const match = rest.match(/^\S+/)
        len = match ? match[0].length : 5
      }
      setCurrentWordLength(len)
      setWordBoundaryCount(c => c + 1)
    }
  }, [])

  const speakEchoResponse = useCallback((text: string) => {
    if (!enabled || !supported || !text) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const voice = selectVoice(lang, selectedVoiceName)
    if (voice) utterance.voice = voice
    utterance.lang   = lang === 'nl' ? 'nl-NL' : 'en-US'
    utterance.rate   = 0.92
    utterance.pitch  = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend   = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    attachBoundary(utterance)

    window.speechSynthesis.speak(utterance)
  }, [enabled, supported, lang, selectedVoiceName, attachBoundary])

  // Bypasses `enabled` — used for the voice test button
  const testVoice = useCallback((text: string) => {
    if (!supported || !text) return
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const voice = selectVoice(lang, selectedVoiceName)
    if (voice) utterance.voice = voice
    utterance.lang   = lang === 'nl' ? 'nl-NL' : 'en-US'
    utterance.rate   = 0.92
    utterance.pitch  = 1.0
    utterance.volume = 1.0

    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend   = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    attachBoundary(utterance)

    window.speechSynthesis.speak(utterance)
  }, [supported, lang, selectedVoiceName, attachBoundary])

  const toggle = useCallback(() => {
    setEnabled(prev => {
      if (prev && supported) {
        window.speechSynthesis.cancel()
        setIsSpeaking(false)
      }
      return !prev
    })
  }, [supported])

  return {
    enabled, isSpeaking, supported,
    voices, selectedVoiceName, setSelectedVoice,
    speakEchoResponse, testVoice, toggle,
    wordBoundaryCount, currentWordLength,
  }
}
