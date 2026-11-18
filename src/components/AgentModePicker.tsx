import { useCallback, useState } from 'react'
import { AGENT_MODES, useAgentMode, type AgentMode } from '../hooks/useAgentMode'
import ListMenu from './ListMenu'
import ConfirmDialog from './ConfirmDialog'

export default function AgentModePicker() {
  const { mode, setModeId } = useAgentMode()
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const [pendingAuto, setPendingAuto] = useState<AgentMode | null>(null)
  const close = useCallback(() => setAnchor(null), [])
  const cancelAuto = useCallback(() => setPendingAuto(null), [])

  return <>
    <button type="button" className={`agent-mode agent-mode--${mode.tone}`} aria-haspopup="menu" aria-expanded={anchor !== null}
      aria-label={`Agentmodus: ${mode.label}. Kies een andere modus`} title={mode.description}
      onClick={(event) => { const target = event.currentTarget; setAnchor((current) => current ? null : target) }}>
      <span className="agent-mode-dot" aria-hidden="true" />
      <span className="agent-mode-label">{mode.short}</span>
      <span className="agent-mode-caret" aria-hidden="true">▾</span>
    </button>
    {anchor && <ListMenu anchor={anchor} label="Agentmodus" onClose={close} className="agent-mode-menu"
      actions={AGENT_MODES.map((item) => ({
        label: item.label,
        description: item.description,
        swatch: `var(--agent-${item.tone})`,
        selected: item.id === mode.id,
        // Auto mode gives ECHO the most freedom, so ask for explicit confirmation first.
        onSelect: () => { if (item.id === 'auto' && mode.id !== 'auto') setPendingAuto(item); else setModeId(item.id) },
      }))} />}
    {pendingAuto && <ConfirmDialog title="Automatische modus inschakelen?"
      message="ECHO mag dan zelf kaarten aanmaken, verplaatsen en bijwerken op je bord. Acties buiten het bord (zoals e-mail of agenda) vragen altijd eerst jouw bevestiging. Je kunt dit op elk moment terugzetten."
      confirmLabel="Inschakelen" tone="warning" onCancel={cancelAuto}
      onConfirm={() => { setModeId(pendingAuto.id); setPendingAuto(null) }} />}
  </>
}
