-- Optional colour per kanban list. Existing RLS policy on kanban_lists already covers this column.
alter table public.kanban_lists add column if not exists color text;

alter table public.kanban_lists drop constraint if exists kanban_lists_color_check;
alter table public.kanban_lists add constraint kanban_lists_color_check
  check (color is null or color in ('blue', 'teal', 'green', 'amber', 'orange', 'red', 'pink', 'purple'));
