-- Multiple titled notes per class
-- Run after 002_notes_materials_study_guides.sql

-- Drop unique constraint on class_id (name may vary)
do $$
declare
  cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.notes'::regclass
    and contype = 'u';
  if cname is not null then
    execute format('alter table public.notes drop constraint %I', cname);
  end if;
end $$;

-- Add title column
alter table public.notes
  add column if not exists title text;

update public.notes
set title = 'Untitled note'
where title is null or title = '';

alter table public.notes
  alter column title set not null;

create index if not exists notes_class_id_updated_at_idx
  on public.notes (class_id, updated_at desc);
