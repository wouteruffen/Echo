import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  getLights,
  turnAllLightsOn,
  turnAllLightsOff,
  setFocusMode,
  setEveningMode,
  type HueLight,
} from '../services/hueService'

export default function HueControl() {
  const [lights, setLights]   = useState<HueLight[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [busy, setBusy]       = useState(false)

  const fetchLights = useCallback(async () => {
    try {
      const data = await getLights()
      setLights(data)
      setError(null)
    } catch {
      setError('Cannot reach Hue Bridge')
    } finally {
      setLoading(false)
    }
  }, [])

  // Initial fetch + poll every 6 s
  useEffect(() => {
    fetchLights()
    const timer = setInterval(fetchLights, 6000)
    return () => clearInterval(timer)
  }, [fetchLights])

  const run = async (fn: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
      // Brief pause so the bridge can process before we re-poll
      await new Promise(r => setTimeout(r, 300))
      await fetchLights()
    } catch {
      setError('Command failed — check bridge connection')
    } finally {
      setBusy(false)
    }
  }

  const offline = !!error
  const connectedCount = lights.filter(l => l.state.reachable).length

  return (
    <motion.div
      className="card hue-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.6 }}
      whileHover={{ borderColor: 'rgba(255,255,255,0.12)' }}
    >
      <div className="card-header">
        <span className="card-label">Philips Hue</span>
        {loading
          ? <span className="card-tag">…</span>
          : offline
            ? <span className="card-tag">Offline</span>
            : <span className="card-tag green">{connectedCount} connected</span>
        }
      </div>

      {/* Light list */}
      {loading ? (
        <div className="weather-loading" style={{ padding: '20px 0' }}>
          <span className="weather-loading-dot" />
          <span className="weather-loading-dot" />
          <span className="weather-loading-dot" />
        </div>
      ) : offline ? (
        <p className="hue-error">{error}</p>
      ) : (
        <div className="hue-lights">
          {lights.map(light => {
            const isOn  = light.state.on && light.state.reachable
            const reach = light.state.reachable
            return (
              <div key={light.id} className="hue-light-row">
                <span className={`hue-light-dot${isOn ? ' hue-light-dot--on' : ''}`} />
                <span className="hue-light-name">{light.name}</span>
                <span className="hue-light-badge">
                  {!reach ? 'unreachable' : isOn ? 'on' : 'off'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Scene buttons */}
      <div className="hue-actions">
        <button
          className="hue-btn"
          onClick={() => run(turnAllLightsOn)}
          disabled={busy || offline}
        >
          All On
        </button>
        <button
          className="hue-btn"
          onClick={() => run(turnAllLightsOff)}
          disabled={busy || offline}
        >
          All Off
        </button>
        <button
          className="hue-btn hue-btn--accent"
          onClick={() => run(setFocusMode)}
          disabled={busy || offline}
        >
          Focus
        </button>
        <button
          className="hue-btn hue-btn--amber"
          onClick={() => run(setEveningMode)}
          disabled={busy || offline}
        >
          Evening
        </button>
      </div>
    </motion.div>
  )
}
