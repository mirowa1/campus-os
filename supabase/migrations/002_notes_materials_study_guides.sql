-- Phase 2: notes, course materials, study guides
-- Run in Supabase SQL Editor after 001_initial_schema.sql

-- Notes (one document per class)
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null unique references public.classes (id) on delete cascade,
  body text not null default '',
  updated_at timestamptz not null default now()
);

create index if not exists notes_class_id_idx on public.notes (class_id);

alter table public.notes enable row level security;

create policy "Users can view own notes"
  on public.notes for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = notes.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own notes"
  on public.notes for insert
  with check (
    exists (
      select 1 from public.classes c
      where c.id = notes.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can update own notes"
  on public.notes for update
  using (
    exists (
      select 1 from public.classes c
      where c.id = notes.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete own notes"
  on public.notes for delete
  using (
    exists (
      select 1 from public.classes c
      where c.id = notes.class_id and c.user_id = auth.uid()
    )
  );

-- Course materials (multiple files per class)
create table if not exists public.course_materials (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  file_name text not null,
  storage_path text not null,
  mime_type text not null,
  created_at timestamptz not null default now()
);

create index if not exists course_materials_class_id_idx
  on public.course_materials (class_id);

alter table public.course_materials enable row level security;

create policy "Users can view own course materials"
  on public.course_materials for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = course_materials.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own course materials"
  on public.course_materials for insert
  with check (
    exists (
      select 1 from public.classes c
      where c.id = course_materials.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete own course materials"
  on public.course_materials for delete
  using (
    exists (
      select 1 from public.classes c
      where c.id = course_materials.class_id and c.user_id = auth.uid()
    )
  );

-- Study guides (history; latest shown)
create table if not exists public.study_guides (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists study_guides_class_id_idx
  on public.study_guides (class_id);

alter table public.study_guides enable row level security;

create policy "Users can view own study guides"
  on public.study_guides for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = study_guides.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own study guides"
  on public.study_guides for insert
  with check (
    exists (
      select 1 from public.classes c
      where c.id = study_guides.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete own study guides"
  on public.study_guides for delete
  using (
    exists (
      select 1 from public.classes c
      where c.id = study_guides.class_id and c.user_id = auth.uid()
    )
  );

-- Storage bucket for course materials
insert into storage.buckets (id, name, public)
values ('materials', 'materials', false)
on conflict (id) do nothing;

create policy "Users can upload own materials"
  on storage.objects for insert
  with check (
    bucket_id = 'materials'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can read own materials"
  on storage.objects for select
  using (
    bucket_id = 'materials'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Users can delete own materials"
  on storage.objects for delete
  using (
    bucket_id = 'materials'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
