import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { isSupabaseConfigured, supabase } from '../lib/supabase'

type AuthMode = 'signin' | 'signup'

export default function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)
  const [mode, setMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!supabase) return
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setLoading(false) })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => { setSession(nextSession); setLoading(false) })
    return () => listener.subscription.unsubscribe()
  }, [])

  if (!isSupabaseConfigured) return <>{children}</>
  if (loading) return <section className="kanban-state">ECHO controleert je sessie…</section>

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase) return
    setSubmitting(true); setMessage('')
    const result = mode === 'signin' ? await supabase.auth.signInWithPassword({ email, password }) : await supabase.auth.signUp({ email, password })
    setSubmitting(false)
    if (result.error) { setMessage(result.error.message); return }
    if (mode === 'signup' && !result.data.session) setMessage('Account aangemaakt. Bevestig eerst de e-mail die Supabase je stuurt.')
  }

  async function signOut() { if (supabase) await supabase.auth.signOut() }

  if (session) return <><div className="echo-auth-bar"><span>Ingelogd als {session.user.email}</span><button className="echo-auth-link" type="button" onClick={signOut}>Uitloggen</button></div>{children}</>

  return <section className="echo-auth-card">
    <p className="kanban-eyebrow">Privé workspace</p>
    <h2>{mode === 'signin' ? 'Welkom terug.' : 'Maak je ECHO-account.'}</h2>
    <p>Je kaarten blijven alleen zichtbaar voor het account waarmee je inlogt.</p>
    <form className="echo-auth-form" onSubmit={submit}>
      <label>E-mailadres<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
      <label>Wachtwoord<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} minLength={6} required /></label>
      {message && <p className="echo-auth-message">{message}</p>}
      <button className="echo-auth-submit" type="submit" disabled={submitting}>{submitting ? 'Even wachten…' : mode === 'signin' ? 'Inloggen' : 'Account maken'}</button>
    </form>
    <button className="echo-auth-link" type="button" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setMessage('') }}>{mode === 'signin' ? 'Nog geen account? Maak er één' : 'Al een account? Log in'}</button>
  </section>
}
