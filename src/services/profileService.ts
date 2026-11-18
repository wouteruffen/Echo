import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  username: string | null
  avatar_url: string | null
}

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const AVATAR_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

function client() {
  if (!supabase) throw new Error('Supabase is nog niet geconfigureerd.')
  return supabase
}

/** Returns the profile row, or an empty profile if none exists yet. */
export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await client().from('profiles').select('id, username, avatar_url').eq('id', userId).maybeSingle()
  if (error) throw error
  return (data as Profile | null) ?? { id: userId, username: null, avatar_url: null }
}

export async function saveProfile(userId: string, changes: { username: string | null; avatarUrl: string | null }): Promise<Profile> {
  const username = changes.username?.trim() || null
  if (username && username.length > 40) throw new Error('Een gebruikersnaam mag maximaal 40 tekens zijn.')
  const { data, error } = await client().from('profiles')
    .upsert({ id: userId, username, avatar_url: changes.avatarUrl, updated_at: new Date().toISOString() })
    .select('id, username, avatar_url').single()
  if (error) throw error
  return data as Profile
}

/** Uploads an avatar into the user's own folder and returns its public URL. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  if (!AVATAR_TYPES.includes(file.type)) throw new Error('Kies een PNG-, JPG-, WebP- of GIF-afbeelding.')
  if (file.size > MAX_AVATAR_BYTES) throw new Error('De afbeelding mag maximaal 2 MB zijn.')
  const api = client()
  const extension = file.type.split('/')[1]
  const path = `${userId}/avatar-${Date.now()}.${extension}`
  const { error } = await api.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: false })
  if (error) throw error
  return api.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

/** Changes the password of the signed-in user via Supabase Auth. The old password is never read. */
export async function updatePassword(newPassword: string): Promise<void> {
  const { error } = await client().auth.updateUser({ password: newPassword })
  if (error) throw error
}

export async function sendPasswordReset(email: string): Promise<void> {
  const { error } = await client().auth.resetPasswordForEmail(email, { redirectTo: window.location.origin })
  if (error) throw error
}

export async function signOut(): Promise<void> {
  const { error } = await client().auth.signOut()
  if (error) throw error
}
