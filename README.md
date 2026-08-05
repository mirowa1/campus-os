# Coursework by CoreMax

**Upload your syllabus. Know exactly where you stand.**

Product UI brand: **Coursework by CoreMax** (CoreMax primary mark + Coursework product).  
Production: [https://www.coremaxsystems.com](https://www.coremaxsystems.com)  
Repo: [mirowa1/campus-os](https://github.com/mirowa1/campus-os)

> v1 Focus: Be the app students open every single day.

## Vertical slice (this repo)

Auth → syllabus upload → Claude parse → “Here’s your semester” → calendar + live grade tracking with target-grade / at-risk status.

**Also in repo:** Notes, course materials, study guides, quizzes/flashcards, resume builder, optional SMS (Twilio Verify).

## Tech

| Layer | Tech |
|---|---|
| Frontend | Next.js 14 (App Router) + Tailwind CSS |
| Backend | Next.js API routes / Server Actions |
| Database & Auth | Supabase (Postgres + email auth) |
| AI | Anthropic Claude |
| SMS | Twilio Verify (API Key auth) |
| Hosting | Vercel (`coremax1/campus-os`) |

## Getting started

```bash
npm install
cp .env.example .env.local
# Fill required keys — see TRANSFER.md
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**Moving to a new laptop?** Follow **[TRANSFER.md](TRANSFER.md)** (paste-ready Cursor agent prompt + full checklist).

## Demo screenshots

Marketing captures live in [`demo-assets/`](demo-assets/). Recapture script: `scripts/capture-demo-screenshots.mjs` (Playwright + system Chrome).

## Project structure

```
campus-os/
├── src/
│   ├── app/                 # Auth, onboarding, dashboard, classes, calendar, resume, API
│   ├── components/
│   └── lib/                 # Supabase, Claude, grades, SMS, resume PDF
├── supabase/migrations/
├── fixtures/                # Sample syllabi / study materials
├── demo-assets/             # Launch marketing screenshots
├── scripts/                 # E2E / capture helpers
└── TRANSFER.md              # New-laptop setup prompt
```

## License

All rights reserved © 2026
