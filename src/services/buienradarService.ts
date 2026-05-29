// ── Icon code type ────────────────────────────────────────────
// Defined here (not in the component) so the service owns the mapping.

export type WeatherIconCode =
  | 'sunny'
  | 'mostly-sunny'
  | 'partly-cloudy'
  | 'mostly-cloudy'
  | 'overcast'
  | 'drizzle'
  | 'rain'
  | 'thunderstorm'
  | 'snow'
  | 'fog'

// ── Raw API types ─────────────────────────────────────────────

export interface StationMeasurement {
  stationid: number
  stationname: string
  lat: number
  lon: number
  regio: string
  timestamp: string
  weatherdescription: string
  iconurl: string
  temperature: number
  feeltemperature?: number
  humidity?: number
  windspeed?: number
  winddirection?: string
  precipitation?: number
}

export interface FiveDayForecastEntry {
  day: string
  mintemperature: string
  maxtemperature: string
  rainChance: number
  sunChance: number
  weatherdescription: string
  iconurl: string
}

export interface BuienradarResponse {
  actual: {
    stationmeasurements: StationMeasurement[]
  }
  forecast: {
    fivedayforecast: FiveDayForecastEntry[]
  }
}

// Unified type covering both today (live station data) and forecast days
export interface DayWeather {
  dateIso: string
  isToday: boolean
  iconCode: WeatherIconCode
  high: number
  low: number
  description: string
  rainChance: number
  sunChance: number
  // Live station fields — only present for today
  current: number | null
  feelTemperature: number | null
  humidity: number | null
  windSpeed: number | null
  windDirection: string | null
}

export interface WeatherData {
  stationName: string
  lastUpdated: string
  isLive: boolean
  days: DayWeather[]   // [0] = today, [1..4] = upcoming
}

// ── Constants ─────────────────────────────────────────────────

const FEED_URL = 'https://data.buienradar.nl/2.0/feed/json'

const GRONINGEN_LAT = 53.2194
const GRONINGEN_LON = 6.5665

const ICON_MAP: Record<string, WeatherIconCode> = {
  a: 'sunny',
  b: 'mostly-sunny',
  c: 'partly-cloudy',
  d: 'mostly-cloudy',
  e: 'overcast',
  f: 'drizzle',
  g: 'rain',
  h: 'thunderstorm',
  i: 'snow',
  j: 'snow',
  m: 'rain',
  n: 'fog',
  q: 'thunderstorm',
  r: 'drizzle',
  s: 'snow',
  t: 'snow',
  u: 'partly-cloudy',
  v: 'sunny',
  w: 'mostly-sunny',
}

// ── Helpers ───────────────────────────────────────────────────

function iconFromUrl(url: string): WeatherIconCode {
  const match = url.match(/\/([a-zA-Z])\.png$/)
  return match ? (ICON_MAP[match[1].toLowerCase()] ?? 'overcast') : 'overcast'
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLon = toRad(lon2 - lon1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function closestStation(stations: StationMeasurement[]): StationMeasurement {
  return stations.reduce((best, s) => {
    const dBest = haversineKm(GRONINGEN_LAT, GRONINGEN_LON, best.lat, best.lon)
    const dS    = haversineKm(GRONINGEN_LAT, GRONINGEN_LON, s.lat, s.lon)
    return dS < dBest ? s : best
  })
}

function formatUpdateTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })
}

function futureDateIso(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString()
}

// ── Fallback (offline / fetch error) ─────────────────────────

export const FALLBACK_WEATHER: WeatherData = {
  stationName: 'Groningen',
  lastUpdated: '--:--',
  isLive: false,
  days: [
    {
      dateIso: new Date().toISOString(),
      isToday: true,
      iconCode: 'partly-cloudy',
      high: 18, low: 11,
      current: 17, feelTemperature: 15, humidity: 72, windSpeed: 3.2, windDirection: 'ZW',
      rainChance: 20, sunChance: 45,
      description: 'Partly cloudy',
    },
    {
      dateIso: futureDateIso(1), isToday: false,
      iconCode: 'rain',
      high: 14, low: 9,
      current: null, feelTemperature: null, humidity: null, windSpeed: null, windDirection: null,
      rainChance: 70, sunChance: 10, description: 'Rain showers',
    },
    {
      dateIso: futureDateIso(2), isToday: false,
      iconCode: 'mostly-sunny',
      high: 21, low: 13,
      current: null, feelTemperature: null, humidity: null, windSpeed: null, windDirection: null,
      rainChance: 10, sunChance: 65, description: 'Mostly sunny',
    },
    {
      dateIso: futureDateIso(3), isToday: false,
      iconCode: 'sunny',
      high: 24, low: 15,
      current: null, feelTemperature: null, humidity: null, windSpeed: null, windDirection: null,
      rainChance: 5, sunChance: 80, description: 'Sunny',
    },
    {
      dateIso: futureDateIso(4), isToday: false,
      iconCode: 'partly-cloudy',
      high: 20, low: 12,
      current: null, feelTemperature: null, humidity: null, windSpeed: null, windDirection: null,
      rainChance: 25, sunChance: 40, description: 'Partly cloudy',
    },
  ],
}

// ── Main export ───────────────────────────────────────────────

export async function fetchWeatherData(): Promise<WeatherData> {
  const res = await fetch(FEED_URL)
  if (!res.ok) throw new Error(`Buienradar responded with ${res.status}`)

  const data: BuienradarResponse = await res.json()
  const station = closestStation(data.actual.stationmeasurements)
  const fcArr   = data.forecast.fivedayforecast

  const todayFc = fcArr[0]
  const today: DayWeather = {
    dateIso: todayFc.day,
    isToday: true,
    iconCode: iconFromUrl(station.iconurl),
    high: parseInt(todayFc.maxtemperature, 10),
    low:  parseInt(todayFc.mintemperature, 10),
    description: station.weatherdescription,
    rainChance:  todayFc.rainChance,
    sunChance:   todayFc.sunChance,
    current:         Math.round(station.temperature),
    feelTemperature: station.feeltemperature != null ? Math.round(station.feeltemperature) : null,
    humidity:        station.humidity ?? null,
    windSpeed:       station.windspeed != null ? Math.round(station.windspeed * 10) / 10 : null,
    windDirection:   station.winddirection ?? null,
  }

  const forecastDays: DayWeather[] = fcArr.slice(1, 5).map(d => ({
    dateIso:      d.day,
    isToday:      false,
    iconCode:     iconFromUrl(d.iconurl),
    high:         parseInt(d.maxtemperature, 10),
    low:          parseInt(d.mintemperature, 10),
    description:  d.weatherdescription,
    rainChance:   d.rainChance,
    sunChance:    d.sunChance,
    current:         null,
    feelTemperature: null,
    humidity:        null,
    windSpeed:       null,
    windDirection:   null,
  }))

  return {
    stationName: station.stationname.replace('Meetstation ', ''),
    lastUpdated: formatUpdateTime(station.timestamp),
    isLive: true,
    days: [today, ...forecastDays],
  }
}
