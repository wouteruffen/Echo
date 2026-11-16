-- ECHO kanban foundation. Run this in Supabase SQL Editor or with the Supabase CLI.
-- Every row belongs to the authenticated user. The browser never receives a secret key.

create type public.kanban_status as enum ('inbox', 'todo', 'in_progress', 'waiting', 'done');
create type public.kanban_priority as enum ('low', 'medium', 'high');
create type public.proposal_status as enum ('pending', 'accepted', 'rejected');

create table public.kanban_cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 240),
  description text,
  status public.kanban_status not null default 'inbox',
  priority public.kanban_priority not null default 'medium',
  due_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.agent_proposals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid references public.kanban_cards(id) on delete cascade,
  kind text not null check (char_length(trim(kind)) between 1 and 80),
  summary text not null check (char_length(trim(summary)) between 1 and 4000),
  payload jsonb not null default '{}'::jsonb,
  status public.proposal_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid references public.kanban_cards(id) on delete set null,
  event_type text not null check (char_length(trim(event_type)) between 1 and 80),
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index kanban_cards_user_status_position_idx on public.kanban_cards (user_id, status, position, created_at);
create index agent_proposals_user_status_idx on public.agent_proposals (user_id, status, created_at desc);
create index activity_log_user_created_idx on public.activity_log (user_id, created_at desc);

alter table public.kanban_cards enable row level security;
alter table public.agent_proposals enable row level security;
alter table public.activity_log enable row level security;

create policy "Users manage only their own cards"
  on public.kanban_cards for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users manage only their own proposals"
  on public.agent_proposals for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users read only their own activity"
  on public.activity_log for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users create only their own activity"
  on public.activity_log for insert to authenticated
  with check ((select auth.uid()) = user_id);
