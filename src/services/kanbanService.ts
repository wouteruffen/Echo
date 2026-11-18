import { supabase } from '../lib/supabase'
import type { KanbanCard, KanbanList, KanbanPriority, KanbanStatus } from '../types/kanban'

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
  const { data, error } = await api.from('kanban_lists').select('id, title, system_status, position, created_at').order('position')
  if (error) throw error
  if (data.length) return data as KanbanList[]

  const { error: createError } = await api.from('kanban_lists').upsert(defaultLists, { onConflict: 'user_id,system_status', ignoreDuplicates: true })
  if (createError) throw createError
  const { data: created, error: reloadError } = await api.from('kanban_lists').select('id, title, system_status, position, created_at').order('position')
  if (reloadError) throw reloadError
  return created as KanbanList[]
}

export async function createList(title: string, position: number): Promise<KanbanList> {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Een lijst heeft een naam nodig.')
  const { data, error } = await client().from('kanban_lists').insert({ title: cleanTitle, position }).select('id, title, system_status, position, created_at').single()
  if (error) throw error
  return data as KanbanList
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
  const { data, error } = await client().from('kanban_lists').update({ title: cleanTitle }).eq('id', id).select('id, title, system_status, position, created_at').single()
  if (error) throw error
  return data as KanbanList
}

export async function deleteList(id: string): Promise<void> {
  const { error } = await client().from('kanban_lists').delete().eq('id', id)
  if (error) throw error
}
