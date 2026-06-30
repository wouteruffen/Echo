import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import StoryboardDemo from './StoryboardDemo'

type TtsStatus = 'idle' | 'speaking' | 'finished'
type SttLang = 'en-US' | 'nl-NL'

declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

function getSpeechRecognitionCtor(): typeof SpeechRecognition | undefined {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

const cardVariants = {
  hidden: { opacity: 0, y: 14 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' },
  }),
}

export default function VoicePlayground() {
  // ── TTS state ──────────────────────────────────────────────
  const [text, setText] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [rate, setRate] = useState(1.0)
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>('idle')
  const [ttsError, setTtsError] = useState('')

  // ── STT state ──────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false)
  const [sttLang, setSttLang] = useState<SttLang>('en-US')
  const recognitionRef    = useRef<SpeechRecognition | null>(null)
  const textBeforeRef     = useRef('')
  const finalTranscriptRef = useRef('')

  // Storyboard stop callback — StoryboardDemo writes its cancel function here
  // so Voice Output can interrupt the storyboard before starting its own speech.
  const sbStopRef = useRef<() => void>(() => {})

  // ── Capabilities ───────────────────────────────────────────
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const sttSupported = !!getSpeechRecognitionCtor()

  useEffect(() => {
    if (!ttsSupported) return
    const load = () => {
      const v = window.speechSynthesis.getVoices()
      if (v.length) {
        setVoices(v)
        setSelectedVoice(prev => prev || v[0]?.name || '')
      }
    }
    load()
    window.speechSynthesis.addEventListener('voiceschanged', load)
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load)
      window.speechSynthesis.cancel()
    }
  }, [ttsSupported])

  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  // ── Voice Output: speak custom text ───────────────────────
  function speak() {
    if (!text.trim()) { setTtsError('Enter a message first.'); return }
    setTtsError('')
    sbStopRef.current()          // cancel storyboard if running
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const voice = voices.find(v => v.name === selectedVoice)
    if (voice) utterance.voice = voice
    utterance.rate = rate

    utterance.onstart = () => setTtsStatus('speaking')
    utterance.onend   = () => setTtsStatus('finished')
    utterance.onerror = () => setTtsStatus('idle')
    setTtsStatus('speaking')
    window.speechSynthesis.speak(utterance)
  }

  // ── STT helpers ────────────────────────────────────────────
  function startListening() {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.continuous     = true
    recognition.interimResults = true
    recognition.lang           = sttLang

    textBeforeRef.current      = text.trim()
    finalTranscriptRef.current = ''

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let sessionFinal = finalTranscriptRef.current
      let interim = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          sessionFinal += (sessionFinal ? ' ' : '') + t.trim()
          finalTranscriptRef.current = sessionFinal
        } else {
          interim = t
        }
      }
      const parts = [textBeforeRef.current, sessionFinal, interim].filter(Boolean)
      setText(parts.join(' '))
    }

    recognition.onend = () => {
      const parts = [textBeforeRef.current, finalTranscriptRef.current].filter(Boolean)
      setText(parts.join(' '))
      setIsListening(false)
      recognitionRef.current = null
    }

    recognition.onerror = () => {
      setIsListening(false)
      recognitionRef.current = null
    }

    recognitionRef.current = recognition
    recognition.start()
  }

  function toggleListening() {
    if (isListening) recognitionRef.current?.stop()
    else startListening()
  }

  // ── Derived values ─────────────────────────────────────────
  const isSpeaking  = ttsStatus === 'speaking'
  const isAnyActive = isSpeaking || isListening   // used to disable controls

  const outputStatusLabel =
    isSpeaking               ? 'Speaking...' :
    ttsStatus === 'finished' ? 'Finished'    : 'Idle'

  const outputStatusClass =
    isSpeaking               ? 'vp-status--speaking' :
    ttsStatus === 'finished' ? 'vp-status--finished'  : ''

  return (
    <div className="vp-grid">

      {/* ── Card 1: Voice Input ─────────────────────────────── */}
      <motion.div
        className="card vp-card"
        custom={0}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="vp-card-header">
          <span className="card-label">Voice Input</span>
          <span className={`card-tag ${isListening ? 'vp-tag--listening' : ''}`}>
            {isListening
              ? <span className="vp-listening-badge"><span className="vp-mic-pulse" />Listening</span>
              : 'Idle'}
          </span>
        </div>

        {sttSupported ? (
          <div className="vp-card-body">
            <div className="vp-section">
              <label className="vp-label">Language</label>
              <div className="vp-stt-lang">
                <button
                  className={`vp-stt-lang-btn ${sttLang === 'en-US' ? 'vp-stt-lang-btn--active' : ''}`}
                  onClick={() => setSttLang('en-US')}
                  disabled={isListening}
                >EN</button>
                <button
                  className={`vp-stt-lang-btn ${sttLang === 'nl-NL' ? 'vp-stt-lang-btn--active' : ''}`}
                  onClick={() => setSttLang('nl-NL')}
                  disabled={isListening}
                >NL</button>
              </div>
            </div>

            <button
              className={`vp-mic-btn vp-mic-btn--full ${isListening ? 'vp-mic-btn--active' : ''}`}
              onClick={toggleListening}
              disabled={isSpeaking}
            >
              {isListening
                ? <><span className="vp-mic-pulse" />Stop Listening</>
                : <>🎙 Start Listening</>}
            </button>

            {isListening && (
              <p className="vp-stt-hint">Speak clearly — click again to stop.</p>
            )}
          </div>
        ) : (
          <p className="vp-stt-unavailable">
            Speech recognition is not available in this browser. Try Chrome or Edge.
          </p>
        )}
      </motion.div>

      {/* ── Card 2: Voice Output ─────────────────────────────── */}
      <motion.div
        className="card vp-card"
        custom={1}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <div className="vp-card-header">
          <span className="card-label">Voice Output</span>
          <div className={`vp-status ${outputStatusClass}`}>
            <span className="vp-status-dot" />
            <span className="vp-status-text">{outputStatusLabel}</span>
          </div>
        </div>

        <div className="vp-card-body">
          <div className="vp-section">
            <label className="vp-label">Voice</label>
            <select
              className="voice-select"
              value={selectedVoice}
              onChange={e => setSelectedVoice(e.target.value)}
              disabled={isAnyActive || !ttsSupported}
            >
              {voices.length === 0 && <option value="">No voices available</option>}
              {voices.map(v => (
                <option key={v.name} value={v.name}>{v.name} ({v.lang})</option>
              ))}
            </select>
          </div>

          <div className="vp-section">
            <label className="vp-label">
              Speed — <span className="vp-rate-val">{rate.toFixed(1)}x</span>
            </label>
            <input
              type="range"
              className="vp-slider"
              min={0.5} max={2.0} step={0.1}
              value={rate}
              onChange={e => setRate(parseFloat(e.target.value))}
              disabled={isAnyActive}
            />
            <div className="vp-slider-labels">
              <span>0.5×</span><span>2.0×</span>
            </div>
          </div>

          <div className="vp-section">
            <label className="vp-label">Message</label>
            <textarea
              className="vp-textarea"
              rows={4}
              placeholder="Type a message for ECHO to speak..."
              value={text}
              onChange={e => { setText(e.target.value); setTtsError('') }}
              disabled={isSpeaking}
            />
            {ttsError && <span className="vp-error">{ttsError}</span>}
          </div>

          <button
            className="vp-speak-btn"
            onClick={speak}
            disabled={isAnyActive || !ttsSupported}
          >
            {isSpeaking
              ? <><span className="speaking-wave"><span /><span /><span /><span /><span /></span>Speaking...</>
              : <>◈ Speak</>}
          </button>
        </div>
      </motion.div>

      {/* ── Card 3: Storyboard Demo ──────────────────────────── */}
      <motion.div
        className="card vp-card vp-storyboard-card"
        custom={2}
        variants={cardVariants}
        initial="hidden"
        animate="visible"
      >
        <StoryboardDemo
          voices={voices}
          selectedVoice={selectedVoice}
          rate={rate}
          isOtherActive={isAnyActive}
          ttsSupported={ttsSupported}
          stopRef={sbStopRef}
        />
      </motion.div>

    </div>
  )
}
