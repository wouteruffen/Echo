import { useEffect, useState } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { createCard, listCards, updateCardStatus } from '../services/kanbanService'
import { KANBAN_STATUSES, type KanbanCard, type KanbanStatus } from '../types/kanban'

const statusLabels: Record<KanbanStatus, string> = {
  inbox: 'Inbox',
  todo: 'Te doen',
  in_progress: 'Bezig',
  waiting: 'Wachten',
  done: 'Klaar',
}

const priorityLabels = {
  high: 'Hoog',
  medium: 'Normaal',
  low: 'Laag',
} as const

export default function KanbanBoard() {
  const [cards, setCards] = useState<KanbanCard[]>([])
  const [title, setTitle] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return

    listCards()
      .then(setCards)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'De kaarten konden niet worden geladen.'))
      .finally(() => setLoading(false))
  }, [])

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!title.trim()) return

    setSaving(true)
    setError(null)
    try {
      const card = await createCard(title)
      setCards((current) => [...current, card])
      setTitle('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'De kaart kon niet worden aangemaakt.')
    } finally {
      setSaving(false)
    }
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

  if (!isSupabaseConfigured) {
    return (
      <section className="kanban-state">
        <strong>Supabase is nog niet gekoppeld.</strong><br />
        Voeg straks jouw project-URL en publishable key toe aan <code>.env.local</code>. De echte kaarten blijven dan in jouw database en worden nooit naar GitHub geschreven.
      </section>
    )
  }

  return (
    <>
      <form className="kanban-add-card" onSubmit={handleCreate}>
        <input
          className="kanban-add-input"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Nieuwe taak toevoegen…"
          aria-label="Nieuwe taak"
        />
        <button className="kanban-add-button" disabled={saving || !title.trim()}>
          {saving ? 'Opslaan…' : 'Toevoegen'}
        </button>
      </form>

      {error && <p className="kanban-state kanban-state--error">{error}</p>}

      {loading ? (
        <section className="kanban-state">ECHO haalt jouw kaarten op…</section>
      ) : (
        <section className="kanban-columns" aria-label="Kanbanbord">
          {KANBAN_STATUSES.map((status) => {
            const columnCards = cards.filter((card) => card.status === status)
            return (
              <article className="kanban-column" key={status}>
                <header className="kanban-column-header">
                  <h2 className="kanban-column-title">{statusLabels[status]}</h2>
                  <span className="kanban-count">{columnCards.length}</span>
                </header>

                {columnCards.length === 0 ? (
                  <p className="kanban-empty">Nog geen kaarten hier.</p>
                ) : columnCards.map((card) => (
                  <div className="kanban-card" key={card.id}>
                    <p className="kanban-card-title">{card.title}</p>
                    <div className="kanban-card-footer">
                      <span className={`kanban-priority kanban-priority--${card.priority}`}>
                        {priorityLabels[card.priority]}
                      </span>
                      <select
                        className="kanban-status-select"
                        value={card.status}
                        onChange={(event) => handleStatusChange(card, event.target.value as KanbanStatus)}
                        aria-label={`Status van ${card.title}`}
                      >
                        {KANBAN_STATUSES.map((option) => (
                          <option key={option} value={option}>{statusLabels[option]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </article>
            )
          })}
        </section>
      )}
    </>
  )
}
