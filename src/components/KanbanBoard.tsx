import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent, type FormEvent, type KeyboardEvent } from 'react'
import { isSupabaseConfigured } from '../lib/supabase'
import { createCard, createList, deleteCard, deleteList, listCards, listLists, moveCards, renameList, reorderLists, setListColor, updateCardDetails, type CardPlacement } from '../services/kanbanService'
import { LIST_COLORS, type KanbanCard, type KanbanList, type KanbanPriority, type ListColor } from '../types/kanban'
import ListMenu from './ListMenu'
import ConfirmDialog from './ConfirmDialog'
import CardEchoPanel from './CardEchoPanel'

const priorityLabels: Record<KanbanPriority, string> = { high: 'Hoog', medium: 'Normaal', low: 'Laag' }
const readDate = (value: string | null) => value ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'short' }).format(new Date(value)) : null
const listColorLabels: Record<ListColor, string> = { blue: 'Blauw', teal: 'Turquoise', green: 'Groen', amber: 'Geel', orange: 'Oranje', red: 'Rood', pink: 'Roze', purple: 'Paars' }
const priorityOrder: KanbanPriority[] = ['high', 'medium', 'low']
const priorityColors: Record<KanbanPriority, string> = { high: 'var(--red)', medium: 'var(--amber)', low: 'var(--green)' }
const dateValue = (value: string | null) => value ? value.slice(0, 10) : ''

