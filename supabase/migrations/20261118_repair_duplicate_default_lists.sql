-- Repair duplicate default ECHO lists, then prevent them permanently.
-- Safe to run once after 20261118_add_kanban_lists.sql.
with ranked as (
  select id, user_id, system_status, row_number() over (partition by user_id, system_status order by created_at, id) as row_number
  from public.kanban_lists
  where system_status is not null
), kept as (
  select id as kept_id, user_id, system_status from ranked where row_number = 1
), duplicates as (
  select ranked.id, kept.kept_id from ranked join kept using (user_id, system_status) where ranked.row_number > 1
)
update public.kanban_cards cards set list_id = duplicates.kept_id from duplicates where cards.list_id = duplicates.id;

with ranked as (
  select id, row_number() over (partition by user_id, system_status order by created_at, id) as row_number
  from public.kanban_lists
  where system_status is not null
)
delete from public.kanban_lists where id in (select id from ranked where row_number > 1);

create unique index if not exists kanban_lists_one_default_per_user_idx
on public.kanban_lists(user_id, system_status);
