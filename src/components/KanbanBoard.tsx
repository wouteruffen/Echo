import { useEffect, useState, type FormEvent } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { createCard, createList, listCards, listLists, updateCardDetails } from '../services/kanbanService'
import { type KanbanCard, type KanbanList, type KanbanPriority } from '../types/kanban'

const priorityLabels: Record<KanbanPriority, string> = { high: 'Hoog', medium: 'Normaal', low: 'Laag' }
const readDate = (value: string | null) => value ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(value)) : null
const dateValue = (value: string | null) => value ? value.slice(0, 10) : ''

export default function KanbanBoard() {
  const [lists, setLists] = useState<KanbanList[]>([])
  const [cards, setCards] = useState<KanbanCard[]>([])
  const [newList, setNewList] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [cardList, setCardList] = useState<KanbanList | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [editing, setEditing] = useState<KanbanCard | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<KanbanPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    Promise.all([listLists(), listCards()]).then(([nextLists, nextCards]) => { setLists(nextLists); setCards(nextCards) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Het bord kon niet worden geladen.')).finally(() => setLoading(false))
  }, [])

  function cardsFor(list: KanbanList) {
    return cards.filter((card) => card.list_id ? card.list_id === list.id : card.status === list.system_status)
  }

  function openEditor(card: KanbanCard) {
    setEditing(card); setTitle(card.title); setDescription(card.description ?? ''); setPriority(card.priority); setDueDate(dateValue(card.due_at))
  }

  function closeEditor() { setEditing(null); setTitle(''); setDescription(''); setPriority('medium'); setDueDate('') }

  async function addList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newList.trim()) return
    setSaving(true)
    try { const list = await createList(newList, lists.length); setLists((all) => [...all, list]); setNewList(''); setAddingList(false) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'De lijst kon niet worden aangemaakt.') }
    finally { setSaving(false) }
  }

  async function addCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newTitle.trim() || !cardList) return
    setSaving(true)
    try { const card = await createCard(newTitle, cardList); setCards((all) => [...all, card]); setNewTitle(''); setCardList(null) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'De kaart kon niet worden aangemaakt.') }
    finally { setSaving(false) }
  }

  async function saveCard(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const list = lists.find((item) => item.id === (editing?.list_id ?? lists[0]?.id)) ?? lists[0]
    if (!editing || !list || !title.trim()) return
    setSaving(true)
    try {
      const updated = await updateCardDetails(editing.id, { title, description: description.trim() || null, priority, dueAt: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null, list })
      setCards((all) => all.map((item) => item.id === updated.id ? updated : item)); closeEditor()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'De kaart kon niet worden opgeslagen.') }
    finally { setSaving(false) }
  }

  if (!isSupabaseConfigured) return <section className="kanban-state"><strong>Supabase is nog niet gekoppeld.</strong></section>
  if (loading) return <section className="kanban-state">ECHO bouwt jouw bord op…</section>

  return <section className="trello-board">
    {error && <p className="kanban-state kanban-state--error">{error}</p>}
    <div className="trello-lists" aria-label="Kanbanbord">
      {lists.map((list) => <article className="trello-list" key={list.id}>
        <header className="trello-list-header"><h2>{list.title}</h2><span>{cardsFor(list).length}</span></header>
        <div className="trello-cards">
          {cardsFor(list).map((card) => <button className="trello-card" type="button" key={card.id} onClick={() => openEditor(card)}>
            <strong>{card.title}</strong>
            {card.description && <p>{card.description}</p>}
            <footer><span className={`kanban-priority kanban-priority--${card.priority}`}>{priorityLabels[card.priority]}</span>{readDate(card.due_at) && <span className="kanban-due-date">◷ {readDate(card.due_at)}</span>}</footer>
          </button>)}
        </div>
        {cardList?.id === list.id ? <form className="trello-add-card-form" onSubmit={addCard}><input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Titel van deze kaart" /><div><button type="submit" className="kanban-add-button" disabled={saving}>Toevoegen</button><button type="button" className="trello-text-button" onClick={() => setCardList(null)}>Annuleren</button></div></form> : <button className="trello-add-card" type="button" onClick={() => setCardList(list)}>＋ Kaart toevoegen</button>}
      </article>)}
      <div className="trello-add-list">
        {addingList ? <form onSubmit={addList}><input autoFocus value={newList} onChange={(event) => setNewList(event.target.value)} placeholder="Naam van je lijst" /><div><button className="kanban-add-button" disabled={saving}>Lijst toevoegen</button><button type="button" className="trello-text-button" onClick={() => setAddingList(false)}>Annuleren</button></div></form> : <button type="button" onClick={() => setAddingList(true)}>＋ Nieuwe lijst toevoegen</button>}
      </div>
    </div>

    {editing && <div className="kanban-modal-backdrop" role="presentation" onMouseDown={closeEditor}><section className="kanban-modal" role="dialog" aria-modal="true" onMouseDown={(event) => event.stopPropagation()}>
      <header className="kanban-modal-header"><p className="kanban-eyebrow">Kaartdetails</p><button className="kanban-modal-close" type="button" onClick={closeEditor}>×</button></header>
      <h2>Maak de taak concreet.</h2>
      <form className="kanban-editor-form" onSubmit={saveCard}>
        <label>Titel<input value={title} onChange={(event) => setTitle(event.target.value)} required /></label>
        <label>Omschrijving<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Context, notities of gewenste uitkomst…" rows={5} /></label>
        <div className="kanban-editor-row"><label>Prioriteit<select value={priority} onChange={(event) => setPriority(event.target.value as KanbanPriority)}>{Object.entries(priorityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label>Deadline<input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></label></div>
        <footer className="kanban-editor-actions"><button className="kanban-modal-cancel" type="button" onClick={closeEditor}>Annuleren</button><button className="kanban-add-button" disabled={saving}>Wijzigingen opslaan</button></footer>
      </form>
    </section></div>}
  </section>
}
