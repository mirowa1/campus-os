/**
 * v1.5 update announcement — Continue with Google + ClassToExcel in nav.
 *
 * Recipients: verified auth users only (email_confirmed_at IS NOT NULL).
 * Unverified signups are excluded entirely.
 *
 * Safe default: requires --test=<email> to send to a single address.
 * Bulk send: --confirm-send-all (typed "yes" confirmation required).
 *
 *   npx tsx scripts/send-update-v1-5.ts --test=testcoremax@gmail.com
 *   npx tsx scripts/send-update-v1-5.ts --confirm-send-all
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../src/lib/email";

const SUBJECT = "CoreMax Update — Google sign-in + ClassToExcel";
const REPLY_TO = "help@coremaxsystems.com";
const SEND_DELAY_MS = 250;
const SITE = "https://www.coremaxsystems.com";

const BODY_TEXT = `Hey,

Quick update — a couple new things are live on Coursework.

What's new:
- Continue with Google — sign in or sign up in one click, no password needed. You'll see it on the login and signup pages.
- ClassToExcel — export any class (or your whole semester) to a color-coded Excel spreadsheet. It's in the main nav now: ${SITE}/classtoexcel

Jump in anytime: ${SITE}

Have a question, ran into a bug, or want to request a feature? Email us anytime at help@coremaxsystems.com — we read every message.

More improvements coming soon.

— Maxwell
Coursework by CoreMax

---
To unsubscribe from marketing emails, email help@coremaxsystems.com with subject "unsubscribe".`;

function buildBodyHtml() {
  const unsubscribeMailto =
    "mailto:help@coremaxsystems.com?subject=unsubscribe";
  return `<p>Hey,</p>
<p>Quick update — a couple new things are live on Coursework.</p>
<p><strong>What's new:</strong></p>
<ul>
  <li><strong>Continue with Google</strong> — sign in or sign up in one click, no password needed. You'll see it on the login and signup pages.</li>
  <li><strong>ClassToExcel</strong> — export any class (or your whole semester) to a color-coded Excel spreadsheet. It's in the main nav now: <a href="${SITE}/classtoexcel">${SITE}/classtoexcel</a></li>
</ul>
<p>Jump in anytime: <a href="${SITE}">${SITE}</a></p>
<p>Have a question, ran into a bug, or want to request a feature? Email us anytime at <a href="mailto:help@coremaxsystems.com">help@coremaxsystems.com</a> — we read every message.</p>
<p>More improvements coming soon.</p>
<p>— Maxwell<br/>Coursework by CoreMax</p>
<hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0;" />
<p style="font-size:12px;color:#666;line-height:1.5;">
  To unsubscribe from marketing emails,
  <a href="${unsubscribeMailto}">email help@coremaxsystems.com</a>
  with subject &quot;unsubscribe&quot;.
</p>`;
}

function loadEnv() {
  const path = join(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function parseArgs(argv: string[]) {
  const testArg = argv.find((a) => a.startsWith("--test="));
  const testEmail = testArg ? testArg.slice("--test=".length).trim() : null;
  const confirmSendAll = argv.includes("--confirm-send-all");
  return { testEmail, confirmSendAll };
}

/** Same exclusion pattern as prior campaign scripts. */
function isExcludedEmail(email: string) {
  const e = email.toLowerCase();
  return (
    e.includes("test") || e.includes("coremax") || e.includes("e2e")
  );
}

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Verified auth.users only — never includes email_confirmed_at IS NULL. */
async function fetchProductionRecipients() {
  const admin = createAdminClient();
  const emails: string[] = [];
  const pageSize = 1000;
  let page = 1;

  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: pageSize,
    });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    const users = data.users ?? [];
    for (const u of users) {
      if (!u.email_confirmed_at) continue;
      const email = (u.email ?? "").trim().toLowerCase();
      if (!email) continue;
      if (isExcludedEmail(email)) continue;
      emails.push(email);
    }
    if (users.length < pageSize) break;
    page += 1;
  }

  return [...new Set(emails)].sort();
}

async function sendToRecipient(to: string) {
  return sendEmail({
    to,
    subject: SUBJECT,
    html: buildBodyHtml(),
    text: BODY_TEXT,
    replyTo: REPLY_TO,
  });
}

function printUsage() {
  console.log(`Usage:
  npx tsx scripts/send-update-v1-5.ts --test=<email>
    Send one test email to the given address (safe default).

  npx tsx scripts/send-update-v1-5.ts --confirm-send-all
    Send to verified auth users only (excludes test/coremax/e2e emails).
    Prints recipient count and requires typing "yes" before sending.`);
}

async function promptYes(message: string) {
  const rl = createInterface({ input, output });
  try {
    const answer = (await rl.question(message)).trim().toLowerCase();
    return answer === "yes";
  } finally {
    rl.close();
  }
}

async function sendBatch(recipients: string[], label: string) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY is required to send emails");
  }

  console.log(`\n=== ${label} ===`);
  console.log(`Recipients: ${recipients.length}`);
  console.log(`Subject: ${SUBJECT}`);
  console.log(`Reply-To: ${REPLY_TO}\n`);

  let ok = 0;
  let fail = 0;

  for (let i = 0; i < recipients.length; i++) {
    const email = recipients[i];
    const result = await sendToRecipient(email);
    if (result.success) {
      ok += 1;
      console.log(`OK   ${email}${result.id ? ` (${result.id})` : ""}`);
    } else {
      fail += 1;
      console.error(`FAIL ${email}: ${result.error ?? "unknown error"}`);
    }
    if (i < recipients.length - 1) {
      await sleep(SEND_DELAY_MS);
    }
  }

  console.log(`\nDone. ok=${ok} fail=${fail} total=${recipients.length}`);
}

async function main() {
  loadEnv();
  const { testEmail, confirmSendAll } = parseArgs(process.argv.slice(2));

  if (!testEmail && !confirmSendAll) {
    printUsage();
    console.log(
      "\nNo action taken. Pass --test=<email> for a single test send."
    );
    return;
  }

  if (testEmail && confirmSendAll) {
    throw new Error("Use either --test=<email> or --confirm-send-all, not both.");
  }

  if (testEmail) {
    if (!testEmail.includes("@")) {
      throw new Error(`Invalid --test email: ${testEmail}`);
    }
    await sendBatch([testEmail], "TEST SEND");
    return;
  }

  const recipients = await fetchProductionRecipients();
  const leaked = recipients.filter((e) => isExcludedEmail(e));
  if (leaked.length) {
    throw new Error(
      `Safety abort: excluded addresses in list: ${leaked.join(", ")}`
    );
  }

  console.log("=== BULK SEND PREVIEW ===");
  console.log(`Recipient count: ${recipients.length}`);
  console.log("\nFirst 10:");
  recipients.slice(0, 10).forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  if (recipients.length > 10) {
    console.log(`  … and ${recipients.length - 10} more`);
  }

  const confirmed = await promptYes(
    `\nAbout to send to ${recipients.length} verified users. Type "yes" to confirm: `
  );
  if (!confirmed) {
    console.log("Aborted — confirmation not received.");
    return;
  }

  await sendBatch(recipients, "BULK SEND");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
