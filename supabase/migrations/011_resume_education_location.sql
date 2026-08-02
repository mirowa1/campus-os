-- Education city + US state (mirrors experience location/state pattern)
alter table public.resume_data
  add column if not exists education_location text,
  add column if not exists education_state text;
