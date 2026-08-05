/**
 * Production marketing journey screenshots for Coursework by CoreMax.
 * Uses Playwright with system Chrome (channel: 'chrome') — bundled Chromium
 * is unavailable on this macOS 13 arm64 host.
 *
 * Run from campus-os root:
 *   node scripts/capture-demo-screenshots.mjs
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync, statSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "demo-assets");
const BASE = process.env.DEMO_BASE_URL || "https://www.coremaxsystems.com";
const SYLLABUS = join(ROOT, "fixtures/sample-syllabus.txt");
const SLIDES = join(ROOT, "fixtures/slides-sql-joins.txt");

const DEMO_EMAIL = "test+demo-launch@coremaxsystems.com";
const DEMO_PASSWORD = "DemoLaunch!Test2026";
const E2E_EMAIL = "test+e2e-launch@coremaxsystems.com";
const E2E_PASSWORD = "E2eLaunch!Test2026";

const flags = [];
const sizes = [];

function loadEnv() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function confirmAuthEmail(email) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("SUPABASE_ACCESS_TOKEN missing");
  }
  const project = process.env.SUPABASE_PROJECT_REF || "zbfnysljwyebktmxazii";
  const query = `
    update auth.users
    set email_confirmed_at = coalesce(email_confirmed_at, now())
    where email = '${email.replace(/'/g, "''")}';
  `;
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${project}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      },
      body: JSON.stringify({ query }),
    }
  );
  if (!res.ok) {
    throw new Error(`confirmAuthEmail failed: ${res.status} ${await res.text()}`);
  }
}

async function shot(page, name, opts = {}) {
  const path = join(OUT, name);
  await page.waitForTimeout(opts.settleMs ?? 600);
  await page.screenshot({
    path,
    fullPage: opts.fullPage !== false,
  });
  const bytes = statSync(path).size;
  sizes.push({ name, path, bytes });
  console.log(`✓ ${name} (${(bytes / 1024).toFixed(1)} KB)`);
  return path;
}

async function waitSettled(page) {
  await page.waitForLoadState("domcontentloaded");
  try {
    await page.waitForLoadState("networkidle", { timeout: 8000 });
  } catch {
    /* ignore */
  }
  // Dismiss common spinners if still visible briefly
  await page.waitForTimeout(400);
}

async function login(page, email, password) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([
    page.waitForURL(/\/(dashboard|onboarding)/, { timeout: 30000 }),
    page.click('button[type="submit"]'),
  ]);
  await waitSettled(page);
}

async function ensureLoggedOut(context) {
  await context.clearCookies();
}

async function goToSeptember2026(page) {
  await page.goto(`${BASE}/calendar`, { waitUntil: "domcontentloaded" });
  await waitSettled(page);
  const monthBtn = page.getByRole("button", { name: /^month$/i });
  if (await monthBtn.count()) await monthBtn.click();

  const jump = page.getByRole("button", { name: /Jump to Sep 2026|Show Sep 2026/i });
  if (await jump.count()) {
    await jump.first().click();
    await page.waitForTimeout(500);
  }

  for (let i = 0; i < 24; i++) {
    const h2 = await page.locator("h2").first().textContent();
    if (h2 && /September 2026/i.test(h2)) return true;
    // Prefer Next if before Sep 2026, else Prev
    const title = h2 || "";
    const next = page.getByRole("button", { name: /^Next$/i });
    const prev = page.getByRole("button", { name: /^Prev$/i });
    if (/202[0-5]|2026.*(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug)/i.test(title) || /August 2026|July 2026/i.test(title)) {
      if (await next.count()) await next.click();
    } else if (/202[7-9]|October|November|December/i.test(title)) {
      if (await prev.count()) await prev.click();
    } else if (await next.count()) {
      await next.click();
    }
    await page.waitForTimeout(350);
  }
  return false;
}

async function openFirstClass(page) {
  await page.goto(`${BASE}/classes`, { waitUntil: "domcontentloaded" });
  await waitSettled(page);
  const link = page.locator('a[href^="/classes/"]').first();
  if (!(await link.count())) {
    // dashboard open class links
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await waitSettled(page);
  }
  const classLink = page.locator('a[href^="/classes/"]').filter({ hasNotText: /Add/i }).first();
  await classLink.click();
  await page.waitForURL(/\/classes\/[0-9a-f-]+/, { timeout: 15000 });
  await waitSettled(page);
  return page.url();
}

