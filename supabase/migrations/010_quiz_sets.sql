-- Quizzes & flashcards (class-scoped sets + attempt history)

create table if not exists public.quiz_sets (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes (id) on delete cascade,
  mode text not null check (mode in ('quiz', 'flashcard')),
  title text not null,
  source_refs jsonb not null default '{}'::jsonb,
  content jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists quiz_sets_class_id_created_at_idx
  on public.quiz_sets (class_id, created_at desc);

alter table public.quiz_sets enable row level security;

create policy "Users can view own quiz_sets"
  on public.quiz_sets for select
  using (
    exists (
      select 1 from public.classes c
      where c.id = quiz_sets.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own quiz_sets"
  on public.quiz_sets for insert
  with check (
    exists (
      select 1 from public.classes c
      where c.id = quiz_sets.class_id and c.user_id = auth.uid()
    )
  );

create policy "Users can delete own quiz_sets"
  on public.quiz_sets for delete
  using (
    exists (
      select 1 from public.classes c
      where c.id = quiz_sets.class_id and c.user_id = auth.uid()
    )
  );

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_set_id uuid not null references public.quiz_sets (id) on delete cascade,
  score numeric(6,2),
  answers jsonb not null default '[]'::jsonb,
  known_cards jsonb not null default '[]'::jsonb,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists quiz_attempts_quiz_set_id_created_at_idx
  on public.quiz_attempts (quiz_set_id, created_at desc);

alter table public.quiz_attempts enable row level security;

create policy "Users can view own quiz_attempts"
  on public.quiz_attempts for select
  using (
    exists (
      select 1
      from public.quiz_sets qs
      join public.classes c on c.id = qs.class_id
      where qs.id = quiz_attempts.quiz_set_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can insert own quiz_attempts"
  on public.quiz_attempts for insert
  with check (
    exists (
      select 1
      from public.quiz_sets qs
      join public.classes c on c.id = qs.class_id
      where qs.id = quiz_attempts.quiz_set_id
        and c.user_id = auth.uid()
    )
  );

create policy "Users can update own quiz_attempts"
  on public.quiz_attempts for update
  using (
    exists (
      select 1
      from public.quiz_sets qs
      join public.classes c on c.id = qs.class_id
      where qs.id = quiz_attempts.quiz_set_id
        and c.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.quiz_sets qs
      join public.classes c on c.id = qs.class_id
      where qs.id = quiz_attempts.quiz_set_id
        and c.user_id = auth.uid()
    )
  );
