import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { BACKGROUND_PRESETS, DEFAULT_BACKGROUND, type BackgroundId } from '../hooks/useBackground'

interface SettingsModalProps {
  background: BackgroundId
  onSelectBackground: (id: BackgroundId) => void
  onReset: () => void
  onClose: () => void
}

export default function SettingsModal({ background, onSelectBackground, onReset, onClose }: SettingsModalProps) {
  const dialogRef = useRef<HTMLElement>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    dialogRef.current?.querySelector<HTMLElement>('input:checked, button')?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); return }
      if (event.key !== 'Tab' || !dialogRef.current) return
      // Keep focus inside the dialog.
      const items = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button, input'))
      const focusable = items.filter((item) => !(item instanceof HTMLInputElement && item.type === 'radio' && !item.checked))
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('keydown', onKey); previous?.focus() }
  }, [onClose])

  return createPortal(
    <div className="settings-backdrop" role="presentation" onMouseDown={onClose}>
      <section ref={dialogRef} className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
        <header className="settings-header">
          <div>
            <p className="kanban-eyebrow">ECHO</p>
            <h2 id="settings-title">Instellingen</h2>
          </div>
          <button className="settings-close" type="button" aria-label="Instellingen sluiten" onClick={onClose}>×</button>
        </header>

        <fieldset className="settings-section">
          <legend>Display settings</legend>
          <p className="settings-hint">Achtergrond van de app. Wordt op dit apparaat bewaard.</p>
          <div className="settings-presets">
            {BACKGROUND_PRESETS.map((preset) => <label key={preset.id} className={`settings-preset${background === preset.id ? ' settings-preset--active' : ''}`}>
              <input type="radio" name="echo-background" value={preset.id} checked={background === preset.id} onChange={() => onSelectBackground(preset.id)} />
              <span className="settings-swatch" style={{ background: preset.swatch }} aria-hidden="true" />
              <span className="settings-preset-text"><strong>{preset.label}</strong><small>{preset.description}</small></span>
            </label>)}
          </div>
          <button className="settings-reset" type="button" onClick={onReset} disabled={background === DEFAULT_BACKGROUND}>Herstel standaard</button>
        </fieldset>
      </section>
    </div>,
    document.body,
  )
}
