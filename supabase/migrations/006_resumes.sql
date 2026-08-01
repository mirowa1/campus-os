-- Resume Builder Phase 1: draft intake (no templates / AI / PDF yet)
-- Run after 005_grades_profile.sql

create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  template_choice text,
  current_step int not null default 1 check (current_step >= 1 and current_step <= 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists resumes_user_id_updated_at_idx
  on public.resumes (user_id, updated_at desc);

alter table public.resumes enable row level security;

create policy "Users can view own resumes"
  on public.resumes for select
  using (auth.uid() = user_id);

create policy "Users can insert own resumes"
  on public.resumes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own resumes"
  on public.resumes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own resumes"
  on public.resumes for delete
  using (auth.uid() = user_id);

create table if not exists public.resume_data (
  resume_id uuid primary key references public.resumes (id) on delete cascade,
  full_name text,
  state text,
  phone text,
  work_email text,
  linkedin text,
  professional_title text,
  school text,
  major text,
  concentration text,
  minor text,
  achievements jsonb not null default '[]'::jsonb,
  certifications jsonb not null default '[]'::jsonb,
  projects jsonb not null default '[]'::jsonb,
  experience jsonb not null default '[
    {"title":"","company":"","location":"","endDate":"","bullets":[]},
    {"title":"","company":"","location":"","endDate":"","bullets":[]},
    {"title":"","company":"","location":"","endDate":"","bullets":[]}
  ]'::jsonb
);

alter table public.resume_data enable row level security;

create policy "Users can view own resume_data"
  on public.resume_data for select
  using (
    exists (
      select 1 from public.resumes r
      where r.id = resume_data.resume_id
        and r.user_id = auth.uid()
    )
  );

create policy "Users can insert own resume_data"
  on public.resume_data for insert
  with check (
    exists (
      select 1 from public.resumes r
      where r.id = resume_data.resume_id
        and r.user_id = auth.uid()
    )
  );

create policy "Users can update own resume_data"
  on public.resume_data for update
  using (
    exists (
      select 1 from public.resumes r
      where r.id = resume_data.resume_id
        and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.resumes r
      where r.id = resume_data.resume_id
        and r.user_id = auth.uid()
    )
  );

create policy "Users can delete own resume_data"
  on public.resume_data for delete
  using (
    exists (
      select 1 from public.resumes r
      where r.id = resume_data.resume_id
        and r.user_id = auth.uid()
    )
  );
