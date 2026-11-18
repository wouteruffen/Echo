import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import type { Session } from '@supabase/supabase-js'
import { getProfile, saveProfile, sendPasswordReset, signOut, updatePassword, uploadAvatar, type Profile } from '../services/profileService'

type View = 'overview' | 'edit' | 'password'

interface AvatarProps { name: string; url: string | null; size?: 'sm' | 'lg' }

function Avatar({ name, url, size = 'sm' }: AvatarProps) {
  const [broken, setBroken] = useState(false)
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return <span className={`account-avatar account-avatar--${size}`} aria-hidden="true">
    {url && !broken ? <img src={url} alt="" onError={() => setBroken(true)} /> : <span className="account-avatar-initial">{initial}</span>}
  </span>
}

const reason = (error: unknown, fallback: string) => error instanceof Error ? error.message : fallback

export default function AccountMenu({ session, className }: { session: Session; className?: string }) {
  const userId = session.user.id
  const email = session.user.email ?? ''
  const [profile, setProfile] = useState<Profile>({ id: userId, username: null, avatar_url: null })
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<View>('overview')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    let active = true
    getProfile(userId).then((next) => { if (active) setProfile(next) }).catch(() => { /* table not migrated yet: fall back to email initial */ })
    return () => { active = false }
  }, [userId])

  const displayName = profile.username || email.split('@')[0] || 'Account'

  const close = useCallback(() => { setOpen(false); setView('overview'); triggerRef.current?.focus() }, [])

  useLayoutEffect(() => {
    if (!open) return
    function place() {
      const trigger = triggerRef.current?.getBoundingClientRect()
      const box = popoverRef.current?.getBoundingClientRect()
      if (!trigger || !box) return
      const EDGE = 12
      // Open to the right of the sidebar avatar; fall back to below it on narrow screens.
      let left = trigger.right + 12
      let top = trigger.top
      if (left + box.width > window.innerWidth - EDGE) { left = trigger.right - box.width; top = trigger.bottom + 8 }
      left = Math.min(Math.max(EDGE, left), window.innerWidth - box.width - EDGE)
      top = Math.min(Math.max(EDGE, top), window.innerHeight - box.height - EDGE)
      setPos({ top, left })
    }
    place()
    window.addEventListener('resize', place)
    return () => window.removeEventListener('resize', place)
  }, [open, view])

  useEffect(() => {
    if (!open) return
    popoverRef.current?.querySelector<HTMLElement>('input, button:not(.account-close)')?.focus()
  }, [open, view])

  useEffect(() => {
    if (!open) return
    function onPointer(event: PointerEvent) {
      const target = event.target as Node
      if (popoverRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      setOpen(false); setView('overview')
    }
    function onKey(event: KeyboardEvent) { if (event.key === 'Escape') { event.preventDefault(); close() } }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey) }
  }, [open, close])

  return <>
    <button ref={triggerRef} type="button" className={`account-trigger ${className ?? ''}`} aria-haspopup="dialog" aria-expanded={open}
      aria-label={`Account van ${displayName}`} title={displayName}
      onClick={() => { if (open) close(); else { setPos(null); setView('overview'); setOpen(true) } }}>
      <Avatar name={displayName} url={profile.avatar_url} />
      <span className="account-status" aria-hidden="true" />
    </button>
    {open && createPortal(
      <div ref={popoverRef} className="account-popover" role="dialog" aria-label="Account"
        style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}>
        {view === 'overview' && <Overview profile={profile} displayName={displayName} email={email} onEdit={() => setView('edit')} onPassword={() => setView('password')} />}
        {view === 'edit' && <EditProfile userId={userId} profile={profile} displayName={displayName} onBack={() => setView('overview')} onSaved={(next) => { setProfile(next); setView('overview') }} />}
        {view === 'password' && <ChangePassword email={email} onBack={() => setView('overview')} />}
      </div>,
      document.body,
    )}
  </>
}

function Overview({ profile, displayName, email, onEdit, onPassword }: { profile: Profile; displayName: string; email: string; onEdit: () => void; onPassword: () => void }) {
  const [error, setError] = useState<string | null>(null)
  return <>
    <div className="account-identity">
      <Avatar name={displayName} url={profile.avatar_url} size="lg" />
      <div className="account-identity-text">
        <strong>{displayName}</strong>
        <span>{email}</span>
      </div>
    </div>
    <div className="account-actions">
      <button type="button" onClick={onEdit}><span aria-hidden="true">✎</span>Profiel bewerken</button>
      <button type="button" onClick={onPassword}><span aria-hidden="true">🔒</span>Wachtwoord wijzigen</button>
      <button type="button" className="account-danger" onClick={() => { signOut().catch((e: unknown) => setError(reason(e, 'Uitloggen is mislukt.'))) }}><span aria-hidden="true">⎋</span>Uitloggen</button>
    </div>
    {error && <p className="account-message account-message--error" role="alert">{error}</p>}
  </>
}

function PanelHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return <header className="account-panel-header">
    <button type="button" className="account-back" aria-label="Terug" onClick={onBack}>‹</button>
    <h2>{title}</h2>
  </header>
}

