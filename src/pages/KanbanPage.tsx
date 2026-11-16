import KanbanBoard from '../components/KanbanBoard'
import AuthGate from '../components/AuthGate'

export default function KanbanPage() {
  return (
    <section className="kanban-page">
      <header className="kanban-header">
        <div>
          <p className="kanban-eyebrow">ECHO / Task system</p>
          <h1 className="kanban-title">Jouw werk, helder in beeld.</h1>
          <p className="kanban-subtitle">Bewaar taken op één plek. ECHO-agents mogen straks plannen, prioriteren en voorstellen doen — nooit zelfstandig iets externs uitvoeren.</p>
        </div>
        <div className="kanban-safety"><span className="kanban-safety-dot" /> Alleen voorstellen</div>
      </header>
      <AuthGate><KanbanBoard /></AuthGate>
    </section>
  )
}
