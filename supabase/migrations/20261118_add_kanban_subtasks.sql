-- Subtasks per kanban card (used by the ECHO "analyze-card" proposals).
-- Only the owner of the card can read or change its subtasks.

create table if not exists public.kanban_subtasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  card_id uuid not null references public.kanban_cards(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 200),
  completed boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Prevents duplicate subtasks when "Subtaken toevoegen" is clicked twice.
create unique index if not exists kanban_subtasks_card_title_key on public.kanban_subtasks (card_id, title);
create index if not exists kanban_subtasks_user_card_idx on public.kanban_subtasks (user_id, card_id, position);

alter table public.kanban_subtasks enable row level security;

drop policy if exists "Users read own subtasks" on public.kanban_subtasks;
drop policy if exists "Users insert own subtasks" on public.kanban_subtasks;
drop policy if exists "Users update own subtasks" on public.kanban_subtasks;
drop policy if exists "Users delete own subtasks" on public.kanban_subtasks;

create policy "Users read own subtasks" on public.kanban_subtasks
  for select to authenticated using ((select auth.uid()) = user_id);

-- Inserts must belong to the user AND target a card the user owns.
create policy "Users insert own subtasks" on public.kanban_subtasks
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.kanban_cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );

create policy "Users update own subtasks" on public.kanban_subtasks
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.kanban_cards c where c.id = card_id and c.user_id = (select auth.uid()))
  );

create policy "Users delete own subtasks" on public.kanban_subtasks
  for delete to authenticated using ((select auth.uid()) = user_id);