export default function KanbanBoard() {
  const [lists, setLists] = useState<KanbanList[]>([])
  const [cards, setCards] = useState<KanbanCard[]>([])
  const [newList, setNewList] = useState('')
  const [addingList, setAddingList] = useState(false)
  const [menu, setMenu] = useState<{ listId: string; anchor: HTMLElement; mode: 'main' | 'color' } | null>(null)
  const [renaming, setRenaming] = useState<{ listId: string; value: string } | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropTarget, setDropTarget] = useState<{ listId: string; index: number } | null>(null)
  const [cardList, setCardList] = useState<KanbanList | null>(null)
  const [newTitle, setNewTitle] = useState('')
  const [editing, setEditing] = useState<KanbanCard | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [priority, setPriority] = useState<KanbanPriority>('medium')
  const [dueDate, setDueDate] = useState('')
  const [editListId, setEditListId] = useState('')
  const [modalError, setModalError] = useState<string | null>(null)
  const [cardMenu, setCardMenu] = useState<{ cardId: string; anchor: HTMLElement; mode: 'main' | 'move' } | null>(null)
  const closeCardMenu = useCallback(() => setCardMenu(null), [])
  const [confirmCard, setConfirmCard] = useState<KanbanCard | null>(null)
  const cancelConfirm = useCallback(() => setConfirmCard(null), [])
  const [modalMenu, setModalMenu] = useState<HTMLElement | null>(null)
  const [picker, setPicker] = useState<{ kind: 'list' | 'priority'; anchor: HTMLElement } | null>(null)
  const closePicker = useCallback(() => setPicker(null), [])
  const closeModalMenu = useCallback(() => setModalMenu(null), [])
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const closeMenu = useCallback(() => setMenu(null), [])
  const addCardFormRef = useRef<HTMLFormElement>(null)
  const listsRef = useRef<HTMLDivElement>(null)
  const [listDragId, setListDragId] = useState<string | null>(null)
  const [listDropIndex, setListDropIndex] = useState<number | null>(null)
  const [scrollState, setScrollState] = useState({ left: false, right: false })

  const updateScrollState = useCallback(() => {
    const el = listsRef.current
    if (!el) return
    const next = { left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 }
    setScrollState((current) => current.left === next.left && current.right === next.right ? current : next)
  }, [])

  useEffect(() => {
    updateScrollState()
    window.addEventListener('resize', updateScrollState)
    return () => window.removeEventListener('resize', updateScrollState)
  }, [updateScrollState, lists.length, loading])

  function scrollBoard(direction: -1 | 1) {
    const el = listsRef.current
    if (el) el.scrollBy({ left: direction * Math.max(300, el.clientWidth * 0.7), behavior: 'smooth' })
  }

  async function moveList(listId: string, rawIndex: number) {
    const from = lists.findIndex((list) => list.id === listId)
    if (from < 0) return
    const ordered = lists.filter((list) => list.id !== listId)
    const index = Math.max(0, Math.min(rawIndex, ordered.length))
    if (index === from) return
    ordered.splice(index, 0, lists[from])
    const previous = lists
    setLists(ordered.map((list, position) => ({ ...list, position })))
    try { await reorderLists(ordered.map((list) => list.id)) }
    catch { setLists(previous); setError('De volgorde van de lijsten kon niet worden opgeslagen. De vorige volgorde is hersteld.') }
  }

  function dragOverListSlot(event: DragEvent<HTMLElement>, index: number) {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const next = event.clientX > rect.left + rect.width / 2 ? index + 1 : index
    if (listDropIndex !== next) setListDropIndex(next)
  }

  function dropList(event: DragEvent<HTMLElement>) {
    event.preventDefault()
    const id = listDragId
    const from = lists.findIndex((list) => list.id === id)
    const target = listDropIndex ?? from
    endListDrag()
    // Account for the dragged list still occupying its own slot.
    if (id) void moveList(id, from < target ? target - 1 : target)
  }

  function endListDrag() { setListDragId(null); setListDropIndex(null) }

  // Close the inline "add card" form on outside click or Escape.
  useEffect(() => {
    if (!cardList) return
    function onPointer(event: PointerEvent) {
      if (event.target instanceof Node && addCardFormRef.current?.contains(event.target)) return
      setCardList(null)
    }
    function onKey(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') setCardList(null) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [cardList])

  useEffect(() => {
    if (!isSupabaseConfigured) return
    Promise.all([listLists(), listCards()]).then(([nextLists, nextCards]) => { setLists(nextLists); setCards(nextCards) }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Het bord kon niet worden geladen.')).finally(() => setLoading(false))
  }, [])

  function cardsFor(list: KanbanList) {
    return cards
      .filter((card) => card.list_id ? card.list_id === list.id : card.status === list.system_status)
      .sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at))
  }

  async function moveCard(cardId: string, target: KanbanList, rawIndex: number) {
    const card = cards.find((item) => item.id === cardId)
    if (!card) return
    const source = lists.find((list) => card.list_id ? list.id === card.list_id : list.system_status === card.status)
    const targetCards = cardsFor(target).filter((item) => item.id !== cardId)
    const index = Math.max(0, Math.min(rawIndex, targetCards.length))
    const moved: KanbanCard = { ...card, list_id: target.id, status: target.system_status ?? card.status }
    targetCards.splice(index, 0, moved)

    const placements = new Map<string, CardPlacement>()
    targetCards.forEach((item, position) => placements.set(item.id, { id: item.id, list_id: target.id, status: item.status, position }))
    if (source && source.id !== target.id) {
      cardsFor(source).filter((item) => item.id !== cardId).forEach((item, position) => placements.set(item.id, { id: item.id, list_id: source.id, status: item.status, position }))
    }
    const changed = [...placements.values()].filter((placement) => {
      const before = cards.find((item) => item.id === placement.id)
      return !before || before.list_id !== placement.list_id || before.status !== placement.status || before.position !== placement.position
    })
    if (!changed.length) return

    const previous = cards
    setCards((all) => all.map((item) => { const placement = placements.get(item.id); return placement ? { ...item, ...placement } : item }))
    try { await moveCards(changed) }
    catch { setCards(previous); setError('De kaart kon niet worden verplaatst. De vorige volgorde is hersteld; probeer het opnieuw.') }
  }

  function dragOverCard(event: DragEvent<HTMLElement>, list: KanbanList, index: number) {
    if (!dragId) return
    event.preventDefault(); event.stopPropagation()
    event.dataTransfer.dropEffect = 'move'
    const rect = event.currentTarget.getBoundingClientRect()
    const next = event.clientY > rect.top + rect.height / 2 ? index + 1 : index
    if (dropTarget?.listId !== list.id || dropTarget.index !== next) setDropTarget({ listId: list.id, index: next })
  }

  function dragOverList(event: DragEvent<HTMLElement>, list: KanbanList) {
    if (!dragId) return
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    if (dropTarget?.listId !== list.id) setDropTarget({ listId: list.id, index: cardsFor(list).length })
  }

  function drop(event: DragEvent<HTMLElement>, list: KanbanList) {
    event.preventDefault()
    const id = dragId ?? event.dataTransfer.getData('text/plain')
    const target = dropTarget?.listId === list.id ? dropTarget.index : cardsFor(list).length
    // The dragged card still occupies a slot in its own list; correct when inserting below it.
    const ownIndex = cardsFor(list).findIndex((item) => item.id === id)
    const index = ownIndex >= 0 && ownIndex < target ? target - 1 : target
    endDrag()
    if (id) void moveCard(id, list, index)
  }

  function endDrag() { setDragId(null); setDropTarget(null) }

  function cardKeys(event: KeyboardEvent<HTMLElement>, card: KanbanCard, list: KanbanList, index: number) {
    if (event.target !== event.currentTarget) return
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openEditor(card); return }
    if (!event.altKey) return
    const listIndex = lists.findIndex((item) => item.id === list.id)
    if (event.key === 'ArrowUp' && index > 0) void moveCard(card.id, list, index - 1)
    else if (event.key === 'ArrowDown') void moveCard(card.id, list, index + 1)
    else if (event.key === 'ArrowLeft' && listIndex > 0) void moveCard(card.id, lists[listIndex - 1], cardsFor(lists[listIndex - 1]).length)
    else if (event.key === 'ArrowRight' && listIndex < lists.length - 1) void moveCard(card.id, lists[listIndex + 1], cardsFor(lists[listIndex + 1]).length)
    else return
    event.preventDefault()
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-card-id="${card.id}"]`)?.focus())
  }

  function listOf(card: KanbanCard) {
    return lists.find((item) => card.list_id ? item.id === card.list_id : item.system_status === card.status)
  }

  function openEditor(card: KanbanCard) {
    setEditing(card); setTitle(card.title); setDescription(card.description ?? ''); setPriority(card.priority); setDueDate(dateValue(card.due_at))
    setEditListId(listOf(card)?.id ?? lists[0]?.id ?? ''); setModalError(null)
  }

  function closeEditor() { setEditing(null); setTitle(''); setDescription(''); setPriority('medium'); setDueDate(''); setEditListId(''); setModalError(null); setModalMenu(null); setPicker(null) }

  // Escape closes the card modal, unless a menu or confirm dialog on top of it handles it first.
  useEffect(() => {
    if (!editing || modalMenu || picker || confirmCard) return
    function onKey(event: globalThis.KeyboardEvent) { if (event.key === 'Escape') { setEditing(null); setModalError(null) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [editing, modalMenu, picker, confirmCard])

  function removeCard(card: KanbanCard) { setConfirmCard(card) }

  async function confirmRemoveCard() {
    const card = confirmCard
    setConfirmCard(null)
    if (!card) return
    const previous = cards
    setCards((all) => all.filter((item) => item.id !== card.id))
    if (editing?.id === card.id) closeEditor()
    try { await deleteCard(card.id) }
    catch { setCards(previous); setError(`De kaart "${card.title}" kon niet worden verwijderd. Probeer het opnieuw.`) }
  }

  async function addList(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!newList.trim()) return
    setSaving(true)
    try { const list = await createList(newList, lists.length); setLists((all) => [...all, list]); setNewList(''); setAddingList(false) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'De lijst kon niet worden aangemaakt.') }
    finally { setSaving(false) }
  }

  async function commitRename() {
    if (!renaming) return
    const { listId, value } = renaming
    setRenaming(null)
    const list = lists.find((item) => item.id === listId)
    const name = value.trim()
    if (!list || !name || name === list.title) return
    setLists((all) => all.map((item) => item.id === listId ? { ...item, title: name } : item))
    try {
      const updated = await renameList(listId, name)
      setLists((all) => all.map((item) => item.id === updated.id ? updated : item))
    } catch {
      setLists((all) => all.map((item) => item.id === listId ? list : item))
      setError(`De lijst "${list.title}" kon niet worden hernoemd. Probeer het opnieuw.`)
    }
  }

  async function changeListColor(list: KanbanList, color: ListColor | null) {
    setLists((all) => all.map((item) => item.id === list.id ? { ...item, color } : item))
    try { await setListColor(list.id, color) }
    catch {
      setLists((all) => all.map((item) => item.id === list.id ? list : item))
      setError('De lijstkleur kon niet worden opgeslagen. Is de migratie voor lijstkleuren al uitgevoerd in Supabase?')
    }
  }

  async function removeList(list: KanbanList) {
    const listCards = cardsFor(list)
    if (listCards.length) { setError('Verplaats of verwijder eerst de kaarten uit deze lijst.'); return }
    if (!window.confirm(`Lijst "${list.title}" verwijderen?`)) return
    try {
      await deleteList(list.id)
      setLists((all) => all.filter((item) => item.id !== list.id))
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'De lijst kon niet worden verwijderd.') }
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
    if (!editing || !title.trim()) return
    const current = listOf(editing) ?? lists[0]
    const target = lists.find((item) => item.id === editListId) ?? current
    if (!current || !target) return
    setSaving(true); setModalError(null)
    try {
      const updated = await updateCardDetails(editing.id, { title, description: description.trim() || null, priority, dueAt: dueDate ? new Date(`${dueDate}T12:00:00`).toISOString() : null, list: current })
      setCards((all) => all.map((item) => item.id === updated.id ? updated : item))
      closeEditor()
      // A list change also needs new positions, so it goes through the regular move flow.
      if (target.id !== current.id) await moveCard(editing.id, target, cardsFor(target).length)
    } catch (reason) { setModalError(reason instanceof Error ? `Opslaan mislukt: ${reason.message}` : 'De kaart kon niet worden opgeslagen.') }
    finally { setSaving(false) }
  }

  const doneList = lists.find((item) => item.system_status === 'done')
  const editListTitle = lists.find((item) => item.id === editListId)?.title ?? 'Lijst'

  if (!isSupabaseConfigured) return <section className="kanban-state"><strong>Supabase is nog niet gekoppeld.</strong></section>
  if (loading) return <section className="kanban-state">ECHO bouwt jouw bord op…</section>

  return <section className="trello-board">
    {error && <p className="kanban-state kanban-state--error" role="alert">{error}</p>}
    <div className="trello-lists" aria-label="Kanbanbord" ref={listsRef} onScroll={updateScrollState}>
      {lists.map((list, listIndex) => {
        const visibleCards = cardsFor(list)
        const isDropList = dropTarget?.listId === list.id
        const indicator = <div className="trello-drop-indicator" aria-hidden="true" />
        const listIndicator = <div className="trello-list-drop-indicator" aria-hidden="true" onDragOver={(event) => { event.preventDefault() }} onDrop={dropList} />
        return <Fragment key={list.id}>
        {listDragId && listDropIndex === listIndex && listIndicator}
        <article style={list.color ? { '--list-accent': `var(--list-${list.color})` } as CSSProperties : undefined} className={`trello-list${list.color ? ' trello-list--colored' : ''}${isDropList ? ' trello-list--drop' : ''}${listDragId === list.id ? ' trello-list--dragging' : ''}`}
          onDragOver={(event) => { if (listDragId) dragOverListSlot(event, listIndex); else dragOverList(event, list) }}
          onDrop={(event) => { if (listDragId) dropList(event); else drop(event, list) }}>
          <header className="trello-list-header" draggable={renaming?.listId !== list.id} title="Sleep om de lijst te verplaatsen, dubbelklik op de titel om te hernoemen"
            onDragStart={(event) => { if (event.target !== event.currentTarget) return; event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('application/x-echo-list', list.id); setMenu(null); setListDragId(list.id) }}
            onDragEnd={endListDrag}>{renaming?.listId === list.id
              ? <input className="trello-list-title-input" autoFocus value={renaming.value} maxLength={80} aria-label="Lijstnaam"
                  onFocus={(event) => event.currentTarget.select()}
                  onChange={(event) => setRenaming({ listId: list.id, value: event.target.value })}
                  onBlur={() => { void commitRename() }}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur() } else if (event.key === 'Escape') { event.preventDefault(); setRenaming(null) } }} />
              : <h2 tabIndex={0} title="Dubbelklik om te hernoemen" onDoubleClick={() => setRenaming({ listId: list.id, value: list.title })}
                  onKeyDown={(event) => { if (event.key === 'Enter' || event.key === 'F2') { event.preventDefault(); setRenaming({ listId: list.id, value: list.title }) } }}>{list.title}</h2>}<div className="trello-list-actions"><span>{visibleCards.length}</span>
            <button className="trello-menu-trigger" type="button" aria-label={`Acties voor ${list.title}`} aria-haspopup="menu" aria-expanded={menu?.listId === list.id}
              onClick={(event) => { const anchor = event.currentTarget; setMenu((current) => current?.listId === list.id ? null : { listId: list.id, anchor, mode: 'main' }) }}>•••</button>
            {menu?.listId === list.id && <ListMenu key={menu.mode} anchor={menu.anchor} label={menu.mode === 'color' ? `Kleur voor ${list.title}` : `Acties voor ${list.title}`} onClose={closeMenu}
              actions={menu.mode === 'main' ? [
                { label: 'Lijstkleur…', swatch: list.color ? `var(--list-${list.color})` : undefined, keepOpen: true, onSelect: () => setMenu({ ...menu, mode: 'color' }) },
                { label: 'Lijst verwijderen', danger: true, onSelect: () => { void removeList(list) } },
              ] : [
                { label: 'Geen kleur', selected: list.color === null, onSelect: () => { void changeListColor(list, null) } },
                ...LIST_COLORS.map((color) => ({ label: listColorLabels[color], swatch: `var(--list-${color})`, selected: list.color === color, onSelect: () => { void changeListColor(list, color) } })),
              ]} />}
          </div></header>
          <div className="trello-cards" role="list" aria-label={`Kaarten in ${list.title}`}>
            {visibleCards.map((card, index) => <div key={card.id} role="listitem" className="trello-card-slot">
              {isDropList && dropTarget.index === index && indicator}
              <article className={`trello-card${dragId === card.id ? ' trello-card--dragging' : ''}`} data-card-id={card.id} role="button" tabIndex={0} draggable
                aria-label={`${card.title}. Enter om te bewerken, Alt + pijltjes om te verplaatsen.`}
                onDragStart={(event) => { event.dataTransfer.effectAllowed = 'move'; event.dataTransfer.setData('text/plain', card.id); setDragId(card.id) }}
                onDragEnd={endDrag}
                onDragOver={(event) => dragOverCard(event, list, index)}
                onClick={() => openEditor(card)} onKeyDown={(event) => cardKeys(event, card, list, index)}>
                <div className="trello-card-tools">
                  <button className="trello-card-edit" type="button" aria-label={`Acties voor ${card.title}: bewerken, verplaatsen of verwijderen`} aria-haspopup="menu" aria-expanded={cardMenu?.cardId === card.id} title="Kaartacties"
                    onKeyDown={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); const anchor = event.currentTarget; setCardMenu((current) => current?.cardId === card.id ? null : { cardId: card.id, anchor, mode: 'main' }) }}>⋯</button>
                </div>
                {cardMenu?.cardId === card.id && <ListMenu key={cardMenu.mode} anchor={cardMenu.anchor} label={cardMenu.mode === 'move' ? `Verplaats ${card.title} naar` : `Acties voor ${card.title}`} onClose={closeCardMenu}
                  actions={cardMenu.mode === 'main' ? [
                    { label: 'Kaart bewerken', onSelect: () => openEditor(card) },
                    { label: 'Kaart verplaatsen…', onSelect: () => setCardMenu({ ...cardMenu, mode: 'move' }), keepOpen: true },
                    { label: 'Kaart verwijderen', onSelect: () => { void removeCard(card) }, danger: true },
                  ] : lists.filter((target) => target.id !== list.id).map((target) => ({ label: `→ ${target.title}`, onSelect: () => { void moveCard(card.id, target, cardsFor(target).length) } }))} />}
                <strong>{card.title}</strong>
                {card.description && <p>{card.description}</p>}
                <footer><span className={`kanban-priority kanban-priority--${card.priority}`}>{priorityLabels[card.priority]}</span>{readDate(card.due_at) && <span className="kanban-due-date">◷ {readDate(card.due_at)}</span>}</footer>
              </article>
            </div>)}
            {isDropList && dropTarget.index >= visibleCards.length && indicator}
          </div>
          {cardList?.id === list.id ? <form ref={addCardFormRef} className="trello-add-card-form" onSubmit={addCard}><input autoFocus value={newTitle} onChange={(event) => setNewTitle(event.target.value)} placeholder="Titel van deze kaart" aria-label="Titel van nieuwe kaart" /><div><button type="submit" className="kanban-add-button" disabled={saving}>Toevoegen</button><button type="button" className="trello-text-button" onClick={() => setCardList(null)}>Annuleren</button></div></form> : <button className="trello-add-card" type="button" onClick={() => setCardList(list)}>＋ Kaart toevoegen</button>}
        </article>
        </Fragment>
      })}
      {listDragId && listDropIndex !== null && listDropIndex >= lists.length && <div className="trello-list-drop-indicator" aria-hidden="true" onDragOver={(event) => { event.preventDefault() }} onDrop={dropList} />}
      <div className="trello-add-list" onDragOver={(event) => { if (!listDragId) return; event.preventDefault(); setListDropIndex(lists.length) }} onDrop={(event) => { if (listDragId) dropList(event) }}>
        {addingList ? <form onSubmit={addList}><input autoFocus value={newList} onChange={(event) => setNewList(event.target.value)} placeholder="Naam van je lijst" /><div><button className="kanban-add-button" disabled={saving}>Lijst toevoegen</button><button type="button" className="trello-text-button" onClick={() => setAddingList(false)}>Annuleren</button></div></form> : <button type="button" onClick={() => setAddingList(true)}>＋ Nieuwe lijst toevoegen</button>}
      </div>
    </div>
    <nav className="trello-scroll-controls" aria-label="Bord horizontaal scrollen">
      <button type="button" aria-label="Scroll naar links" disabled={!scrollState.left} onClick={() => scrollBoard(-1)}>‹</button>
      <button type="button" aria-label="Scroll naar rechts" disabled={!scrollState.right} onClick={() => scrollBoard(1)}>›</button>
    </nav>

    {editing && <div className="kanban-modal-backdrop" role="presentation" onMouseDown={closeEditor}><section className={`card-modal card-modal--${priority}`} role="dialog" aria-modal="true" aria-label="Kaartdetails" onMouseDown={(event) => event.stopPropagation()}>
      <form onSubmit={saveCard}>
        <header className="card-modal-bar">
          <button type="button" className="card-chip card-chip--list" aria-haspopup="menu" aria-expanded={picker?.kind === 'list'} aria-label={`Lijst: ${editListTitle}. Kies een andere lijst`}
            onClick={(event) => { const anchor = event.currentTarget; setPicker((current) => current?.kind === 'list' ? null : { kind: 'list', anchor }) }}>
            <span className="card-chip-dot" aria-hidden="true" />{editListTitle}<span className="card-chip-caret" aria-hidden="true">▾</span>
          </button>
          <div className="card-modal-bar-actions">
            <button className="card-icon-button" type="button" aria-label="Meer kaartacties" aria-haspopup="menu" aria-expanded={modalMenu !== null}
              onClick={(event) => { const anchor = event.currentTarget; setModalMenu((current) => current ? null : anchor) }}>⋯</button>
            <button className="card-icon-button" type="button" aria-label="Kaartdetails sluiten" onClick={closeEditor}>×</button>
          </div>
          {picker?.kind === 'list' && <ListMenu anchor={picker.anchor} align="start" label="Kies een lijst" onClose={closePicker}
            actions={lists.map((item) => ({ label: item.title, selected: item.id === editListId, onSelect: () => setEditListId(item.id) }))} />}
          {modalMenu && <ListMenu anchor={modalMenu} label="Kaartacties" onClose={closeModalMenu} actions={[
            { label: 'Kaart verwijderen', onSelect: () => removeCard(editing), danger: true },
          ]} />}
        </header>

        <div className="card-modal-body">
          <div className="card-modal-title-row">
            {doneList && <button type="button" className={`card-done-toggle${editListId === doneList.id ? ' card-done-toggle--done' : ''}`}
              aria-pressed={editListId === doneList.id} aria-label={editListId === doneList.id ? 'Markeer als niet klaar' : `Markeer als klaar (naar ${doneList.title})`}
              onClick={() => setEditListId(editListId === doneList.id ? (listOf(editing)?.id === doneList.id ? lists[0]?.id ?? '' : listOf(editing)?.id ?? '') : doneList.id)}>
              {editListId === doneList.id ? '✓' : ''}
            </button>}
            <input className="card-title-input" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Titel" placeholder="Titel van de kaart" required />
          </div>

          <div className="card-fields">
            <div className="card-field">
              <span className="card-field-label" id="card-priority-label">Prioriteit</span>
              <button type="button" className={`card-chip card-chip--priority-${priority}`} aria-haspopup="menu" aria-expanded={picker?.kind === 'priority'} aria-labelledby="card-priority-label card-priority-value"
                onClick={(event) => { const anchor = event.currentTarget; setPicker((current) => current?.kind === 'priority' ? null : { kind: 'priority', anchor }) }}>
                <span className="card-chip-dot" aria-hidden="true" /><span id="card-priority-value">{priorityLabels[priority]}</span><span className="card-chip-caret" aria-hidden="true">▾</span>
              </button>
              {picker?.kind === 'priority' && <ListMenu anchor={picker.anchor} align="start" label="Kies een prioriteit" onClose={closePicker}
                actions={priorityOrder.map((value) => ({ label: priorityLabels[value], swatch: priorityColors[value], selected: value === priority, onSelect: () => setPriority(value) }))} />}
            </div>
            <div className="card-field">
              <label className="card-field-label" htmlFor="card-due">Deadline</label>
              <div className={`card-chip card-chip--date${dueDate ? ' card-chip--filled' : ''}`}>
                <span aria-hidden="true">◷</span>
                <input id="card-due" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
                {dueDate && <button type="button" className="card-chip-clear" aria-label="Deadline verwijderen" onClick={() => setDueDate('')}>×</button>}
              </div>
            </div>
          </div>

          <section className="card-section">
            <h3><span aria-hidden="true">☰</span> <label htmlFor="card-description">Omschrijving</label></h3>
            <textarea id="card-description" className="card-description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Voeg een uitgebreidere omschrijving toe…" rows={7} />
          </section>

          <CardEchoPanel key={editing.id} card={editing} onCardUpdated={(updated) => {
            // Reflect a user-approved ECHO suggestion in the board and in the open form.
            setCards((all) => all.map((item) => item.id === updated.id ? updated : item))
            setEditing(updated); setPriority(updated.priority); setDueDate(dateValue(updated.due_at))
          }} />

          {modalError && <p className="kanban-state kanban-state--error" role="alert">{modalError}</p>}
          <footer className="card-modal-actions">
            <span className="card-modal-meta">Aangemaakt {new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(editing.created_at))}</span>
            <button className="kanban-add-button" disabled={saving}>Opslaan</button>
            <button className="kanban-modal-cancel" type="button" onClick={closeEditor}>Annuleren</button>
          </footer>
        </div>
      </form>
    </section></div>}

    {confirmCard && <ConfirmDialog title="Kaart verwijderen?" message={`"${confirmCard.title}" wordt definitief verwijderd. Dit kan niet ongedaan worden gemaakt.`}
      confirmLabel="Verwijderen" onConfirm={() => { void confirmRemoveCard() }} onCancel={cancelConfirm} />}
  </section>
}
