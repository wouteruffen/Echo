import { useState, useEffect, useRef } from 'react'

type TtsStatus = 'idle' | 'speaking' | 'finished'
type SttLang = 'en-US' | 'nl-NL'

// webkitSpeechRecognition is not in the standard DOM types
declare global {
  interface Window {
    webkitSpeechRecognition?: typeof SpeechRecognition
  }
}

function getSpeechRecognitionCtor(): typeof SpeechRecognition | undefined {
  if (typeof window === 'undefined') return undefined
  return window.SpeechRecognition ?? window.webkitSpeechRecognition
}

export default function VoicePlayground() {
  // ── TTS state ─────────────────────────────────────────────
  const [text, setText] = useState('')
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([])
  const [selectedVoice, setSelectedVoice] = useState('')
  const [rate, setRate] = useState(1.0)
  const [ttsStatus, setTtsStatus] = useState<TtsStatus>('idle')
  const [ttsError, setTtsError] = useState('')

  // ── STT state ─────────────────────────────────────────────
  const [isListening, setIsListening] = useState(false)
  const [sttLang, setSttLang] = useState<SttLang>('en-US')
  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const textBeforeRef = useRef('')      // textarea content when session started
  const finalTranscriptRef = useRef('') // finalized words this session

  // ── Capabilities ──────────────────────────────────────────
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window
  const sttSupported = !!getSpeechRecognitionCtor()

  // Load TTS voices
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

  // Stop recognition on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop() }
  }, [])

  // ── TTS ───────────────────────────────────────────────────
  function speak() {
    if (!text.trim()) {
      setTtsError('Enter a message first.')
      return
    }
    setTtsError('')
    window.speechSynthesis.cancel()

    const utterance = new SpeechSynthesisUtterance(text)
    const voice = voices.find(v => v.name === selectedVoice)
    if (voice) utterance.voice = voice
    utterance.rate = rate

    utterance.onstart = () => setTtsStatus('speaking')
    utterance.onend = () => setTtsStatus('finished')
    utterance.onerror = () => setTtsStatus('idle')

    setTtsStatus('speaking')
    window.speechSynthesis.speak(utterance)
  }

  // ── STT ───────────────────────────────────────────────────
  function startListening() {
    const Ctor = getSpeechRecognitionCtor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = sttLang

    textBeforeRef.current = text.trim()
    finalTranscriptRef.current = ''

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let sessionFinal = finalTranscriptRef.current
      let interim = ''

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript
        if (event.results[i].isFinal) {
          sessionFinal += (sessionFinal ? ' ' : '') + transcript.trim()
          finalTranscriptRef.current = sessionFinal
        } else {
          interim = transcript
        }
      }

      const base = textBeforeRef.current
      const parts = [base, sessionFinal, interim].filter(Boolean)
      setText(parts.join(' '))
    }

    recognition.onend = () => {
      // Commit any interim text — make sure final ref is in the box
      const base = textBeforeRef.current
      const parts = [base, finalTranscriptRef.current].filter(Boolean)
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

  function stopListening() {
    recognitionRef.current?.stop()
  }

  function toggleListening() {
    if (isListening) stopListening()
    else startListening()
  }

  // ── Derived display values ─────────────────────────────────
  const isSpeaking = ttsStatus === 'speaking'

  const statusLabel =
    isListening   ? 'Listening' :
    isSpeaking    ? 'Speaking...' :
    ttsStatus === 'finished' ? 'Finished' :
    'Idle'

  const statusClass =
    isListening             ? 'vp-status--listening' :
    isSpeaking              ? 'vp-status--speaking' :
    ttsStatus === 'finished' ? 'vp-status--finished' :
    ''

  return (
    <div className="vp-panel card">

      {/* ── Message input ──────────────────────────────────── */}
      <div className="vp-section">
        <label className="vp-label">Message</label>
        <textarea
          className="vp-textarea"
          rows={5}
          placeholder="Type a message for ECHO to speak..."
          value={text}
          onChange={e => { setText(e.target.value); setTtsError('') }}
          disabled={isSpeaking}
        />
        {ttsError && <span className="vp-error">{ttsError}</span>}
      </div>

      {/* ── Speech-to-Text ─────────────────────────────────── */}
      <div className="vp-stt-section">
        <span className="vp-section-label">Voice Input</span>

        {sttSupported ? (
          <div className="vp-stt-row">
            <div className="vp-stt-lang">
              <button
                className={`vp-stt-lang-btn ${sttLang === 'en-US' ? 'vp-stt-lang-btn--active' : ''}`}
                onClick={() => setSttLang('en-US')}
                disabled={isListening}
                title="English"
              >
                EN
              </button>
              <button
                className={`vp-stt-lang-btn ${sttLang === 'nl-NL' ? 'vp-stt-lang-btn--active' : ''}`}
                onClick={() => setSttLang('nl-NL')}
                disabled={isListening}
                title="Dutch"
              >
                NL
              </button>
            </div>

            <button
              className={`vp-mic-btn ${isListening ? 'vp-mic-btn--active' : ''}`}
              onClick={toggleListening}
              disabled={isSpeaking}
            >
              {isListening ? (
                <>
                  <span className="vp-mic-pulse" />
                  Listening...
                </>
              ) : (
                <>🎙 Start Listening</>
              )}
            </button>

            {isListening && (
              <span className="vp-stt-hint">Click the button again to stop.</span>
            )}
          </div>
        ) : (
          <p className="vp-stt-unavailable">
            Speech recognition is not supported in this browser. Try Chrome or Edge.
          </p>
        )}
      </div>

      {/* ── Text-to-Speech controls ────────────────────────── */}
      <div className="vp-section">
        <span className="vp-section-label">Voice Output</span>
      </div>

      <div className="vp-row">
        <div className="vp-section vp-section--grow">
          <label className="vp-label">Voice</label>
          <select
            className="voice-select vp-select"
            value={selectedVoice}
            onChange={e => setSelectedVoice(e.target.value)}
            disabled={isSpeaking || isListening || !ttsSupported}
          >
            {voices.length === 0 && (
              <option value="">No voices available</option>
            )}
            {voices.map(v => (
              <option key={v.name} value={v.name}>
                {v.name} ({v.lang})
              </option>
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
            min={0.5}
            max={2.0}
            step={0.1}
            value={rate}
            onChange={e => setRate(parseFloat(e.target.value))}
            disabled={isSpeaking}
          />
          <div className="vp-slider-labels">
            <span>0.5×</span>
            <span>2.0×</span>
          </div>
        </div>
      </div>

      {/* ── Footer ────────────────────────────────────────── */}
      <div className="vp-footer">
        <div className={`vp-status ${statusClass}`}>
          <span className="vp-status-dot" />
          <span className="vp-status-text">{statusLabel}</span>
        </div>

        <button
          className="vp-speak-btn"
          onClick={speak}
          disabled={isSpeaking || isListening || !ttsSupported}
        >
          {isSpeaking ? (
            <>
              <span className="speaking-wave">
                <span /><span /><span /><span /><span />
              </span>
              Speaking...
            </>
          ) : (
            <>◈ Speak</>
          )}
        </button>
      </div>
    </div>
  )
}