async function main() {
  loadEnv();
  mkdirSync(OUT, { recursive: true });

  console.log("Launching Playwright with channel: chrome …");
  let browser;
  try {
    browser = await chromium.launch({
      channel: "chrome",
      headless: true,
    });
  } catch (err) {
    console.error("FAILED to launch Chrome channel:", err.message);
    process.exit(1);
  }
  console.log("Chrome channel: OK");

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(45000);

  // ——— 01 Landing (logged out) ———
  await ensureLoggedOut(context);
  await page.goto(`${BASE}/`, { waitUntil: "domcontentloaded" });
  await waitSettled(page);
  if (!/coremaxsystems\.com\/?$/.test(page.url().replace(/\/$/, "") + "/") && page.url().includes("/dashboard")) {
    flags.push("01-landing: redirected to dashboard (still logged in?)");
  }
  await shot(page, "01-landing-page.png");

  // ——— 02 Signup filled, not submitted ———
  await page.goto(`${BASE}/signup`, { waitUntil: "domcontentloaded" });
  await waitSettled(page);
  await page.fill("#email", DEMO_EMAIL);
  await page.fill("#password", DEMO_PASSWORD);
  await shot(page, "02-signup-form.png");

  // Try fresh signup + admin confirm; else fall back to e2e
  let account = "e2e-fallback";
  let usedFresh = false;
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    try {
      await page.click('button[type="submit"]');
      await page.waitForTimeout(2000);
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      const supabase = createClient(url, anon);
      await confirmAuthEmail(DEMO_EMAIL);
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
      });
      if (error) throw error;
      // Browser login for cookies
      await login(page, DEMO_EMAIL, DEMO_PASSWORD);
      usedFresh = true;
      account = "demo-launch";
      console.log("Auth: fresh demo-launch account confirmed");
    } catch (err) {
      flags.push(`Fresh signup/confirm failed: ${err.message}`);
      console.warn("Fresh signup failed → e2e fallback:", err.message);
      await ensureLoggedOut(context);
      await login(page, E2E_EMAIL, E2E_PASSWORD);
    }
  } else {
    flags.push(
      "SUPABASE_ACCESS_TOKEN missing — skipped fresh signup; used e2e account for shots 03–11"
    );
    await ensureLoggedOut(context);
    await login(page, E2E_EMAIL, E2E_PASSWORD);
  }

  // ——— 03 Onboarding upload ———
  await page.goto(`${BASE}/onboarding/upload`, { waitUntil: "domcontentloaded" });
  await waitSettled(page);
  const dropOk = await page.getByText(/Drop your syllabus here/i).count();
  if (!dropOk) flags.push("03-onboarding: dropzone copy not found");
  await shot(page, "03-onboarding-syllabus-upload.png");

  // ——— 04 Parse + review ———
  let reviewOk = false;
  try {
    const fileInput = page.locator('input[type="file"]').first();
    await fileInput.setInputFiles(SYLLABUS);
    // Wait for navigation to review or for progress text to finish
    await Promise.race([
      page.waitForURL(/\/onboarding\/review/, { timeout: 120000 }),
      page.waitForSelector("text=Here's your semester", { timeout: 120000 }),
    ]);
    await waitSettled(page);
    reviewOk = /review/.test(page.url()) || (await page.getByText(/Here's your semester/i).count()) > 0;
    if (reviewOk) {
      const target = page.locator("#target-letter");
      if (await target.count()) {
        await target.selectOption("A");
        const save = page.getByRole("button", { name: /Save target/i });
        if (await save.count()) {
          await save.click();
          await page.waitForTimeout(800);
        }
      }
      await shot(page, "04-parsed-semester-review.png");
    } else {
      throw new Error("Did not reach review UI");
    }
  } catch (err) {
    flags.push(`04-parsed-semester-review WEAK/FAILED: ${err.message}`);
    await shot(page, "04-parsed-semester-review.png");
  }

  // ——— 05 Calendar Sep 2026 ———
  try {
    const ok = await goToSeptember2026(page);
    if (!ok) flags.push("05-calendar: could not reach September 2026 title");
    const events = await page.locator('a[href^="/classes/"]').count();
    if (events < 1) flags.push("05-calendar: no event chips visible");
    await shot(page, "05-calendar-view-populated.png");
  } catch (err) {
    flags.push(`05-calendar FAILED: ${err.message}`);
    await shot(page, "05-calendar-view-populated.png");
  }

  // ——— 06 Grades ———
  try {
    await page.goto(`${BASE}/grades`, { waitUntil: "domcontentloaded" });
    await waitSettled(page);
    // Prefer class GradePanel for %-needed copy
    const classLink = page.locator('a[href^="/classes/"]').first();
    if (await classLink.count()) {
      await classLink.click();
      await page.waitForURL(/\/classes\//, { timeout: 15000 });
      await waitSettled(page);
      const hasProjection = await page
        .getByText(/On track|At risk|Failing|need about|aim for/i)
        .count();
      if (!hasProjection) {
        // stay on /grades list if class lacks projection
        await page.goto(`${BASE}/grades`, { waitUntil: "domcontentloaded" });
        await waitSettled(page);
        flags.push("06-grades: class page lacked projection copy; captured /grades list");
      }
    } else {
      flags.push("06-grades: no class links on grades page");
    }
    await shot(page, "06-grades-tab.png");
  } catch (err) {
    flags.push(`06-grades FAILED: ${err.message}`);
    await shot(page, "06-grades-tab.png");
  }

  // ——— 07 Notes ———
  try {
    await openFirstClass(page);
    const newNote = page.getByRole("button", { name: /\+?\s*New note/i });
    if (await newNote.count()) {
      await newNote.click();
      await page.waitForTimeout(300);
      const ta = page.locator('textarea[placeholder*="Lecture notes"]');
      await ta.fill(
        "Lecture 1 — joins overview.\nInner vs outer joins; when to use LEFT JOIN."
      );
      await page.getByRole("button", { name: /^Save$/i }).click();
      const title = page.locator("#new-note-title");
      if (await title.count()) {
        await title.fill("Lecture 1 — SQL joins");
        await page.getByRole("button", { name: /Save with title/i }).click();
        await page.waitForTimeout(800);
      }
    } else {
      flags.push("07-notes: + New note button not found");
    }
    await page.getByRole("heading", { name: /^Notes$/i }).scrollIntoViewIfNeeded();
    await shot(page, "07-notes-panel.png");
  } catch (err) {
    flags.push(`07-notes FAILED: ${err.message}`);
    await shot(page, "07-notes-panel.png");
  }

  // ——— 08 Study guide ———
  try {
    await openFirstClass(page);
    const genBtn = page.getByRole("button", { name: /Generate study guide/i });
    if (!(await genBtn.count())) throw new Error("Generate study guide button missing");
    await genBtn.click();
    await page.waitForTimeout(400);
    const extraFile = page.locator("#source-extra-file");
    if (await extraFile.count()) {
      await extraFile.setInputFiles(SLIDES);
    } else {
      const extraText = page.locator("#source-extra-text");
      if (await extraText.count()) {
        await extraText.fill(readFileSync(SLIDES, "utf8").slice(0, 4000));
      } else {
        flags.push("08-study: no #source-extra-file or #source-extra-text");
      }
    }
    const confirm = page.getByRole("button", { name: /Confirm & generate/i });
    await confirm.click();
    await page.waitForSelector("pre", { timeout: 120000 });
    await waitSettled(page);
    const preLen = await page.locator("pre").first().innerText();
    if (!preLen || preLen.length < 40) flags.push("08-study: generated guide looks empty/short");
    await page.locator("pre").first().scrollIntoViewIfNeeded();
    await shot(page, "08-study-guide-generated.png");
  } catch (err) {
    flags.push(`08-study-guide WEAK/FAILED: ${err.message}`);
    await shot(page, "08-study-guide-generated.png");
  }

  // ——— 09 Quiz mode ———
  try {
    await openFirstClass(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);

    // Open an existing quiz set card if present
    const setBtn = page.getByRole("button", { name: /Quiz —/i });
    if (await setBtn.count()) {
      await setBtn.first().click();
      await page.waitForTimeout(500);
    }

    let started = false;
    const start = page.getByRole("button", { name: /Start quiz|Retake/i });
    if (await start.count()) {
      await start.first().click();
      started = true;
    } else {
      // Generate with longer pasted material (short fixtures fail validation)
      const newQuiz = page.getByRole("button", { name: /\+?\s*New quiz\/flashcards/i });
      if (!(await newQuiz.count())) throw new Error("No New quiz or Start quiz controls");
      await newQuiz.click();
      await page.waitForTimeout(400);
      const quizMode = page.getByRole("button", { name: /^Quiz$/i });
      if (await quizMode.count()) await quizMode.click();
      const norm = join(ROOT, "fixtures/reading-normalization.txt");
      const pad =
        (readFileSync(norm, "utf8") + "\n\n" + readFileSync(SLIDES, "utf8") + "\n\n").repeat(8);
      const extraText = page.locator("#source-extra-text");
      if (await extraText.count()) await extraText.fill(pad.slice(0, 12000));
      else throw new Error("No #source-extra-text for long paste");
      await page.getByRole("button", { name: /^Generate$/i }).click();
      await page.getByRole("button", { name: /Start quiz|Retake/i }).first().waitFor({ timeout: 180000 });
      await page.getByRole("button", { name: /Start quiz|Retake/i }).first().click();
      started = true;
    }
    if (!started) throw new Error("Could not start quiz");

    await page.getByText(/Question \d+ of/i).waitFor({ timeout: 30000 });
    const check = page.getByRole("button", { name: /^Check answer$/i });
    await check.waitFor();
    const section = page.locator("section").filter({ has: check });
    await section.scrollIntoViewIfNeeded();
    const opts = section.locator('ul li button[type="button"]');
    await opts.nth(1).click();
    await page.waitForTimeout(400);
    const pressed = await opts.nth(1).getAttribute("aria-pressed");
    if (pressed !== "true") flags.push("09-quiz: option click did not set aria-pressed=true");
    const box = await section.boundingBox();
    const path09 = join(OUT, "09-quiz-mode-in-progress.png");
    if (box) {
      await page.screenshot({
        path: path09,
        clip: {
          x: Math.max(0, box.x - 16),
          y: Math.max(0, box.y - 16),
          width: Math.min(1280, box.width + 32),
          height: Math.min(900, box.height + 32),
        },
      });
    } else {
      await section.screenshot({ path: path09 });
    }
    const bytes = statSync(path09).size;
    sizes.push({ name: "09-quiz-mode-in-progress.png", path: path09, bytes });
    console.log(`✓ 09-quiz-mode-in-progress.png (${(bytes / 1024).toFixed(1)} KB)`);
  } catch (err) {
    flags.push(`09-quiz WEAK/FAILED: ${err.message}`);
    await shot(page, "09-quiz-mode-in-progress.png");
  }

  // ——— 10 Resume template A ———
  try {
    await page.goto(`${BASE}/resume`, { waitUntil: "domcontentloaded" });
    await waitSettled(page);
    // If intake wizard incomplete, try to finish quickly or jump to generate
    const generateNav = page.getByRole("link", { name: /Generate|template/i });
    // Fill minimal wizard if on step forms
    const finish = page.getByRole("button", { name: /Finish draft/i });
    if (await page.locator("#full-name, #fullName, input[name='fullName']").count()) {
      // Best-effort skip through existing data
    }
    // Go generate page
    await page.goto(`${BASE}/resume/generate`, { waitUntil: "domcontentloaded" });
    await waitSettled(page);
    // If redirected back to resume intake, try finish draft path
    if (page.url().includes("/resume") && !page.url().includes("/generate")) {
      flags.push("10-resume: /resume/generate redirected — intake may be incomplete");
      // Try click through wizard with minimal fills
      for (let step = 0; step < 8; step++) {
        const next = page.getByRole("button", { name: /Next|Continue|Finish draft/i });
        if (!(await next.count())) break;
        // fill visible required text inputs lightly
        const inputs = page.locator("input[type='text'], input:not([type]), textarea");
        const n = await inputs.count();
        for (let i = 0; i < Math.min(n, 6); i++) {
          const el = inputs.nth(i);
          const val = await el.inputValue().catch(() => "");
          if (!val) {
            await el.fill("Demo Student").catch(() => {});
          }
        }
        const label = await next.first().innerText();
        await next.first().click();
        await page.waitForTimeout(600);
        if (/Finish/i.test(label)) break;
      }
      await page.goto(`${BASE}/resume/generate`, { waitUntil: "domcontentloaded" });
      await waitSettled(page);
    }

    const templateA = page.getByRole("button", { name: /Template A/i });
    if (await templateA.count()) {
      await templateA.click();
      await page.waitForTimeout(300);
    } else {
      flags.push("10-resume: Template A button not found");
    }
    const gen = page.getByRole("button", { name: /Generate resume/i });
    if (await gen.count()) {
      await gen.click();
      await page.waitForURL(/\/resume\/preview/, { timeout: 180000 });
      await waitSettled(page);
      await page.waitForSelector('iframe[title="Resume preview"]', { timeout: 60000 });
      await page.waitForTimeout(1500);
      await shot(page, "10-resume-builder-template-a.png");
    } else {
      flags.push("10-resume: Generate resume button missing");
      await shot(page, "10-resume-builder-template-a.png");
    }
  } catch (err) {
    flags.push(`10-resume WEAK/FAILED: ${err.message}`);
    await shot(page, "10-resume-builder-template-a.png");
  }

  // ——— 11 PDF preview ———
  try {
    // PDF is a download, not in-page viewer — capture preview UI + note flag
    if (!page.url().includes("/resume/preview")) {
      await page.goto(`${BASE}/resume/preview`, { waitUntil: "domcontentloaded" });
      await waitSettled(page);
    }
    const pdfBtn = page.getByRole("button", { name: /Download PDF/i });
    if (await pdfBtn.count()) {
      // Trigger download to prove PDF works; screenshot remains HTML preview
      const [download] = await Promise.all([
        page.waitForEvent("download", { timeout: 120000 }).catch(() => null),
        pdfBtn.click(),
      ]);
      if (download) {
        const tmp = join(OUT, "_tmp-resume.pdf");
        await download.saveAs(tmp);
        const pdfBytes = statSync(tmp).size;
        sizes.push({ name: "_tmp-resume.pdf", path: tmp, bytes: pdfBytes });
        console.log(`  PDF download OK (${(pdfBytes / 1024).toFixed(1)} KB)`);
        flags.push(
          "11-resume-pdf-preview: no in-page PDF viewer — captured HTML preview UI; PDF download succeeded as side proof"
        );
      } else {
        flags.push("11-resume-pdf-preview: Download PDF did not yield a download event");
      }
    } else {
      flags.push("11-resume-pdf-preview: Download PDF button missing");
    }
    await shot(page, "11-resume-pdf-preview.png");
  } catch (err) {
    flags.push(`11-resume-pdf WEAK/FAILED: ${err.message}`);
    await shot(page, "11-resume-pdf-preview.png");
  }

  // README
  const captions = {
    "01-landing-page.png": "Logged-out landing — Coursework by CoreMax hero.",
    "02-signup-form.png": "Signup form filled and ready (not submitted).",
    "03-onboarding-syllabus-upload.png": "Syllabus dropzone — upload to start the semester.",
    "04-parsed-semester-review.png": "AI-parsed deadlines and grade weights, ready to confirm.",
    "05-calendar-view-populated.png": "Month calendar with syllabus deadlines on the board.",
    "06-grades-tab.png": "Grades pulse — target, current standing, risk/need copy.",
    "07-notes-panel.png": "Class notes with a titled lecture note.",
    "08-study-guide-generated.png": "Generated study guide from course materials.",
    "09-quiz-mode-in-progress.png": "Quiz in progress with an answer option selected.",
    "10-resume-builder-template-a.png": "Resume preview — Template A (Technical / Classic).",
    "11-resume-pdf-preview.png": "Resume preview surface used for PDF export.",
  };

  let md = `# Coursework by CoreMax — demo journey screenshots\n\n`;
  md += `Captured from production (\`${BASE}\`) via Playwright **Chrome channel**.\n\n`;
  md += `Account used for authenticated shots: **${account}**` +
    (usedFresh ? " (fresh demo-launch)." : " (e2e fallback).") +
    `\n\n`;
  md += `| File | Caption |\n| --- | --- |\n`;
  for (const [file, cap] of Object.entries(captions)) {
    md += `| \`${file}\` | ${cap} |\n`;
  }
  if (flags.length) {
    md += `\n## Flags\n\n`;
    for (const f of flags) md += `- ${f}\n`;
  }
  writeFileSync(join(OUT, "README.md"), md);

  await browser.close();

  console.log("\n=== SIZES ===");
  for (const s of sizes) {
    console.log(`${s.path}  ${s.bytes} bytes`);
  }
  console.log("\n=== FLAGS ===");
  if (!flags.length) console.log("(none)");
  else flags.forEach((f) => console.log("- " + f));
  console.log(`\nChrome channel used: yes`);
  console.log(`Account: ${account}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
