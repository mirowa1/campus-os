# Laptop transfer guide — Coursework by CoreMax (`campus-os`)

Production: **https://www.coremaxsystems.com**  
GitHub: **https://github.com/mirowa1/campus-os**  
Vercel team/project: **coremax1 / campus-os**

---

## Agent prompt (paste into Cursor on the new laptop)

```
You are setting up the Coursework by CoreMax repo (campus-os) on a new machine.

1. Read TRANSFER.md in the repo root and follow it end-to-end.
2. Do NOT invent, guess, or hard-code secrets. For every missing env var, ask me to paste the value (or confirm I copied .env.local from my password manager / old laptop).
3. Clone https://github.com/mirowa1/campus-os.git if not already present; npm install; create .env.local from .env.example.
4. Verify .env.local uses TWILIO_* (correct spelling) — never TWILLIO_*.
5. Run npm run dev and smoke-check login + landing. Flag anything that fails.
6. Do not commit .env.local. Do not push unless I ask.
```

---

## 1. Clone & toolchain

```bash
git clone https://github.com/mirowa1/campus-os.git
cd campus-os
node -v          # prefer Node 20 LTS or 22; 23 works with npm engine warnings
npm install
```

Optional (demo screenshot recapture only):

```bash
# Playwright uses system Google Chrome on macOS (bundled Chromium may fail on older macOS)
npm install --no-save playwright@1.62.1
# Requires Google Chrome installed at /Applications/Google Chrome.app
```

---

## 2. Environment (`.env.local`)

```bash
cp .env.example .env.local
```

Fill values from your password manager or the old laptop’s `.env.local` (**never commit this file**).

### Required for core app

| Variable | Where to get it |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com |

### Optional but used in production features

| Variable | Purpose |
| --- | --- |
| `SUPABASE_SERVICE_ROLE_KEY` | Server admin / some scripts (keep secret) |
| `TWILIO_ACCOUNT_SID` | SMS Verify (Profile phone) |
| `TWILIO_API_KEY` | Twilio API Key SID (`SK…`) |
| `TWILIO_CLIENT_SECRET` | Twilio API Key secret |
| `TWILIO_VERIFY_SERVICE_SID` | Verify Service (`VA…`) |
| `TWILIO_PHONE_NUMBER` | Optional; not required for Verify send/check |
| `SUPABASE_ACCESS_TOKEN` | Management API (`sbp_…`) for e2e email-confirm scripts |
| `SUPABASE_PROJECT_REF` | Defaults to `zbfnysljwyebktmxazii` if unset |
| `RESUME_PDF_CHROMIUM` | Set `1` to force Chromium PDF path locally if needed |

**Spelling trap:** production code expects `TWILIO_*`. An older local file may have `TWILLIO_*` (extra L) — those keys are **ignored**. Rename when copying.

Template: [`.env.example`](.env.example).

---

## 3. Cloud accounts (reuse — do not recreate)

| Service | Notes |
| --- | --- |
| **GitHub** | `mirowa1/campus-os` |
| **Vercel** | Team `coremax1`, project `campus-os`; domain `www.coremaxsystems.com` |
| **Supabase** | Same project as production (URL in `.env.local`) |
| **Anthropic** | Same API key or a new key with billing |
| **Twilio** | Same Account + Verify service for SMS |

### Supabase Auth (critical after laptop move / if auth breaks)

Dashboard → Authentication → URL configuration:

- **Site URL:** `https://www.coremaxsystems.com` (prod) — for local-only testing you may temporarily use `http://localhost:3000`
- **Redirect allow list** must include:
  - `https://www.coremaxsystems.com/**`
  - `http://localhost:3000/**`

Email confirmation: if enabled, signup needs inbox or Management API confirm (`SUPABASE_ACCESS_TOKEN` + scripts like `scripts/e2e-html-resume-flow.ts`).

### Vercel env

Production/preview env vars live in the Vercel dashboard (not in git). After cloning, local `.env.local` is separate. Pushing to `main` deploys via the existing Vercel Git integration.

---

## 4. Database & storage (greenfield only)

If this is a **brand-new** Supabase project (unusual — you normally reuse prod):

1. Run SQL migrations in order under [`supabase/migrations/`](supabase/migrations/) (`001` … `015`) in the Supabase SQL Editor.
2. Ensure Storage buckets exist for syllabi / course materials (see migration notes / dashboard).
3. Enable Email auth provider.

If you are only developing against the **existing** production/staging Supabase project: **do not re-run destructive migrations**; just use the existing URL/keys.

---

## 5. Local run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Logged-out landing should show **Coursework by CoreMax** + giant **COREMAX** wordmark.  
Logged-in AppNav: **CoreMax** + **COURSEWORK** subtitle.

---

## 6. Demo assets & recapture

Marketing screenshots live in [`demo-assets/`](demo-assets/) (journey `01`–`11` + `branding-verify/`). Captions/flags: [`demo-assets/README.md`](demo-assets/README.md).

Recapture on production (optional):

```bash
node scripts/capture-demo-screenshots.mjs
```

Needs Playwright + **Chrome channel**, fixtures under `fixtures/`, and usually a confirmed test account. Dense September calendar fixture: `fixtures/sample-syllabus-sep2026-dense.txt`.

E2E account used in prior captures (password in your password manager, not in git):

- `test+e2e-launch@coremaxsystems.com`

---

## 7. What never moves via git

Copy these **manually** (USB / 1Password / encrypted note):

- `.env.local`
- Any personal API keys not in Vercel
- Browser logins (GitHub, Vercel, Supabase, Twilio, Anthropic)
- Optional: SSH keys / `gh` auth (`gh auth login`)

---

## 8. Smoke checklist (new laptop)

- [ ] `npm install` succeeds  
- [ ] `.env.local` present; `TWILIO_*` spelling correct if using SMS  
- [ ] `npm run dev` → landing loads  
- [ ] Sign up / log in works (check Supabase redirect URLs if not)  
- [ ] Upload a syllabus (`fixtures/sample-syllabus.txt`) → review page  
- [ ] Calendar shows deadlines  
- [ ] Class page: notes / study guide / quiz (needs `ANTHROPIC_API_KEY`)  
- [ ] Resume generate/preview (if testing that path)  
- [ ] Profile SMS (only if Twilio vars set)  
- [ ] `git status` does **not** show `.env.local` as staged  

---

## 9. Deploy reminder

```bash
git push origin main   # only when you intend to ship
```

Vercel auto-deploys from `main`. Confirm https://www.coremaxsystems.com after Ready.

---

## Quick path (same cloud project, just new Mac)

1. Clone repo → `npm install`  
2. Copy `.env.local` from old machine (fix `TWILLIO_` → `TWILIO_`)  
3. `npm run dev`  
4. Done — no new Supabase/Vercel project needed  
