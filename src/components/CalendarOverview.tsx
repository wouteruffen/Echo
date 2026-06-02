import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  getStoredToken,
  loadGIS,
  requestToken,
  revokeAndClear,
  fetchTodayEvents,
  type CalendarEvent,
} from '../services/calendarService'

function todayLabel(): string {
  return new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })
}

export default function CalendarOverview() {
  const [connected, setConnected] = useState(() => !!getStoredToken())
  const [events, setEvents]       = useState<CalendarEvent[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)

  // ── Fetch events ──────────────────────────────────────────
  const fetchEvents = useCallback(async () => {
    const token = getStoredToken()
    if (!token) { setConnected(false); return }

    setLoading(true)
    try {
      const data = await fetchTodayEvents(token)
      setEvents(data)
      setError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'unknown'
      if (msg === 'auth_expired') {
        setConnected(false)
        setError('Session expired — please reconnect.')
      } else {
        setError('Could not load calendar events.')
      }
    } finally {
      setLoading(false)
    }
  }, [])

  // Preload GIS so the Connect button fires instantly
  useEffect(() => { loadGIS().catch(() => {}) }, [])

  // Fetch when first connected
  useEffect(() => {
    if (connected) fetchEvents()
  }, [connected, fetchEvents])

  // Refresh every 5 minutes while connected
  useEffect(() => {
    if (!connected) return
    const id = setInterval(fetchEvents, 5 * 60 * 1000)
    return () => clearInterval(id)
  }, [connected, fetchEvents])

  // ── Actions ───────────────────────────────────────────────
  const handleConnect = async () => {
    setSigningIn(true)
    setError(null)
    try {
      await requestToken()
      setConnected(true)
    } catch (e) {
      const msg = e instanceof Error ? e.message : ''
      if (msg !== 'popup_closed_by_user' && msg !== 'access_denied') {
        setError('Sign-in failed. Try again.')
      }
    } finally {
      setSigningIn(false)
    }
  }

  const handleDisconnect = () => {
    revokeAndClear()
    setConnected(false)
    setEvents([])
    setError(null)
  }

  // ── Render ────────────────────────────────────────────────
  return (
    <motion.div
      className="card calendar-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35, duration: 0.6 }}
      whileHover={{ borderColor: 'rgba(255,255,255,0.12)' }}
    >
      <div className="card-header">
        <span className="card-label">Google Calendar</span>
        {connected && !error
          ? <span className="card-tag green">{todayLabel()}</span>
          : !connected
            ? <span className="card-tag">Not connected</span>
            : null
        }
      </div>

      {/* ── Not connected ── */}
      {!connected && (
        <div className="cal-connect-wrap">
          <p className="cal-hint">
            Connect your Google Calendar to see today's schedule in ECHO.
          </p>
          <button
            className="cal-connect-btn"
            onClick={handleConnect}
            disabled={signingIn}
          >
            {signingIn ? 'Connecting…' : 'Connect Google Calendar'}
          </button>
          {error && <p className="cal-error">{error}</p>}
        </div>
      )}

      {/* ── Connected — loading first batch ── */}
      {connected && loading && events.length === 0 && (
        <div className="weather-loading" style={{ padding: '20px 0' }}>
          <span className="weather-loading-dot" />
          <span className="weather-loading-dot" />
          <span className="weather-loading-dot" />
        </div>
      )}

      {/* ── Connected — error ── */}
      {connected && error && (
        <p className="cal-error">{error}</p>
      )}

      {/* ── Connected — event list ── */}
      {connected && !error && events.length > 0 && (
        <div className="cal-events">
          {events.map(ev => (
            <div key={ev.id} className="cal-event">
              <span className="cal-event-time">
                {ev.allDay ? 'All day' : ev.start}
              </span>
              <span className="cal-event-title">{ev.title}</span>
              {!ev.allDay && ev.end && ev.end !== ev.start && (
                <span className="cal-event-end">–&thinsp;{ev.end}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Connected — empty ── */}
      {connected && !error && !loading && events.length === 0 && (
        <p className="cal-empty">No events today.</p>
      )}

      {/* ── Disconnect link ── */}
      {connected && (
        <div className="cal-footer">
          <button className="cal-disconnect" onClick={handleDisconnect}>
            Disconnect
          </button>
        </div>
      )}
    </motion.div>
  )
}