function EditProfile({ userId, profile, displayName, onBack, onSaved }: { userId: string; profile: Profile; displayName: string; onBack: () => void; onSaved: (profile: Profile) => void }) {
  const [username, setUsername] = useState(profile.username ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [removeAvatar, setRemoveAvatar] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Free the local preview URL when it changes or the form closes.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function choose(next: File | null) {
    setFile(next)
    setPreview(next ? URL.createObjectURL(next) : null)
  }

  function pick(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.files?.[0] ?? null
    setError(null)
    if (next && next.size > 2 * 1024 * 1024) { setError('De afbeelding mag maximaal 2 MB zijn.'); return }
    choose(next); setRemoveAvatar(false)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true); setError(null)
    try {
      const avatarUrl = file ? await uploadAvatar(userId, file) : removeAvatar ? null : profile.avatar_url
      onSaved(await saveProfile(userId, { username, avatarUrl }))
    } catch (e) { setError(`Opslaan mislukt: ${reason(e, 'onbekende fout')}`) }
    finally { setSaving(false) }
  }

  const shownUrl = preview ?? (removeAvatar ? null : profile.avatar_url)
  return <form onSubmit={submit}>
    <PanelHeader title="Profiel bewerken" onBack={onBack} />
    <div className="account-avatar-edit">
      <Avatar name={username || displayName} url={shownUrl} size="lg" />
      <div className="account-avatar-buttons">
        <button type="button" className="account-secondary" onClick={() => fileRef.current?.click()}>Foto uploaden</button>
        {shownUrl && <button type="button" className="account-link" onClick={() => { choose(null); setRemoveAvatar(true); if (fileRef.current) fileRef.current.value = '' }}>Foto verwijderen</button>}
        <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp,image/gif" className="visually-hidden" tabIndex={-1} aria-label="Profielfoto kiezen" onChange={pick} />
      </div>
    </div>
    <label className="account-field">Gebruikersnaam
      <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={40} placeholder={displayName} autoComplete="nickname" />
    </label>
    {error && <p className="account-message account-message--error" role="alert">{error}</p>}
    <div className="account-form-actions">
      <button type="button" className="account-link" onClick={onBack}>Annuleren</button>
      <button type="submit" className="account-primary" disabled={saving}>{saving ? 'Opslaan…' : 'Opslaan'}</button>
    </div>
  </form>
}

function PasswordField({ id, label, value, onChange, visible, onToggle }: { id: string; label: string; value: string; onChange: (value: string) => void; visible: boolean; onToggle: () => void }) {
  return <div className="account-field">
    <label htmlFor={id}>{label}</label>
    <div className="account-password">
      <input id={id} type={visible ? 'text' : 'password'} value={value} onChange={(event) => onChange(event.target.value)} autoComplete="new-password" minLength={8} required />
      <button type="button" className="account-eye" aria-label={visible ? 'Wachtwoord verbergen' : 'Wachtwoord tonen'} aria-pressed={visible} onClick={onToggle}>{visible ? '🙈' : '👁'}</button>
    </div>
  </div>
}

function ChangePassword({ email, onBack }: { email: string; onBack: () => void }) {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState({ password: false, confirm: false })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)
  const mismatch = confirm.length > 0 && password !== confirm

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password.length < 8) { setMessage({ kind: 'error', text: 'Gebruik minimaal 8 tekens.' }); return }
    if (password !== confirm) { setMessage({ kind: 'error', text: 'De wachtwoorden komen niet overeen.' }); return }
    setBusy(true); setMessage(null)
    try {
      await updatePassword(password)
      setPassword(''); setConfirm('')
      setMessage({ kind: 'ok', text: 'Je wachtwoord is gewijzigd.' })
    } catch (e) {
      setMessage({ kind: 'error', text: `Wijzigen mislukt: ${reason(e, 'onbekende fout')}. Gebruik eventueel een reset-e-mail.` })
    } finally { setBusy(false) }
  }

  async function reset() {
    setBusy(true); setMessage(null)
    try { await sendPasswordReset(email); setMessage({ kind: 'ok', text: `Reset-e-mail verstuurd naar ${email}.` }) }
    catch (e) { setMessage({ kind: 'error', text: `Versturen mislukt: ${reason(e, 'onbekende fout')}` }) }
    finally { setBusy(false) }
  }

  return <form onSubmit={submit}>
    <PanelHeader title="Wachtwoord wijzigen" onBack={onBack} />
    <PasswordField id="account-new-password" label="Nieuw wachtwoord" value={password} onChange={setPassword} visible={show.password} onToggle={() => setShow((s) => ({ ...s, password: !s.password }))} />
    <PasswordField id="account-confirm-password" label="Bevestig nieuw wachtwoord" value={confirm} onChange={setConfirm} visible={show.confirm} onToggle={() => setShow((s) => ({ ...s, confirm: !s.confirm }))} />
    {mismatch && <p className="account-message account-message--error">De wachtwoorden komen niet overeen.</p>}
    {message && <p className={`account-message account-message--${message.kind}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}
    <div className="account-form-actions">
      <button type="button" className="account-link" onClick={() => { void reset() }} disabled={busy}>Reset-e-mail sturen</button>
      <button type="submit" className="account-primary" disabled={busy || mismatch}>{busy ? 'Bezig…' : 'Wijzigen'}</button>
    </div>
  </form>
}
