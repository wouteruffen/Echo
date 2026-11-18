import { FunctionsHttpError } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { KanbanCard, KanbanPriority } from '../types/kanban'

export interface CardProposal {
  summary: string
  suggestedPriority: KanbanPriority | null
  suggestedDeadline: string | null
  suggestedSubtasks: { title: string }[]
  reasoning: string
}

export interface CardAnalysis {
  proposalId: string
  proposal: CardProposal
}

export interface KanbanSubtask {
  id: string
  card_id: string
  title: string
  completed: boolean
  position: number
}

const cardFields = 'id, title, description, status, priority, due_at, position, list_id, created_at, updated_at'
const subtaskFields = 'id, card_id, title, completed, position'

function client() {
  if (!supabase) throw new Error('Supabase is nog niet geconfigureerd.')
  return supabase
}

/** Asks the analyze-card Edge Function for a proposal. Only the card id is sent. */
export async function analyzeCard(cardId: string): Promise<CardAnalysis> {
  const { data, error } = await client().functions.invoke<CardAnalysis>('analyze-card', { body: { cardId } })
  if (error) {
    if (error instanceof FunctionsHttpError) {
      // The function returns { error: { message } } with a Dutch, safe message.
      const body: unknown = await error.context.json().catch(() => null)
      const message = body && typeof body === 'object' && 'error' in body
        ? (body as { error?: { message?: unknown } }).error?.message
        : null
      throw new Error(typeof message === 'string' ? message : 'De analyse is mislukt.')
    }
    throw new Error('ECHO is niet bereikbaar. Controleer je verbinding en of de functie analyze-card is gedeployed.')
  }
  if (!data?.proposal) throw new Error('ECHO gaf geen bruikbaar voorstel terug.')
  return data
}

export async function resolveProposal(proposalId: string, status: 'accepted' | 'rejected'): Promise<void> {
  const { error } = await client().from('agent_proposals').update({ status, resolved_at: new Date().toISOString() }).eq('id', proposalId)
  if (error) throw error
}

/** Applies a single field change chosen by the user. */
export async function updateCardFields(cardId: string, fields: { priority?: KanbanPriority; due_at?: string | null }): Promise<KanbanCard> {
  const { data, error } = await client().from('kanban_cards').update(fields).eq('id', cardId).select(cardFields).single()
  if (error) throw error
  return data as KanbanCard
}

export async function listSubtasks(cardId: string): Promise<KanbanSubtask[]> {
  const { data, error } = await client().from('kanban_subtasks').select(subtaskFields).eq('card_id', cardId).order('position').order('created_at')
  if (error) throw error
  return data as KanbanSubtask[]
}

/** Adds subtasks; titles that already exist on the card are skipped (no duplicates). */
export async function addSubtasks(cardId: string, titles: string[]): Promise<KanbanSubtask[]> {
  const existing = await listSubtasks(cardId)
  const known = new Set(existing.map((item) => item.title.trim().toLowerCase()))
  const fresh = titles.map((title) => title.trim()).filter((title) => { const key = title.toLowerCase(); if (!title || known.has(key)) return false; known.add(key); return true })
  if (fresh.length) {
    const start = existing.length ? Math.max(...existing.map((item) => item.position)) + 1 : 0
    const rows = fresh.map((title, index) => ({ card_id: cardId, title, position: start + index }))
    // The unique (card_id, title) index also guards against double clicks racing each other.
    const { error } = await client().from('kanban_subtasks').upsert(rows, { onConflict: 'card_id,title', ignoreDuplicates: true })
    if (error) throw error
  }
  return listSubtasks(cardId)
}

export async function setSubtaskCompleted(id: string, completed: boolean): Promise<void> {
  const { error } = await client().from('kanban_subtasks').update({ completed, updated_at: new Date().toISOString() }).eq('id', id)
  if (error) throw error
}
