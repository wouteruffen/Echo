-- ECHO board lists: run once in Supabase SQL Editor.
create table if not exists public.kanban_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  system_status public.kanban_status,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.kanban_cards add column if not exists list_id uuid references public.kanban_lists(id) on delete set null;
create index if not exists kanban_lists_user_position_idx on public.kanban_lists(user_id, position);
create index if not exists kanban_cards_list_id_idx on public.kanban_cards(list_id);

alter table public.kanban_lists enable row level security;
create policy "users manage own kanban lists" on public.kanban_lists for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
