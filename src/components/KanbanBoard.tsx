import { useEffect, useState, type FormEvent } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { createCard, listCards, updateCardDetails, updateCardStatus } from '../services/kanbanService'
import { KANBAN_STATUSES, type KanbanCard, type KanbanPriority, type KanbanStatus } from '../types/kanban'

const statusLabels: Record<KanbanStatus, string> = { inbox: 'Inbox', todo: 'Te doen', in_progress: 'Bezig', waiting: 'Wachten', done: 'Klaar' }
const priorityLabels: Record<KanbanPriority, string> = { high: 'Hoog', medium: 'Normaal', low: 'Laag' }

function dueDateValue(value: string | null) {
  return value ? value.slice(0, 10) : ''
}

function readableDate(value: string | null) {
  return value ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(value)) : null
}

export default function KanbanBoard() {
  const [cards, setCards] = useState<KanbanCard[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<KanbanCard | null>(null)
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<KanbanPriority>('medium')
  const [dueDate, setDueDate] = useState('')

  useEffect(() => {
    if (!isSupabaseConfigured) return
    listCards().then(setCards).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'De kaarten konden niet worden geladen.')).finally(() => setLoading(false))
  }, [])

  function openEditor(card: KanbanCard) {
    setEditing(card)
    setTitle(card.title)
    setDescription(card.description ?? '')
    setPriority(card.priority)
    setDueDate(dueDateValue(card.due_at))
    setError(null)
  }

  function closeEditor() {
    setEditing(null)
    setTitle('')
    setDescription('')
    setPriority('medium')
    setDueDate('')
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return
    setSaving(true); setError(null)
    try {
      const card = await createCard(title)
      setCards((current) => [...current, card])
      setTitle('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'De kaart kon niet worden aangemaakt.')
    } finally { setSaving(false) }
  }

  async function handleSaveDetails(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editing || !title.trim()) return
    setSaving(true); setError(null)
    try {
      const updated = await updateCardDetails(editing.id, {
        title,
        description: description.trim() || null,
        priority,
        dueAt: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null,
      })
      setCards((current) => current.map((item) => item.id === updated.id ? updated : item))
      closeEditor()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'De kaart kon niet worden opgeslagen.')
    } finally { setSaving(false) }
  }

  async function handleStatusChange(card: KanbanCard, status: KanbanStatus) {
    if (card.status === status) return
    setError(null)
    try {
      const updated = await updateCardStatus(card.id, status)
      setCards((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'De kaart kon niet worden verplaatst.')
    }
  }

  if (!isSupabaseConfigured) return <section className="kanban-state"><strong>Supabase is nog niet gekoppeld.</strong><br />Voeg jouw project-URL en publishable key toe aan <code>.env.local</code>.</section>

  return (
    <>
      <form className="kanban-add-card" onSubmit={handleCreate}>
        <input className="kanban-add-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Nieuwe taak toevoegen…" aria-label="Nieuwe taak" />
        <button className="kanban-add-button" disabled={saving || !title.trim()}>{saving ? 'Opslaan…' : 'Toevoegen'}</button>
      </form>

      {error && <p className="kanban-state kanban-state--error">{error}</p>}

      {loading ? <section className="kanban-state">ECHO haalt jouw kaarten op…</section> : (
        <section className="kanban-columns" aria-label="Kanbanbord">
          {KANBAN_STATUSES.map((status) => {
            const columnCards = cards.filter((card) => card.status === status)
            return <article className="kanban-column" key={status}>
              <header className="kanban-column-header"><h2 className="kanban-column-title">{statusLabels[status]}</h2><span className="kanban-count">{columnCards.length}</span></header>
              {columnCards.length === 0 ? <p className="kanban-empty">Nog geen kaarten hier.</p> : columnCards.map((card) => (
                <div className="kanban-card" key={card.id}>
                  <button className="kanban-card-open" type="button" onClick={() => openEditor(card)}><p className="kanban-card-title">{card.title}</p>{card.description && <p className="kanban-card-description">{card.description}</p>}</button>
                  <div className="kanban-card-footer">
                    <div><span className={`kanban-priority kanban-priority--${card.priority}`}>{priorityLabels[card.priority]}</span>{readableDate(card.due_at) && <span className="kanban-due-date">· {readableDate(card.due_at)}</span>}</div>
                    <select className="kanban-status-select" value={card.status} onChange={(event) => handleStatusChange(card, event.target.value as KanbanStatus)} aria-label={`Status van ${card.title}`}>
                      {KANBAN_STATUSES.map((option) => <option key={option} value={option}>{statusLabels[option]}</option>)}
                    </select>
                  </div>
                </div>
              ))}
            </article>
          })}
        </section>
      )}

      {editing && <div className="kanban-modal-backdrop" role="presentation" onMouseDown={closeEditor}>
        <section className="kanban-modal" role="dialog" aria-modal="true" aria-labelledby="card-editor-title" onMouseDown={(event) => event.stopPropagation()}>
          <header className="kanban-modal-header"><p className="kanban-eyebrow">Kaartdetails</p><button className="kanban-modal-close" type="button" onClick={closeEditor} aria-label="Sluiten">×</button></header>
          <h2 id="card-editor-title">Maak de taak concreet.</h2>
          <form className="kanban-editor-form" onSubmit={handleSaveDetails}>
            <label>Titel<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
            <label>Omschrijving<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Context, notities of een gewenste uitkomst…" rows={5} /></label>
            <div className="kanban-editor-row">
              <label>Prioriteit<select value={priority} onChange={(event) => setPriority(event.target.value as KanbanPriority)}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label>Deadline<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label>
            </div>
            <footer className="kanban-editor-actions"><button className="kanban-modal-cancel" type="button" onClick={closeEditor}>Annuleren</button><button className="kanban-add-button" disabled={saving || !title.trim()}>{saving ? 'Opslaan…' : 'Wijzigingen opslaan'}</button></footer>
          </form>
        </section>
      </div>}
    </>
  )
}
