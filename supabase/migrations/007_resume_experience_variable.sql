-- Variable-length experience array (min 1 in app; soft max 5 in UI)
-- Existing resume_data.experience values are left unchanged.

alter table public.resume_data
  alter column experience set default '[
    {"title":"","company":"","location":"","endDate":"","bullets":[]}
  ]'::jsonb;
