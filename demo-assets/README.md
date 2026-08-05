# Coursework by CoreMax — demo journey screenshots

Captured from production (`https://www.coremaxsystems.com`) via Playwright **Chrome channel** (`channel: 'chrome'` — system Google Chrome; bundled Chromium unavailable on this host).

Authenticated shots used the **e2e fallback** account (`test+e2e-launch@coremaxsystems.com`) because `SUPABASE_ACCESS_TOKEN` was not available for fresh signup email confirm.

| File | Caption |
| --- | --- |
| `01-landing-page.png` | Logged-out landing — Coursework by CoreMax hero. |
| `02-signup-form.png` | Signup form filled and ready (not submitted). |
| `03-onboarding-syllabus-upload.png` | Syllabus dropzone — upload to start the semester. |
| `04-parsed-semester-review.png` | AI-parsed deadlines and grade weights, ready to confirm. |
| `05-calendar-view-populated.png` | Month calendar with syllabus deadlines on the board. |
| `06-grades-tab.png` | Grades pulse — target, current standing, risk/need copy. |
| `07-notes-panel.png` | Class notes with a titled lecture note. |
| `08-study-guide-generated.png` | Generated study guide from course materials. |
| `09-quiz-mode-in-progress.png` | Quiz in progress with an answer option selected. |
| `10-resume-builder-template-a.png` | Resume preview — Template A (Technical / Classic). |
| `11-resume-pdf-preview.png` | Resume preview surface used for PDF export. |

Sibling folder: `branding-verify/` (prior branding confirmation pass).

## Flags

- `SUPABASE_ACCESS_TOKEN` missing — skipped fresh `demo-launch` signup; shots 03–11 used e2e account.
- `05-calendar-view-populated.png` — recaptured 2026-08-05: dense Sep 2026 after uploading `fixtures/sample-syllabus-sep2026-dense.txt` (CIS 8041); clipped below AppNav (no email in frame).
- `09-quiz-mode-in-progress.png` — first automated pass failed (source-too-short validation / Start quiz never appeared). Recaptured by opening an existing quiz set, starting play, selecting option 2 (`aria-pressed=true` + accent ring). Cropped to the quiz card so selection is visible.
- `11-resume-pdf-preview.png` — **no in-page PDF viewer**; shot is the HTML resume preview UI. PDF **download** succeeded separately (~34 KB) as side proof, then temp file removed.
- Authenticated shots show the e2e email in AppNav — crop before public social posts if needed.
