// ── Config ────────────────────────────────────────────────────
// Hardcoded for local prototype. Move to .env variables for production:
//   VITE_HUE_IP, VITE_HUE_USER
const BRIDGE_IP = '192.168.1.170'
const USERNAME  = 'EqpKhrvho7k8SYeblpaylayyE1iN8plnkgUIduX6'

// Known light IDs on this bridge
const LIGHT_IDS = [9, 10, 11] as const

const BASE = `http://${BRIDGE_IP}/api/${USERNAME}`

// ── Types ─────────────────────────────────────────────────────

export interface HueLightState {
  on: boolean
  bri?: number
  ct?: number
  reachable: boolean
}

export interface HueLight {
  id: number
  name: string
  state: HueLightState
}

// Shape of a single light object in the Hue v1 response
interface RawLight {
  name: string
  state: {
    on: boolean
    bri?: number
    ct?: number
    reachable: boolean
  }
}

// ── HTTP helpers ──────────────────────────────────────────────

async function hueGet<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`Hue GET ${path} failed (${res.status})`)
  return res.json() as Promise<T>
}

async function huePut(path: string, body: object): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Hue PUT ${path} failed (${res.status})`)
}

// ── Public API ────────────────────────────────────────────────

export async function getLights(): Promise<HueLight[]> {
  const all = await hueGet<Record<string, RawLight>>('/lights')
  return LIGHT_IDS.map(id => ({
    id,
    name:  all[id]?.name ?? `Light ${id}`,
    state: all[id]?.state ?? { on: false, reachable: false },
  }))
}

export async function setLightState(
  lightId: number,
  state: Omit<HueLightState, 'reachable'>,
): Promise<void> {
  await huePut(`/lights/${lightId}/state`, state)
}

export async function turnAllLightsOn(): Promise<void> {
  await Promise.all(LIGHT_IDS.map(id => setLightState(id, { on: true })))
}

export async function turnAllLightsOff(): Promise<void> {
  await Promise.all(LIGHT_IDS.map(id => setLightState(id, { on: false })))
}

// Bright, cool-white — ideal for concentration
export async function setFocusMode(): Promise<void> {
  await Promise.all(
    LIGHT_IDS.map(id => setLightState(id, { on: true, ct: 180, bri: 200 })),
  )
}

// Warm, dimmed — ideal for winding down
export async function setEveningMode(): Promise<void> {
  await Promise.all(
    LIGHT_IDS.map(id => setLightState(id, { on: true, ct: 450, bri: 80 })),
  )
}
