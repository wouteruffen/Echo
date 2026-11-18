import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

interface ConfirmDialogProps {
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
  tone?: 'danger' | 'warning'
}

export default function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, tone = 'danger' }: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Safe default: focus "Annuleren" so Enter never deletes by accident.
    cancelRef.current?.focus()
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); onCancel() }
      if (event.key === 'Tab') {
        event.preventDefault()
        const next = document.activeElement === cancelRef.current ? confirmRef.current : cancelRef.current
        next?.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true); previous?.focus() }
  }, [onCancel])

  return createPortal(
    <div className="kanban-modal-backdrop confirm-backdrop" role="presentation" onMouseDown={onCancel}>
      <section className="kanban-modal confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-message" onMouseDown={(event) => event.stopPropagation()}>
        <h2 id="confirm-title">{title}</h2>
        <p id="confirm-message">{message}</p>
        <footer className="kanban-editor-actions">
          <button ref={cancelRef} className="kanban-modal-cancel" type="button" onClick={onCancel}>Annuleren</button>
          <button ref={confirmRef} className={`confirm-danger-button${tone === 'warning' ? ' confirm-warning-button' : ''}`} type="button" onClick={onConfirm}>{confirmLabel}</button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
