import { useCallback, useEffect, useState } from 'react'
import type { KanbanCard, KanbanPriority } from '../types/kanban'
import { addSubtasks, analyzeCard, listSubtasks, resolveProposal, setSubtaskCompleted, updateCardFields, type CardAnalysis, type KanbanSubtask } from '../services/echoAgentService'
import ConfirmDialog from './ConfirmDialog'

const priorityLabels: Record<KanbanPriority, string> = { high: 'Hoog', medium: 'Normaal', low: 'Laag' }
const formatDate = (value: string) => new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${value}T12:00:00`))
const message = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

type Applied = { priority: boolean; deadline: boolean; subtasks: boolean }
type Busy = null | 'analyze' | 'priority' | 'deadline' | 'subtasks' | 'all' | 'dismiss'

interface Props {
  card: KanbanCard
  /** Called after the user applied a change, with the card as stored in Supabase. */
  onCardUpdated: (card: KanbanCard) => void
}

/** Subtasks + "Analyseer met ECHO". Nothing is changed without an explicit click. */
export default function CardEchoPanel({ card, onCardUpdated }: Props) {
  const [subtasks, setSubtasks] = useState<KanbanSubtask[]>([])
  const [subtaskError, setSubtaskError] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<CardAnalysis | null>(null)
  const [applied, setApplied] = useState<Applied>({ priority: false, deadline: false, subtasks: false })
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmAll, setConfirmAll] = useState(false)
  const cancelConfirm = useCallback(() => setConfirmAll(false), [])

  useEffect(() => {
    let active = true
    listSubtasks(card.id)
      .then((rows) => { if (active) setSubtasks(rows) })
      .catch(() => { if (active) setSubtaskError('Subtaken konden niet worden geladen. Is de subtaken-migratie al uitgevoerd?') })
    return () => { active = false }
  }, [card.id])

  async function analyze() {
    setBusy('analyze'); setError(null); setAnalysis(null)
    setApplied({ priority: false, deadline: false, subtasks: false })
    try { setAnalysis(await analyzeCard(card.id)) }
    catch (e) { setError(message(e, 'De analyse is mislukt.')) }
    finally { setBusy(null) }
  }

  const proposal = analysis?.proposal
  const has = {
    priority: Boolean(proposal?.suggestedPriority && proposal.suggestedPriority !== card.priority),
    deadline: Boolean(proposal?.suggestedDeadline),
    subtasks: Boolean(proposal?.suggestedSubtasks.length),
  }
  const remaining = (Object.keys(has) as (keyof Applied)[]).filter((key) => has[key] && !applied[key])

  async function finishIfDone(next: Applied) {
    if (!analysis) return
    const open = (Object.keys(has) as (keyof Applied)[]).filter((key) => has[key] && !next[key])
    if (!open.length) await resolveProposal(analysis.proposalId, 'accepted').catch(() => undefined)
  }

  async function applyPriority(): Promise<KanbanCard | null> {
    if (!proposal?.suggestedPriority) return null
    return updateCardFields(card.id, { priority: proposal.suggestedPriority })
  }
  async function applyDeadline(): Promise<KanbanCard | null> {
    if (!proposal?.suggestedDeadline) return null
    return updateCardFields(card.id, { due_at: new Date(`${proposal.suggestedDeadline}T12:00:00`).toISOString() })
  }
  async function applySubtasks() {
    if (!proposal) return
    setSubtasks(await addSubtasks(card.id, proposal.suggestedSubtasks.map((item) => item.title)))
  }

  async function run(kind: keyof Applied) {
    setBusy(kind); setError(null)
    try {
      if (kind === 'priority') { const updated = await applyPriority(); if (updated) onCardUpdated(updated) }
      if (kind === 'deadline') { const updated = await applyDeadline(); if (updated) onCardUpdated(updated) }
      if (kind === 'subtasks') await applySubtasks()
      const next = { ...applied, [kind]: true }
      setApplied(next)
      await finishIfDone(next)
    } catch (e) { setError(`Toepassen mislukt: ${message(e, 'onbekende fout')}`) }
    finally { setBusy(null) }
  }

  async function runAll() {
    setConfirmAll(false); setBusy('all'); setError(null)
    const next = { ...applied }
    try {
      if (has.priority && !next.priority) { const updated = await applyPriority(); if (updated) onCardUpdated(updated); next.priority = true }
      if (has.deadline && !next.deadline) { const updated = await applyDeadline(); if (updated) onCardUpdated(updated); next.deadline = true }
      if (has.subtasks && !next.subtasks) { await applySubtasks(); next.subtasks = true }
      await finishIfDone(next)
    } catch (e) { setError(`Niet alles kon worden toegepast: ${message(e, 'onbekende fout')}`) }
    finally { setApplied(next); setBusy(null) }
  }

  async function dismiss() {
    if (!analysis) return
    setBusy('dismiss')
    await resolveProposal(analysis.proposalId, 'rejected').catch(() => undefined)
    setAnalysis(null); setError(null); setBusy(null)
  }

  async function toggleSubtask(item: KanbanSubtask) {
    setSubtasks((all) => all.map((row) => row.id === item.id ? { ...row, completed: !row.completed } : row))
    try { await setSubtaskCompleted(item.id, !item.completed) }
    catch { setSubtasks((all) => all.map((row) => row.id === item.id ? item : row)); setSubtaskError('De subtaak kon niet worden bijgewerkt.') }
  }

  const done = subtasks.filter((item) => item.completed).length

  return <>
    {(subtasks.length > 0 || subtaskError) && <section className="card-section">
      <h3><span aria-hidden="true">☑</span> Subtaken <small className="card-subtask-count">{done}/{subtasks.length}</small></h3>
      {subtasks.length > 0 && <div className="card-subtask-progress" aria-hidden="true"><span style={{ width: `${(done / subtasks.length) * 100}%` }} /></div>}
      <ul className="card-subtasks">
        {subtasks.map((item) => <li key={item.id}>
          <label className={item.completed ? 'is-done' : undefined}>
            <input type="checkbox" checked={item.completed} onChange={() => { void toggleSubtask(item) }} />
            <span>{item.title}</span>
          </label>
        </li>)}
      </ul>
      {subtaskError && <p className="kanban-state kanban-state--error" role="alert">{subtaskError}</p>}
    </section>}

    <section className="card-section echo-section" aria-live="polite">
      <div className="echo-section-head">
        <h3><span aria-hidden="true">◈</span> ECHO</h3>
        <button type="button" className="echo-analyze" onClick={() => { void analyze() }} disabled={busy !== null}>
          {busy === 'analyze' ? <><span className="echo-spinner" aria-hidden="true" />ECHO denkt na…</> : analysis ? 'Opnieuw analyseren' : 'Analyseer met ECHO'}
        </button>
      </div>

      {busy === 'analyze' && <p className="echo-hint">ECHO leest alleen deze kaart en stelt verbeteringen voor. Er wordt niets automatisch aangepast.</p>}

      {error && <div className="echo-error" role="alert">
        <span>{error}</span>
        {!analysis && <button type="button" className="account-link" onClick={() => { void analyze() }} disabled={busy !== null}>Opnieuw proberen</button>}
      </div>}

      {proposal && <article className="echo-proposal" aria-label="ECHO voorstel">
        <header><span className="echo-badge">ECHO voorstel</span><span className="echo-proposal-note">Alleen een voorstel — jij beslist</span></header>
        <p className="echo-summary">{proposal.summary}</p>

        <dl className="echo-facts">
          <div><dt>Prioriteit</dt><dd>{proposal.suggestedPriority
            ? <span className={`kanban-priority kanban-priority--${proposal.suggestedPriority}`}>{priorityLabels[proposal.suggestedPriority]}{proposal.suggestedPriority === card.priority && ' (ongewijzigd)'}</span>
            : <span className="echo-none">Geen voorstel</span>}</dd></div>
          <div><dt>Deadline</dt><dd>{proposal.suggestedDeadline ? formatDate(proposal.suggestedDeadline) : <span className="echo-none">Geen voorstel</span>}</dd></div>
        </dl>

        {proposal.suggestedSubtasks.length > 0 && <div className="echo-subtasks">
          <h4>Voorgestelde subtaken</h4>
          <ol>{proposal.suggestedSubtasks.map((item) => <li key={item.title}>{item.title}</li>)}</ol>
        </div>}

        <p className="echo-reasoning"><strong>Waarom:</strong> {proposal.reasoning}</p>

        <footer className="echo-actions">
          {has.priority && <button type="button" onClick={() => { void run('priority') }} disabled={busy !== null || applied.priority}>{applied.priority ? '✓ Prioriteit toegepast' : 'Prioriteit toepassen'}</button>}
          {has.deadline && <button type="button" onClick={() => { void run('deadline') }} disabled={busy !== null || applied.deadline}>{applied.deadline ? '✓ Deadline toegepast' : 'Deadline toepassen'}</button>}
          {has.subtasks && <button type="button" onClick={() => { void run('subtasks') }} disabled={busy !== null || applied.subtasks}>{applied.subtasks ? '✓ Subtaken toegevoegd' : 'Subtaken toevoegen'}</button>}
          {remaining.length > 1 && <button type="button" className="echo-apply-all" onClick={() => setConfirmAll(true)} disabled={busy !== null}>Alles toepassen</button>}
          <button type="button" className="echo-dismiss" onClick={() => { void dismiss() }} disabled={busy !== null}>{remaining.length ? 'Negeren' : 'Sluiten'}</button>
        </footer>
      </article>}
    </section>

    {confirmAll && proposal && <ConfirmDialog title="Alle voorstellen toepassen?" tone="warning" confirmLabel="Alles toepassen" onCancel={cancelConfirm} onConfirm={() => { void runAll() }}
      message={[
        has.priority && !applied.priority && proposal.suggestedPriority ? `prioriteit wordt "${priorityLabels[proposal.suggestedPriority]}"` : '',
        has.deadline && !applied.deadline && proposal.suggestedDeadline ? `deadline wordt ${formatDate(proposal.suggestedDeadline)}` : '',
        has.subtasks && !applied.subtasks ? `${proposal.suggestedSubtasks.length} subtaken worden toegevoegd` : '',
      ].filter(Boolean).join(', ').replace(/^./, (c) => c.toUpperCase()) + '. Dit wordt direct opgeslagen.'} />}
  </>
}
