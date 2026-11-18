import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { createPortal } from 'react-dom'

export interface ListMenuAction {
  label: string
  onSelect: () => void
  /** Leave the menu open, e.g. when the action swaps the menu contents. */
  keepOpen?: boolean
  danger?: boolean
  /** Renders the item as a radio option with a check mark. */
  selected?: boolean
  /** Optional colour dot in front of the label. */
  swatch?: string
  /** Secondary explanation under the label. */
  description?: string
}

interface ListMenuProps {
  anchor: HTMLElement
  label: string
  actions: ListMenuAction[]
  onClose: () => void
  /** Which edge of the trigger the menu lines up with. */
  align?: 'start' | 'end'
  className?: string
}

const GAP = 6
const EDGE = 8

export default function ListMenu({ anchor, label, actions, onClose, align = 'end', className }: ListMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    function place() {
      const menu = menuRef.current
      if (!menu) return
      const trigger = anchor.getBoundingClientRect()
      const { width, height } = menu.getBoundingClientRect()
      let left = align === 'start' ? trigger.left : trigger.right - width
      let top = trigger.bottom + GAP
      if (top + height > window.innerHeight - EDGE) top = trigger.top - height - GAP
      left = Math.min(Math.max(EDGE, left), window.innerWidth - width - EDGE)
      top = Math.min(Math.max(EDGE, top), window.innerHeight - height - EDGE)
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => { window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true) }
  }, [anchor, align])

  useEffect(() => {
    menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
    function onPointer(event: PointerEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || anchor.contains(target)) return
      onClose()
    }
    function onKey(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') { event.preventDefault(); onClose(); anchor.focus() }
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [anchor, onClose])

  function onMenuKey(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Tab') return
    const items = Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])
    if (!items.length) return
    event.preventDefault()
    const current = items.indexOf(document.activeElement as HTMLButtonElement)
    const step = event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1
    items[(current + step + items.length) % items.length].focus()
  }

  return createPortal(
    <div ref={menuRef} className={`trello-list-menu${className ? ` ${className}` : ''}`} role="menu" aria-label={label} onKeyDown={(event) => { event.stopPropagation(); onMenuKey(event) }}
      // React bubbles portal events through the component tree; keep them away from the card/list underneath.
      onClick={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}
      style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
      {(actions.length ? actions : [{ label: 'Geen andere lijsten', onSelect: () => undefined }] as ListMenuAction[]).map((action) => <button key={action.label} type="button"
        role={action.selected === undefined ? 'menuitem' : 'menuitemradio'} aria-checked={action.selected}
        className={[action.danger ? 'trello-menu-danger' : '', action.selected ? 'trello-menu-selected' : ''].filter(Boolean).join(' ') || undefined}
        onClick={() => { if (!action.keepOpen) onClose(); action.onSelect() }}>
        {action.swatch && <span className="trello-menu-swatch" style={{ background: action.swatch }} aria-hidden="true" />}
        <span className="trello-menu-label">{action.label}{action.description && <small>{action.description}</small>}</span>
        {action.selected && <span className="trello-menu-check" aria-hidden="true">✓</span>}
      </button>)}
    </div>,
    document.body,
  )
}
