-- Extracurriculars intake + Phase 2 generated resume content
-- Run after 007_resume_experience_variable.sql

alter table public.resume_data
  add column if not exists extracurriculars jsonb not null default '[]'::jsonb;

alter table public.resumes
  add column if not exists generated_content jsonb;
