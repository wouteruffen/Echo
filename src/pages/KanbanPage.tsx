import KanbanBoard from '../components/KanbanBoard'
import AuthGate from '../components/AuthGate'
import AgentModePicker from '../components/AgentModePicker'

export default function KanbanPage() {
  return (
    <section className="kanban-page">
      <header className="kanban-header">
        <h1 className="kanban-title">Kanban Board</h1>
        <AgentModePicker />
      </header>
      <AuthGate><KanbanBoard /></AuthGate>
    </section>
  )
}
