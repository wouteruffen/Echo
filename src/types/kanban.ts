export const KANBAN_STATUSES = ['inbox', 'todo', 'in_progress', 'waiting', 'done'] as const

export type KanbanStatus = typeof KANBAN_STATUSES[number]
export type KanbanPriority = 'low' | 'medium' | 'high'
export type ProposalStatus = 'pending' | 'accepted' | 'rejected'

export interface KanbanCard {
  id: string
  title: string
  description: string | null
  status: KanbanStatus
  priority: KanbanPriority
  due_at: string | null
  position: number
  created_at: string
  updated_at: string
}

export interface AgentProposal {
  id: string
  card_id: string | null
  kind: string
  summary: string
  payload: Record<string, unknown>
  status: ProposalStatus
  created_at: string
  resolved_at: string | null
}
