import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { fetchWeatherData, FALLBACK_WEATHER, type WeatherData, type DayWeather } from '../services/buienradarService'
import { translations, type Lang } from '../i18n/translations'
import WeatherIcon from './WeatherIcon'

function dayLabel(day: DayWeather, lang: Lang): string {
  const tr = translations[lang]
  if (day.isToday) return tr.today.toUpperCase()

  const date = new Date(day.dateIso)
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (date.toDateString() === tomorrow.toDateString()) return tr.tomorrow.toUpperCase()

  const key = date.toLocaleDateString('en-GB', { weekday: 'short' })
  return (tr.daysFull[key] ?? key).toUpperCase()
}

interface Props { lang: Lang }

export default function WeatherCard({ lang }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchWeatherData()
      .then(data  => { if (!cancelled) { setWeather(data); setLoading(false) } })
      .catch(()   => { if (!cancelled) { setWeather(FALLBACK_WEATHER); setError(true); setLoading(false) } })
    return () => { cancelled = true }
  }, [])

  const tr = translations[lang]
  const w  = weather ?? FALLBACK_WEATHER

  return (
    <motion.div
      className="card weather-card"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2, duration: 0.6 }}
      whileHover={{ borderColor: 'rgba(255,255,255,0.12)' }}
    >
      <div className="card-header">
        <span className="card-label">{tr.weather}</span>
        <div className="weather-header-right">
          {!loading && w.isLive && (
            <span className="weather-live-badge">
              <span className="weather-live-dot" />
              LIVE
            </span>
          )}
          <span className="card-tag">{loading ? '…' : w.stationName}</span>
        </div>
      </div>

      {loading ? (
        <div className="weather-loading">
          <span className="weather-loading-dot" />
          <span className="weather-loading-dot" />
          <span className="weather-loading-dot" />
        </div>
      ) : (
        <>
          <div className="weather-days-grid">
            {w.days.map(day => (
              <div
                key={day.dateIso}
                className={`weather-day-card${day.isToday ? ' weather-day-card--today' : ''}`}
              >
                <div className="wdc-label">{dayLabel(day, lang)}</div>

                <div className="wdc-icon"><WeatherIcon code={day.iconCode} size={64} /></div>

                <div className="wdc-temp-block">
                  {day.isToday ? (
                    <>
                      <span className="wdc-current">{day.current ?? day.high}°</span>
                      <span className="wdc-highlow">{day.high}° / {day.low}°</span>
                    </>
                  ) : (
                    <span className="wdc-range">
                      <span className="wdc-high">{day.high}°</span>
                      <span className="wdc-slash">/</span>
                      <span className="wdc-low">{day.low}°</span>
                    </span>
                  )}
                </div>

                <div className="wdc-desc">{day.description}</div>

                <div className="wdc-details">
                  {day.isToday && day.feelTemperature != null && (
                    <div className="wdc-row">
                      <span className="wdc-row-label">{tr.feelsLike}</span>
                      <span className="wdc-row-value">{day.feelTemperature}°</span>
                    </div>
                  )}
                  {day.isToday && day.humidity != null && (
                    <div className="wdc-row">
                      <span className="wdc-row-label">{tr.humidity}</span>
                      <span className="wdc-row-value">{day.humidity}%</span>
                    </div>
                  )}
                  {day.isToday && day.windSpeed != null && (
                    <div className="wdc-row">
                      <span className="wdc-row-label">{tr.wind}</span>
                      <span className="wdc-row-value">
                        {day.windDirection ? `${day.windDirection} ` : ''}{day.windSpeed} m/s
                      </span>
                    </div>
                  )}
                  <div className="wdc-row">
                    <span className="wdc-row-label wdc-rain">💧 {tr.rain}</span>
                    <span className="wdc-row-value">{day.rainChance}%</span>
                  </div>
                  <div className="wdc-row">
                    <span className="wdc-row-label wdc-sun">☀ {tr.sun}</span>
                    <span className="wdc-row-value">{day.sunChance}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="weather-footer">
            <span className="weather-updated">
              {error && '⚠ Offline · '}{tr.updated} {w.lastUpdated}
            </span>
            <a
              href="https://www.buienradar.nl"
              target="_blank"
              rel="noopener noreferrer"
              className="weather-attribution"
            >
              {tr.attribution}
            </a>
          </div>
        </>
      )}
    </motion.div>
  )
}
