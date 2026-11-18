import { supabase } from '../lib/supabase'
import type { KanbanCard, KanbanPriority, KanbanStatus } from '../types/kanban'

const cardFields = 'id, title, description, status, priority, due_at, position, created_at, updated_at'

function client() {
  if (!supabase) throw new Error('Supabase is nog niet geconfigureerd.')
  return supabase
}

export async function listCards(): Promise<KanbanCard[]> {
  const { data, error } = await client().from('kanban_cards').select(cardFields).order('position', { ascending: true }).order('created_at', { ascending: true })
  if (error) throw error
  return data as KanbanCard[]
}

export async function createCard(title: string): Promise<KanbanCard> {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Een kaart heeft een titel nodig.')
  const { data, error } = await client().from('kanban_cards').insert({ title: cleanTitle, status: 'inbox', priority: 'medium' }).select(cardFields).single()
  if (error) throw error
  return data as KanbanCard
}

export async function updateCardStatus(id: string, status: KanbanStatus): Promise<KanbanCard> {
  const { data, error } = await client().from('kanban_cards').update({ status }).eq('id', id).select(cardFields).single()
  if (error) throw error
  return data as KanbanCard
}

export async function updateCardDetails(
  id: string,
  details: { title: string; description: string | null; priority: KanbanPriority; dueAt: string | null },
): Promise<KanbanCard> {
  const title = details.title.trim()
  if (!title) throw new Error('Een kaart heeft een titel nodig.')
  const { data, error } = await client()
    .from('kanban_cards')
    .update({ title, description: details.description, priority: details.priority, due_at: details.dueAt })
    .eq('id', id)
    .select(cardFields)
    .single()
  if (error) throw error
  return data as KanbanCard
}
