import { supabase } from '../lib/supabase'
import type { KanbanCard, KanbanList, KanbanPriority, KanbanStatus, ListColor } from '../types/kanban'

// '*' keeps older databases (without the optional `color` column) working.
const listFields = '*'
const withColor = (list: Omit<KanbanList, 'color'> & { color?: ListColor | null }): KanbanList => ({ ...list, color: list.color ?? null })
const cardFields = 'id, title, description, status, priority, due_at, position, list_id, created_at, updated_at'
const defaultLists: Array<Pick<KanbanList, 'title' | 'system_status' | 'position'>> = [
  { title: 'Inbox', system_status: 'inbox', position: 0 },
  { title: 'Te doen', system_status: 'todo', position: 1 },
  { title: 'Bezig', system_status: 'in_progress', position: 2 },
  { title: 'Wachten', system_status: 'waiting', position: 3 },
  { title: 'Klaar', system_status: 'done', position: 4 },
]

function client() {
  if (!supabase) throw new Error('Supabase is nog niet geconfigureerd.')
  return supabase
}

export async function listLists(): Promise<KanbanList[]> {
  const api = client()
  const { data, error } = await api.from('kanban_lists').select(listFields).order('position')
  if (error) throw error
  if (data.length) return (data as KanbanList[]).map(withColor)

  const { error: createError } = await api.from('kanban_lists').upsert(defaultLists, { onConflict: 'user_id,system_status', ignoreDuplicates: true })
  if (createError) throw createError
  const { data: created, error: reloadError } = await api.from('kanban_lists').select(listFields).order('position')
  if (reloadError) throw reloadError
  return (created as KanbanList[]).map(withColor)
}

export async function createList(title: string, position: number): Promise<KanbanList> {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Een lijst heeft een naam nodig.')
  const { data, error } = await client().from('kanban_lists').insert({ title: cleanTitle, position }).select(listFields).single()
  if (error) throw error
  return withColor(data as KanbanList)
}

export async function listCards(): Promise<KanbanCard[]> {
  const { data, error } = await client().from('kanban_cards').select(cardFields).order('position').order('created_at')
  if (error) throw error
  return data as KanbanCard[]
}

export async function createCard(title: string, list: KanbanList): Promise<KanbanCard> {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Een kaart heeft een titel nodig.')
  const { data, error } = await client().from('kanban_cards').insert({ title: cleanTitle, status: list.system_status ?? 'inbox', priority: 'medium', list_id: list.id }).select(cardFields).single()
  if (error) throw error
  return data as KanbanCard
}

export async function updateCardStatus(id: string, status: KanbanStatus): Promise<KanbanCard> {
  const { data, error } = await client().from('kanban_cards').update({ status }).eq('id', id).select(cardFields).single()
  if (error) throw error
  return data as KanbanCard
}

export async function updateCardDetails(id: string, details: { title: string; description: string | null; priority: KanbanPriority; dueAt: string | null; list: KanbanList }): Promise<KanbanCard> {
  const title = details.title.trim()
  if (!title) throw new Error('Een kaart heeft een titel nodig.')
  const { data, error } = await client().from('kanban_cards').update({ title, description: details.description, priority: details.priority, due_at: details.dueAt, list_id: details.list.id, status: details.list.system_status ?? 'inbox' }).eq('id', id).select(cardFields).single()
  if (error) throw error
  return data as KanbanCard
}

export async function renameList(id: string, title: string): Promise<KanbanList> {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Een lijst heeft een naam nodig.')
  const { data, error } = await client().from('kanban_lists').update({ title: cleanTitle }).eq('id', id).select(listFields).single()
  if (error) throw error
  return withColor(data as KanbanList)
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await client().from('kanban_lists').delete().eq('id', id)
  if (error) throw error
}

export interface CardPlacement {
  id: string
  list_id: string
  status: KanbanStatus
  position: number
}

export async function moveCards(placements: CardPlacement[]): Promise<void> {
  const api = client()
  const results = await Promise.all(placements.map(({ id, list_id, status, position }) =>
    api.from('kanban_cards').update({ list_id, status, position }).eq('id', id)))
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

export async function reorderLists(orderedIds: string[]): Promise<void> {
  const api = client()
  const results = await Promise.all(orderedIds.map((id, position) => api.from('kanban_lists').update({ position }).eq('id', id)))
  const failed = results.find((result) => result.error)
  if (failed?.error) throw failed.error
}

export async function deleteCard(id: string): Promise<void> {
  const { error } = await client().from('kanban_cards').delete().eq('id', id)
  if (error) throw error
}

export async function setListColor(id: string, color: ListColor | null): Promise<KanbanList> {
  const { data, error } = await client().from('kanban_lists').update({ color }).eq('id', id).select(listFields).single()
  if (error) throw error
  return withColor(data as KanbanList)
}
