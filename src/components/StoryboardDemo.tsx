import { useState, useRef } from 'react'
import EchoWaveform from './EchoWaveform'
import { storyboardScenes } from '../data/storyboardScenes'

type SbStatus = 'idle' | 'speaking' | 'finished'

interface Props {
  voices: SpeechSynthesisVoice[]
  selectedVoice: string
  rate: number
  /** True when Voice Input or Voice Output is active — disables storyboard controls */
  isOtherActive: boolean
  ttsSupported: boolean
  /**
   * Parent writes a cancel function into this ref so it can call
   * stopStoryboard() before starting its own speech.
   */
  stopRef: React.MutableRefObject<() => void>
}

const TOTAL = storyboardScenes.length
// Gap between scenes (ms): time for the fade-out animation to complete
const INTER_SCENE_MS = 450

export default function StoryboardDemo({
  voices,
  selectedVoice,
  rate,
  isOtherActive,
  ttsSupported,
  stopRef,
}: Props) {
  const [sbStatus, setSbStatus] = useState<SbStatus>('idle')
  const [sceneIndex, setSceneIndex] = useState(0)
  const [sceneVisible, setSceneVisible] = useState(true)
  const [waveWordCount, setWaveWordCount] = useState(0)
  const [waveWordLen, setWaveWordLen] = useState(5)

  // Session stamp: invalidated on stop/restart so stale onend callbacks
  // do not advance to the next scene after the user has stopped playback.
  const sessionRef = useRef(0)

  // Keep latest props accessible inside async callbacks without stale closures.
  const voicesRef       = useRef(voices)
  const selectedVoiceRef = useRef(selectedVoice)
  const rateRef         = useRef(rate)
  voicesRef.current        = voices
  selectedVoiceRef.current = selectedVoice
  rateRef.current          = rate

  // Ref to the latest speakScene so setTimeout callbacks always call the
  // current version (avoids stale-closure recursion issues).
  const speakSceneRef = useRef<(index: number, session: number) => void>(() => {})

  const isSbSpeaking = sbStatus === 'speaking'
  const currentScene = storyboardScenes[sceneIndex]

  // ── Stop (exposed to parent via stopRef) ──────────────────────────────
  function stopStoryboard() {
    sessionRef.current = -1
    window.speechSynthesis.cancel()
    setSbStatus('idle')
    setSceneVisible(true)
  }

  // Keep parent's ref current so it can call stop at any time
  stopRef.current = stopStoryboard

  // ── Speak a single scene, then chain to the next ──────────────────────
  function speakScene(index: number, session: number) {
    if (session !== sessionRef.current) return

    if (index >= TOTAL) {
      setSbStatus('finished')
      setSceneVisible(true)
      return
    }

    setSceneIndex(index)
    setSceneVisible(true)

    const scene = storyboardScenes[index]
    const utterance = new SpeechSynthesisUtterance(scene.narration)

    // Prefer a Dutch voice for the Dutch narration; fall back to the
    // currently selected voice if no nl voice is installed.
    const dutchVoice = voicesRef.current.find(v => v.lang.startsWith('nl'))
    const voice = dutchVoice ?? voicesRef.current.find(v => v.name === selectedVoiceRef.current)
    if (voice) utterance.voice = voice
    utterance.rate = rateRef.current

    // Feed word boundaries into the waveform for reactive amplitude
    utterance.onboundary = (e: SpeechSynthesisEvent) => {
      if (e.name !== 'word') return
      if (session !== sessionRef.current) return
      setWaveWordCount(n => n + 1)
      setWaveWordLen(e.charLength ?? 5)
    }

    utterance.onend = () => {
      if (session !== sessionRef.current) return
      // Fade out current scene, then advance after the animation completes
      setSceneVisible(false)
      setTimeout(() => speakSceneRef.current(index + 1, session), INTER_SCENE_MS)
    }

    utterance.onerror = () => {
      if (session !== sessionRef.current) return
      setSbStatus('idle')
    }

    window.speechSynthesis.speak(utterance)
  }

  // Always point to the latest closure so setTimeout callbacks stay fresh
  speakSceneRef.current = speakScene

  // ── Start from scene 1 ────────────────────────────────────────────────
  function speakStoryboard() {
    const session = Date.now()
    sessionRef.current = session
    window.speechSynthesis.cancel()
    setSbStatus('speaking')
    setSceneIndex(0)
    setSceneVisible(true)
    setWaveWordCount(0)
    // Brief delay lets speechSynthesis.cancel() fully settle before we enqueue
    setTimeout(() => speakSceneRef.current(0, session), 80)
  }

  // ── Derived display values ────────────────────────────────────────────
  const statusLabel =
    isSbSpeaking           ? 'Speaking...' :
    sbStatus === 'finished' ? 'Finished'    : 'Idle'

  const statusClass =
    isSbSpeaking           ? 'vp-status--speaking'  :
    sbStatus === 'finished' ? 'vp-status--finished'  : ''

  const progressPct =
    sbStatus === 'finished'          ? 100 :
    sbStatus === 'idle' && sceneIndex === 0 ? 0   :
    ((sceneIndex + 1) / TOTAL) * 100

  const isDisabled = isOtherActive || !ttsSupported

  // Resolved voice that will be used for playback
  const dutchVoice    = voices.find(v => v.lang.startsWith('nl'))
  const resolvedVoice = dutchVoice ?? voices.find(v => v.name === selectedVoice)
  const voiceLabel    = resolvedVoice
    ? `${resolvedVoice.name} (${resolvedVoice.lang})`
    : 'No voice available'
  const isUsingDutch  = !!dutchVoice

  return (
    <>
      {/* ── Header ──────────────────────────────────────────── */}
      <div className="vp-card-header">
        <div>
          <span className="card-label">Storyboard Demo</span>
          <p className="vp-storyboard-subtitle">
            Experience how ECHO communicates in a realistic scenario.
          </p>
          <p className={`sb-voice-label ${isUsingDutch ? 'sb-voice-label--nl' : 'sb-voice-label--fallback'}`}>
            {isUsingDutch ? '🇳🇱 ' : '⚠ '}{voiceLabel}
          </p>
        </div>
        <div className={`vp-status ${statusClass}`}>
          <span className="vp-status-dot" />
          <span className="vp-status-text">{statusLabel}</span>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="vp-card-body">

        {/* Progress bar */}
        <div className="sb-progress-bar">
          <div
            className="sb-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* Scene content — fades between scenes */}
        <div className={`sb-narration${sceneVisible ? '' : ' sb-narration--hidden'}`}>
          <div className="sb-scene-meta">
            <h2 className="sb-scene-title">{currentScene.title}</h2>
            <span className="sb-scene-counter">
              Scene {sceneIndex + 1}&thinsp;/&thinsp;{TOTAL}
            </span>
          </div>
          <textarea
            className="vp-textarea vp-storyboard-text"
            rows={5}
            value={currentScene.narration}
            readOnly
          />
        </div>

        {/* Live waveform */}
        <EchoWaveform
          isSpeaking={isSbSpeaking}
          wordBoundaryCount={waveWordCount}
          currentWordLength={waveWordLen}
        />

        {/* Controls */}
        <div className="vp-storyboard-actions">
          <button
            className="vp-speak-btn"
            onClick={speakStoryboard}
            disabled={isDisabled || isSbSpeaking}
          >
            {isSbSpeaking ? (
              <>
                <span className="speaking-wave">
                  <span /><span /><span /><span /><span />
                </span>
                Speaking...
              </>
            ) : sbStatus === 'finished' ? (
              <>◈ Restart Storyboard</>
            ) : (
              <>◈ Speak Storyboard</>
            )}
          </button>

          <button
            className="vp-stop-btn"
            onClick={stopStoryboard}
            disabled={!isSbSpeaking}
          >
            ◻ Stop
          </button>
        </div>
      </div>
    </>
  )
}
