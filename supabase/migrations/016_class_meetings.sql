-- Class recurring meeting times extracted from syllabi
create table if not exists public.class_meetings (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  location text,
  term_start_date date,
  term_end_date date,
  created_at timestamptz not null default now()
);

create index if not exists class_meetings_class_id_idx on public.class_meetings (class_id);
create index if not exists class_meetings_user_id_idx on public.class_meetings (user_id);

alter table public.class_meetings enable row level security;

create policy "Users can view own class_meetings"
  on public.class_meetings for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_meetings.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own class_meetings"
  on public.class_meetings for insert
  with check (
    exists (
      select 1 from public.classes c
      where c.id = class_meetings.class_id and c.user_id = auth.uid()
    )
    and user_id = auth.uid()
  );

create policy "Users can update own class_meetings"
  on public.class_meetings for update
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_meetings.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete own class_meetings"
  on public.class_meetings for delete
  using (
    exists (
      select 1 from public.classes c
      where c.id = class_meetings.class_id and c.user_id = auth.uid()
    )
  );
