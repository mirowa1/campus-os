-- HTML resume document (source of truth for preview/PDF/DOCX).
-- Keep generated_content jsonb intact for rollback.
alter table public.resumes
  add column if not exists generated_html text;
