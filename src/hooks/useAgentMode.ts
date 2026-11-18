import { useEffect, useState } from 'react'

export const AGENT_MODES = [
  { id: 'read_update', label: 'Lezen & bijwerken', short: 'Lezen & bijwerken', description: 'ECHO mag kaarten lezen en bestaande kaarten bijwerken, maar niets nieuws aanmaken of verwijderen.', tone: 'blue' },
  { id: 'suggest', label: 'Alleen voorstellen', short: 'Alleen voorstellen', description: 'ECHO doet alleen voorstellen. Jij accepteert of weigert ze; er verandert niets zonder jou.', tone: 'green' },
  { id: 'suggest_edit', label: 'Voorstellen met aanpassen', short: 'Voorstellen + aanpassen', description: 'ECHO doet voorstellen die jij eerst kunt verfijnen voordat je ze accepteert.', tone: 'purple' },
  { id: 'auto', label: 'Automatisch', short: 'Automatisch', description: 'ECHO voert wijzigingen op het bord zelf uit. Externe acties vragen altijd eerst jouw bevestiging.', tone: 'amber' },
] as const

export type AgentModeId = typeof AGENT_MODES[number]['id']
export type AgentMode = typeof AGENT_MODES[number]

const STORAGE_KEY = 'echo-agent-mode'
const DEFAULT_MODE: AgentModeId = 'suggest'

function isMode(value: string | null): value is AgentModeId {
  return AGENT_MODES.some((mode) => mode.id === value)
}

/** Agent permission mode for the board. Stored on this device until agents run server-side. */
export function useAgentMode() {
  const [modeId, setModeId] = useState<AgentModeId>(() => {
    try { const saved = localStorage.getItem(STORAGE_KEY); if (isMode(saved)) return saved } catch { /* storage unavailable */ }
    return DEFAULT_MODE
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, modeId) } catch { /* storage unavailable */ }
  }, [modeId])

  const mode = AGENT_MODES.find((item) => item.id === modeId) ?? AGENT_MODES[1]
  return { mode, setModeId }
}
