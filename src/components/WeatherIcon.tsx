import { type WeatherIconCode } from '../services/buienradarService'

export type { WeatherIconCode }

// ── Asset loader ──────────────────────────────────────────────
// Vite resolves every SVG in the animated folder at build time.
// Returns {} gracefully if no files match.
const ICON_ASSETS = import.meta.glob<string>(
  '../assets/weather-icons/animated/*.svg',
  { eager: true, query: '?url', import: 'default' },
)

function asset(filename: string): string | undefined {
  return ICON_ASSETS[`../assets/weather-icons/animated/${filename}`]
}

// ── WeatherIconCode → animated SVG filename ───────────────────
// Edit values here if you want to swap individual icons.
const FILE_MAP: Record<WeatherIconCode, string> = {
  'sunny':         'day.svg',
  'mostly-sunny':  'cloudy-day-1.svg',
  'partly-cloudy': 'cloudy-day-2.svg',
  'mostly-cloudy': 'cloudy-day-3.svg',
  'overcast':      'cloudy.svg',
  'drizzle':       'rainy-6.svg',   // scattered showers
  'rain':          'rainy-3.svg',   // steady rain
  'thunderstorm':  'thunder.svg',
  'snow':          'snowy-3.svg',
  'fog':           'cloudy.svg',
}

// ── Component ─────────────────────────────────────────────────

interface Props {
  code: WeatherIconCode
  size?: number
}

export default function WeatherIcon({ code, size = 64 }: Props) {
  const url = asset(FILE_MAP[code])

  if (!url) {
    return (
      <span
        style={{
          display: 'inline-block',
          width: size,
          height: size,
          borderRadius: 4,
          background: 'var(--border)',
          flexShrink: 0,
        }}
      />
    )
  }

  return (
    <img
      src={url}
      width={size}
      height={size}
      alt={code}
      className="weather-icon-img"
      draggable={false}
    />
  )
}
