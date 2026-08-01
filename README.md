# CampusOS

**The all-in-one student operating system.** Upload your syllabus, and CampusOS builds your entire semester — every assignment, every exam, every deadline — then tells you exactly what grade you need.

> v1 Focus: Be the app students open every single day.

## Vertical slice (this repo)

Auth → syllabus upload → Claude parse → “Here’s your semester” → calendar + live grade tracking with target-grade / at-risk status.

**Phase 2:** per-class Notes, course material uploads, upload-gated study guide generator (append-to-notes).

Deferred for later: budget, push/email notifications, AI assignment assist, PDF class summaries.

## Tech

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Next.js API routes / Server Actions |
| Database & Auth | Supabase (Postgres + email auth) |
| AI Parsing | Claude API (syllabus → structured JSON) |
| Hosting | Vercel |

## Getting started

```bash
# 1. Install
npm install

# 2. Environment
cp .env.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY

# 3. Supabase
# - Create a project at https://supabase.com
# - Run the SQL in supabase/migrations/001_initial_schema.sql in the SQL Editor
# - Enable Email auth (Authentication → Providers)
# - Create a public Storage bucket named `syllabi` (or run the storage section of the migration)

# 4. Dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

```
campus-os/
├── src/
│   ├── app/
│   │   ├── (auth)/          # Login / signup
│   │   ├── onboarding/      # Syllabus upload + semester review
│   │   ├── dashboard/       # Today's deadlines
│   │   ├── classes/         # Class list + grade tracker
│   │   ├── calendar/        # Unified calendar
│   │   └── api/
│   │       └── parse-syllabus/
│   ├── components/
│   └── lib/                 # Supabase, grades math, Claude, file extract
└── supabase/migrations/
```

## License

All rights reserved © 2026
