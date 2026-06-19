import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { translations, type Lang } from '../i18n/translations'
import { useSpeech } from '../hooks/useSpeech'
import EchoWaveform from './EchoWaveform'
import {
  turnAllLightsOn,
  turnAllLightsOff,
  setFocusMode,
  setEveningMode,
  getLights,
} from '../services/hueService'
import {
  getStoredToken,
  fetchTodayEvents,
} from '../services/calendarService'
import {
  fetchWeatherData,
  FALLBACK_WEATHER,
  type DayWeather,
} from '../services/buienradarService'
import { generateEchoInsight } from '../utils/echoInsight'

interface Message {
  id: number
  role: 'user' | 'echo'
  text: string
  timestamp: string
}

// ── Async action type ─────────────────────────────────────────

type AsyncAction = () => Promise<string>

// ── Calendar command matching ─────────────────────────────────

function matchCalendarCommand(input: string): AsyncAction | null {
  const t = input.toLowerCase().trim()

  const isCalQuery =
    /what\s+(is|are|'?s)\s+(my|on\s+(my|the))\s+(day|calendar|schedule|agenda)/.test(t) ||
    /what does my (day|schedule) look like/.test(t) ||
    /what is on my calendar/.test(t) ||
    /wat staat er vandaag op de planning/.test(t) ||
    /heb ik afspraken vandaag/.test(t) ||
    /agenda vandaag/.test(t)

  if (!isCalQuery) return null

  return async () => {
    const token = getStoredToken()

    if (!token) {
      return 'Your Google Calendar is not connected. Use the Calendar card on the dashboard to sign in.'
    }

    const events = await fetchTodayEvents(token)

    if (events.length === 0) {
      return 'Your calendar is clear today — no events scheduled.'
    }

    const timed  = events.filter(e => !e.allDay)
    const allDay = events.filter(e => e.allDay)

    const parts: string[] = []

    if (timed.length > 0) {
      const list = timed.map(e => `${e.start} ${e.title}`).join(', ')
      parts.push(
        `You have ${timed.length} event${timed.length > 1 ? 's' : ''} today: ${list}.`,
      )
    }

    if (allDay.length > 0) {
      parts.push(
        `All-day: ${allDay.map(e => e.title).join(', ')}.`,
      )
    }

    return parts.join(' ')
  }
}

// ── Hue command matching ──────────────────────────────────────

function matchHueCommand(input: string): AsyncAction | null {
  const t = input.toLowerCase().trim()

  if (/lights?\s+off|turn\s+(the\s+)?lights?\s+off/.test(t))
    return () => turnAllLightsOff().then(() => 'Lights off. Your Hue spots are switched off.')

  if (/lights?\s+on|turn\s+(the\s+)?lights?\s+on/.test(t))
    return () => turnAllLightsOn().then(() => 'Lights on. Your Hue spots are now active.')

  if (/focus\s+mode/.test(t))
    return () => setFocusMode().then(() =>
      'Focus mode activated. Your Hue lights are now set to a bright cool tone.')

  if (/evening\s+mode/.test(t))
    return () => setEveningMode().then(() =>
      'Evening mode activated. Your Hue lights are set to a warm, dimmed tone.')

  return null
}

// ── Mock fallback responses ───────────────────────────────────

const MOCK_RESPONSES: Array<{ keywords: string[]; response: string }> = [
  {
    keywords: ['summarize', 'summary', 'morning', 'recap'],
    response: 'Today starts with a clear schedule. Your first important moment is at 10:30.',
  },
  {
    keywords: ['routine', 'how'],
    response: "Your routine is on track. You've completed 2 of 5 planned moments. Next: a 10-minute walk at noon.",
  },
  {
    keywords: ['weather'],
    response: 'Partly cloudy, 17°C. No rain expected. A good window for an outdoor break at lunch.',
  },
  {
    keywords: ['task', 'todo', 'work', 'linear'],
    response: '3 tasks are queued for today. "API migration" is highest priority. Two deadlines approaching this week.',
  },
  {
    keywords: ['health', 'walk', 'break'],
    response: "You've been seated for 3 hours. A short walk would reset your focus and improve afternoon output.",
  },
]

function getMockResponse(input: string): string {
  const lower = input.toLowerCase()
  for (const entry of MOCK_RESPONSES) {
    if (entry.keywords.some(k => lower.includes(k))) return entry.response
  }
  return "Echo is learning from your patterns. Try asking about your calendar, lights, weather, or daily routine."
}

function getTimestamp() {
  return new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────

interface Props { lang: Lang }

export default function EchoTerminal({ lang }: Props) {
  const tr = translations[lang]

  const [messages, setMessages] = useState<Message[]>(() => [
    { id: 0, role: 'echo', text: translations[lang].echoReady, timestamp: getTimestamp() },
  ])
  const [input, setInput]           = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nextId    = useRef(1)

  const {
    enabled: voiceEnabled, isSpeaking, supported: voiceSupported,
    voices, selectedVoiceName, setSelectedVoice,
    speakEchoResponse, testVoice, toggle: toggleVoice,
    wordBoundaryCount, currentWordLength,
  } = useSpeech(lang)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isThinking])

  const submit = async () => {
    const trimmed = input.trim()
    if (!trimmed || isThinking) return

    const userMsg: Message = {
      id: nextId.current++,
      role: 'user',
      text: trimmed,
      timestamp: getTimestamp(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setIsThinking(true)

    let responseText: string

    // Priority: calendar → hue → mock
    const calAction = matchCalendarCommand(trimmed)
    const hueAction = !calAction ? matchHueCommand(trimmed) : null

    if (calAction) {
      const [text] = await Promise.all([
        calAction().catch(() =>
          'Could not reach Google Calendar. Check your connection and try again.'),
        new Promise<void>(r => setTimeout(r, 700)),
      ])
      responseText = text
    } else if (hueAction) {
      const [text] = await Promise.all([
        hueAction().catch(() =>
          'Could not reach the Hue Bridge. Make sure you are on the local network.'),
        new Promise<void>(r => setTimeout(r, 600)),
      ])
      responseText = text
    } else {
      await new Promise<void>(r => setTimeout(r, 700 + Math.random() * 600))
      responseText = getMockResponse(trimmed)
    }

    const echoMsg: Message = {
      id: nextId.current++,
      role: 'echo',
      text: responseText,
      timestamp: getTimestamp(),
    }
    setMessages(prev => [...prev, echoMsg])
    setIsThinking(false)
    speakEchoResponse(responseText)
  }

  const handleInsight = async () => {
    if (isThinking) return
    setIsThinking(true)

    const [weatherResult, lightsResult] = await Promise.allSettled([
      fetchWeatherData(),
      getLights(),
    ])

    const weather: DayWeather | null =
      weatherResult.status === 'fulfilled'
        ? (weatherResult.value.days[0] ?? null)
        : FALLBACK_WEATHER.days[0]

    const lightsOn: boolean | null =
      lightsResult.status === 'fulfilled'
        ? lightsResult.value.some(l => l.state.on)
        : null

    let events = [] as Awaited<ReturnType<typeof fetchTodayEvents>>
    const token = getStoredToken()
    if (token) {
      try { events = await fetchTodayEvents(token) } catch { /* no calendar */ }
    }

    const insight = generateEchoInsight({
      hour: new Date().getHours(),
      weather,
      events,
      lightsOn,
      lang,
    })

    const echoMsg: Message = {
      id: nextId.current++,
      role: 'echo',
      text: insight,
      timestamp: getTimestamp(),
    }
    setMessages(prev => [...prev, echoMsg])
    setIsThinking(false)
    speakEchoResponse(insight)
  }

  return (
    <motion.div
      className="card echo-terminal"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6, duration: 0.6 }}
    >
      <div className="card-header">
        <span className="card-label">{tr.echoTerminal}</span>
        <div className="echo-header-right">
          <button
            className="insight-btn"
            onClick={handleInsight}
            disabled={isThinking}
            title="Generate an Echo insight from your dashboard data"
          >
            BRIEF
          </button>
          <button
            className={`voice-toggle${voiceEnabled ? ' voice-toggle--active' : ''}`}
            onClick={toggleVoice}
            title={voiceEnabled ? 'Voice on — click to disable' : 'Voice off — click to enable'}
          >
            VOX
          </button>
          {isSpeaking ? (
            <span className="ai-pulse">
              <span className="speaking-wave">
                <span /><span /><span /><span /><span />
              </span>
              Speaking
            </span>
          ) : (
            <span className="ai-pulse"><span className="ai-dot" />{tr.ready}</span>
          )}
        </div>
      </div>

      <div className="voice-settings-row">
        <select
          className="voice-select"
          value={selectedVoiceName ?? ''}
          onChange={e => setSelectedVoice(e.target.value || null)}
          disabled={voices.length === 0}
        >
          <option value="">{voices.length === 0 ? 'Loading voices…' : 'Auto (fallback)'}</option>
          {voices.map(v => (
            <option key={v.name} value={v.name}>
              {v.name} ({v.lang})
            </option>
          ))}
        </select>
        <button
          className="voice-test-btn"
          onClick={() => testVoice('Hallo, ik ben ECHO. Dit is een test van de geselecteerde stem.')}
          disabled={!voiceSupported}
        >
          Test
        </button>
      </div>

      <EchoWaveform
        isSpeaking={isSpeaking}
        wordBoundaryCount={wordBoundaryCount}
        currentWordLength={currentWordLength}
      />

      <div className="terminal-output">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              className={`terminal-msg terminal-msg--${msg.role}`}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <span className="terminal-prompt">{msg.role === 'user' ? '>' : '~'}</span>
              <div className="terminal-msg-body">
                <span className="terminal-msg-text">{msg.text}</span>
                <span className="terminal-msg-ts">{msg.timestamp}</span>
              </div>
            </motion.div>
          ))}

          {isThinking && (
            <motion.div
              key="thinking"
              className="terminal-msg terminal-msg--echo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <span className="terminal-prompt">~</span>
              <div className="terminal-msg-body">
                <span className="terminal-thinking"><span /><span /><span /></span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <div ref={bottomRef} />
      </div>

      <div className="terminal-input-row">
        <span className="terminal-input-prompt">&gt;</span>
        <input
          className="terminal-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder={tr.askEcho}
          disabled={isThinking}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          className="terminal-send"
          onClick={submit}
          disabled={isThinking || !input.trim()}
        >
          Send
        </button>
      </div>
    </motion.div>
  )
}
