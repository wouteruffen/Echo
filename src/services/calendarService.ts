// ── Config ────────────────────────────────────────────────────
// Move to .env variables (VITE_GOOGLE_CLIENT_ID) for production.
const CLIENT_ID = '254230039265-m0tffepdcbo8g5vbk0umlrp6dlgcccn8.apps.googleusercontent.com'
const SCOPE     = 'https://www.googleapis.com/auth/calendar.readonly'
const CAL_BASE  = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

// localStorage keys
const LS_TOKEN  = 'echo_gcal_token'
const LS_EXPIRY = 'echo_gcal_expiry'

// ── Window type declarations ──────────────────────────────────
// Avoids installing @types/google.accounts.

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient(cfg: GisTokenConfig): GisTokenClient
          revoke(token: string, done?: () => void): void
        }
      }
    }
  }
}

interface GisTokenConfig {
  client_id: string
  scope: string
  callback: (resp: GisTokenResponse) => void
  error_callback?: (err: { type: string }) => void
}

interface GisTokenClient {
  requestAccessToken(overrides?: { prompt?: string }): void
}

interface GisTokenResponse {
  access_token: string
  expires_in: number   // seconds
  error?: string
  error_description?: string
}

// ── Public types ──────────────────────────────────────────────

export interface CalendarEvent {
  id: string
  title: string
  start: string    // 'HH:MM' or 'All day'
  end: string      // 'HH:MM' or ''
  allDay: boolean
  startISO: string // for sorting / terminal display
}

// ── Token storage (localStorage) ─────────────────────────────

export function getStoredToken(): string | null {
  const token  = localStorage.getItem(LS_TOKEN)
  const expiry = localStorage.getItem(LS_EXPIRY)
  if (!token || !expiry) return null
  if (Date.now() > Number(expiry)) {
    clearToken()
    return null
  }
  return token
}

export function isConnected(): boolean {
  return getStoredToken() !== null
}

function storeToken(token: string, expiresIn: number): void {
  // Subtract 60 s so we don't use a token right as it expires
  const expiry = Date.now() + (expiresIn - 60) * 1000
  localStorage.setItem(LS_TOKEN, token)
  localStorage.setItem(LS_EXPIRY, String(expiry))
}

export function clearToken(): void {
  localStorage.removeItem(LS_TOKEN)
  localStorage.removeItem(LS_EXPIRY)
}

// ── GIS script loader ─────────────────────────────────────────
// Singleton promise — safe to call multiple times.

let _gisPromise: Promise<void> | null = null

export function loadGIS(): Promise<void> {
  if (window.google?.accounts) return Promise.resolve()
  if (_gisPromise) return _gisPromise

  _gisPromise = new Promise<void>((resolve, reject) => {
    // Script may already be in DOM from HMR
    if (document.getElementById('gis-script')) {
      const poll = () =>
        window.google?.accounts ? resolve() : setTimeout(poll, 30)
      poll()
      return
    }

    const s = document.createElement('script')
    s.id    = 'gis-script'
    s.src   = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.defer = true
    s.onload = () => {
      const poll = () =>
        window.google?.accounts ? resolve() : setTimeout(poll, 30)
      poll()
    }
    s.onerror = () => {
      _gisPromise = null
      reject(new Error('Failed to load Google Identity Services'))
    }
    document.head.appendChild(s)
  })

  return _gisPromise
}

// ── OAuth token request ───────────────────────────────────────
// Opens the Google consent popup. Must be called from a user gesture.

export async function requestToken(): Promise<string> {
  await loadGIS()

  return new Promise<string>((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: CLIENT_ID,
      scope: SCOPE,
      callback(resp) {
        if (resp.error) {
          reject(new Error(resp.error_description ?? resp.error))
        } else {
          storeToken(resp.access_token, resp.expires_in)
          resolve(resp.access_token)
        }
      },
      error_callback(err) {
        reject(new Error(err.type))
      },
    })
    client.requestAccessToken({ prompt: '' })
  })
}

export function revokeAndClear(): void {
  const token = getStoredToken()
  if (token) {
    try { window.google?.accounts.oauth2.revoke(token) } catch { /* ignore */ }
  }
  clearToken()
}

// ── Calendar API ──────────────────────────────────────────────

interface RawEvent {
  id: string
  summary?: string
  start: { dateTime?: string; date?: string }
  end:   { dateTime?: string; date?: string }
}

function toLocalTime(dateTime?: string, date?: string): { label: string; allDay: boolean } {
  if (date) return { label: 'All day', allDay: true }
  if (!dateTime) return { label: '?', allDay: false }
  const label = new Date(dateTime).toLocaleTimeString('nl-NL', {
    hour: '2-digit', minute: '2-digit',
  })
  return { label, allDay: false }
}

export async function fetchTodayEvents(token: string): Promise<CalendarEvent[]> {
  const now   = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const end   = new Date(start.getTime() + 24 * 60 * 60 * 1000)

  const params = new URLSearchParams({
    timeMin:      start.toISOString(),
    timeMax:      end.toISOString(),
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '20',
  })

  const res = await fetch(`${CAL_BASE}?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401) {
    clearToken()
    throw new Error('auth_expired')
  }

  if (!res.ok) throw new Error(`calendar_api_${res.status}`)

  const json = await res.json() as { items?: RawEvent[] }
  const items = json.items ?? []

  return items.map(e => {
    const s  = toLocalTime(e.start.dateTime, e.start.date)
    const en = toLocalTime(e.end.dateTime, e.end.date)
    return {
      id:       e.id,
      title:    e.summary?.trim() || '(No title)',
      start:    s.label,
      end:      en.label,
      allDay:   s.allDay,
      startISO: e.start.dateTime ?? e.start.date ?? '',
    }
  })
}
