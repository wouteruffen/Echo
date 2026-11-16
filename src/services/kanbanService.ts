import { supabase } from '../lib/supabase'
import type { KanbanCard, KanbanStatus } from '../types/kanban'

function client() {
  if (!supabase) {
    throw new Error('Supabase is nog niet geconfigureerd.')
  }

  return supabase
}

export async function listCards(): Promise<KanbanCard[]> {
  const { data, error } = await client()
    .from('kanban_cards')
    .select('id, title, description, status, priority, due_at, position, created_at, updated_at')
    .order('position', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) throw error
  return data as KanbanCard[]
}

export async function createCard(title: string): Promise<KanbanCard> {
  const cleanTitle = title.trim()
  if (!cleanTitle) throw new Error('Een kaart heeft een titel nodig.')

  const { data, error } = await client()
    .from('kanban_cards')
    .insert({ title: cleanTitle, status: 'inbox', priority: 'medium' })
    .select('id, title, description, status, priority, due_at, position, created_at, updated_at')
    .single()

  if (error) throw error
  return data as KanbanCard
}

export async function updateCardStatus(id: string, status: KanbanStatus): Promise<KanbanCard> {
  const { data, error } = await client()
    .from('kanban_cards')
    .update({ status })
    .eq('id', id)
    .select('id, title, description, status, priority, due_at, position, created_at, updated_at')
    .single()

  if (error) throw error
  return data as KanbanCard
}
