import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { translations, type Lang } from '../i18n/translations'
import {
  turnAllLightsOn,
  turnAllLightsOff,
  setFocusMode,
  setEveningMode,
} from '../services/hueService'

interface Message {
  id: number
  role: 'user' | 'echo'
  text: string
  timestamp: string
}

// ── Hue command matching ──────────────────────────────────────

type HueAction = () => Promise<string>

function matchHueCommand(input: string): HueAction | null {
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
    keywords: ['day', 'looking', 'schedule'],
    response: 'Your morning looks calm. You have two planned moments and enough time for focused work.',
  },
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
  return 'Echo is learning from your patterns. No direct match found — try asking about your day, focus mode, or routine.'
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
  const [input, setInput]       = useState('')
  const [isThinking, setIsThinking] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const nextId    = useRef(1)

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
    const hueAction = matchHueCommand(trimmed)

    if (hueAction) {
      // Real Hue call + minimum 600 ms thinking feel
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
        <span className="ai-pulse"><span className="ai-dot" />{tr.ready}</span>
      </div>

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
