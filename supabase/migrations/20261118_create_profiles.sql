-- User profiles (username + avatar), one row per auth user.
-- Passwords are never stored here: they stay inside Supabase Auth.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text check (username is null or char_length(trim(username)) between 1 and 40),
  avatar_url text check (avatar_url is null or char_length(avatar_url) <= 1000),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "users read own profile" on public.profiles;
drop policy if exists "users insert own profile" on public.profiles;
drop policy if exists "users update own profile" on public.profiles;

create policy "users read own profile" on public.profiles
  for select to authenticated using (auth.uid() = id);
create policy "users insert own profile" on public.profiles
  for insert to authenticated with check (auth.uid() = id);
create policy "users update own profile" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Avatar images: Storage bucket "avatars".
-- Files live under "<user id>/..."; only the owner can upload, replace or delete them.
-- The bucket is public-read so the avatar loads on any device via its (unguessable) URL.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp', 'image/gif'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload own avatar" on storage.objects;
drop policy if exists "users update own avatar" on storage.objects;
drop policy if exists "users delete own avatar" on storage.objects;

create policy "users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users update own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "users delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
