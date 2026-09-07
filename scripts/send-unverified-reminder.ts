/**
 * Reminder for auth users who signed up but never confirmed email
 * (email_confirmed_at IS NULL).
 *
 * Safe default: requires --test=<email> to send to a single address.
 * Bulk send: --confirm-send-all (typed "yes" confirmation required).
 *
 * Optional: --also-resend-supabase triggers supabase.auth.resend({ type: "signup" })
 * for each recipient after the reminder email (fresh confirmation link from Auth).
 *
 *   npx tsx scripts/send-unverified-reminder.ts --test=testcoremax@gmail.com
 *   npx tsx scripts/send-unverified-reminder.ts --confirm-send-all
 *   npx tsx scripts/send-unverified-reminder.ts --confirm-send-all --also-resend-supabase
 *
 * Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY (for resend), RESEND_API_KEY
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "../src/lib/email";

const SUBJECT = "Finish setting up your Coursework account";
const REPLY_TO = "help@coremaxsystems.com";
const SEND_DELAY_MS = 250;
const LOGIN_URL = "https://www.coremaxsystems.com/login";
const SIGNUP_URL = "https://www.coremaxsystems.com/signup";

/** Obvious throwaway / spam signups — excluded from bulk by default. */
const JUNK_EMAILS = new Set([
  "ytt@gmail.com",
  "asd@edu.com",
  "asd@work.com",
  "asd@work.edu",
  "sda@gmail.com",
]);

const BODY_TEXT = `Hey,

You started a Coursework by CoreMax account but haven't confirmed your email yet — so you can't log in until that's done.

Here's how to finish:

1. Check your inbox (and spam/junk) for the confirmation email from CoreMax / noreply@coremaxsystems.com and tap the confirm link.
2. Then log in here: ${LOGIN_URL}

There's no "resend confirmation" button in the app today. If you can't find the original email, just reply to this message (or email help@coremaxsystems.com) and we'll send you a fresh confirmation link.

Prefer not to dig through email? You can also use "Continue with Google" on the signup or login page with the same address — if that Google account uses this email, you're in.

— Maxwell
Coursework by CoreMax

---
To unsubscribe from marketing emails, email help@coremaxsystems.com with subject "unsubscribe".`;

function buildBodyHtml() {
  const unsubscribeMailto =
    "mailto:help@coremaxsystems.com?subject=unsubscribe";
  return `<p>Hey,</p>
<p>You started a Coursework by CoreMax account but haven't confirmed your email yet — so you can't log in until that's done.</p>
<p><strong>Here's how to finish:</strong></p>
<ol>
  <li>Check your inbox (and spam/junk) for the confirmation email from CoreMax / noreply@coremaxsystems.com and tap the confirm link.</li>
  <li>Then log in here: <a href="${LOGIN_URL}">${LOGIN_URL}</a></li>
</ol>
<p>There's no &quot;resend confirmation&quot; button in the app today. If you can't find the original email, just reply to this message (or email <a href="mailto:help@coremaxsystems.com">help@coremaxsystems.com</a>) and we'll send you a fresh confirmation link.</p>
<p>Prefer not to dig through email? You can also use &quot;Continue with Google&quot; on the <a href="${SIGNUP_URL}">signup</a> or <a href="${LOGIN_URL}">login</a> page with the same address — if that Google account uses this email, you're in.</p>
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
  const alsoResendSupabase = argv.includes("--also-resend-supabase");
  const includeJunk = argv.includes("--include-junk");
  return { testEmail, confirmSendAll, alsoResendSupabase, includeJunk };
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

function createAnonClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
    );
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function fetchUnverifiedRecipients(includeJunk: boolean) {
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
      if (u.email_confirmed_at) continue;
      const email = (u.email ?? "").trim().toLowerCase();
      if (!email) continue;
      if (!includeJunk && JUNK_EMAILS.has(email)) continue;
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

async function resendSupabaseConfirmation(to: string) {
  const anon = createAnonClient();
  const { error } = await anon.auth.resend({
    type: "signup",
    email: to,
    options: {
      emailRedirectTo: "https://www.coremaxsystems.com/login",
    },
  });
  if (error) return { success: false as const, error: error.message };
  return { success: true as const };
}

function printUsage() {
  console.log(`Usage:
  npx tsx scripts/send-unverified-reminder.ts --test=<email>
    Send one test reminder (safe default).

  npx tsx scripts/send-unverified-reminder.ts --confirm-send-all
    Send to unverified auth users (excludes junk signups by default).
    Prints recipient count and requires typing "yes" before sending.

  Flags:
    --include-junk           Include asd@* / ytt@ / sda@ throwaways
    --also-resend-supabase   Also call auth.resend({ type: "signup" }) per recipient`);
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

async function sendBatch(
  recipients: string[],
  label: string,
  alsoResendSupabase: boolean
) {
  if (!process.env.RESEND_API_KEY?.trim()) {
    throw new Error("RESEND_API_KEY is required to send emails");
  }

  console.log(`\n=== ${label} ===`);
  console.log(`Recipients: ${recipients.length}`);
  console.log(`Subject: ${SUBJECT}`);
  console.log(`Reply-To: ${REPLY_TO}`);
  console.log(`Also resend Supabase confirm: ${alsoResendSupabase}\n`);

  let ok = 0;
  let fail = 0;
  let resendOk = 0;
  let resendFail = 0;

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

    if (alsoResendSupabase) {
      const r = await resendSupabaseConfirmation(email);
      if (r.success) {
        resendOk += 1;
        console.log(`  resend OK ${email}`);
      } else {
        resendFail += 1;
        console.error(`  resend FAIL ${email}: ${r.error}`);
      }
    }

    if (i < recipients.length - 1) {
      await sleep(SEND_DELAY_MS);
    }
  }

  console.log(
    `\nDone. email ok=${ok} fail=${fail}` +
      (alsoResendSupabase
        ? ` | supabase resend ok=${resendOk} fail=${resendFail}`
        : "") +
      ` total=${recipients.length}`
  );
}

async function main() {
  loadEnv();
  const { testEmail, confirmSendAll, alsoResendSupabase, includeJunk } =
    parseArgs(process.argv.slice(2));

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
    await sendBatch([testEmail], "TEST SEND", alsoResendSupabase);
    return;
  }

  const recipients = await fetchUnverifiedRecipients(includeJunk);

  console.log("=== BULK SEND PREVIEW ===");
  console.log(`Recipient count: ${recipients.length}`);
  console.log(`Include junk: ${includeJunk}`);
  console.log("\nRecipients:");
  recipients.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));

  const confirmed = await promptYes(
    `\nAbout to send to ${recipients.length} unverified users. Type "yes" to confirm: `
  );
  if (!confirmed) {
    console.log("Aborted — confirmation not received.");
    return;
  }

  await sendBatch(recipients, "BULK SEND", alsoResendSupabase);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
