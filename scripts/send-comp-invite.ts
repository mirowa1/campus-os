/**
 * Comp-access invite emails.
 *
 * Preview: --preview (prints subject + body, no send).
 * Test send: --test (always sends to TEST_EMAIL below).
 * Single: --send-to=<email> (must be in RECIPIENTS or PENDING_NO_ACCOUNT).
 * Pending batch: --confirm-send-pending (the 3 no-account invites).
 * Legacy bulk: --confirm-send-all (old RECIPIENTS list — use carefully).
 *
 *   npx tsx scripts/send-comp-invite.ts --preview
 *   npx tsx scripts/send-comp-invite.ts --test
 *   npx tsx scripts/send-comp-invite.ts --send-to=esika1@student.gsu.edu
 *   npx tsx scripts/send-comp-invite.ts --confirm-send-pending
 *
 * Env (.env.local): RESEND_API_KEY
 *
 * Copy does NOT claim access is already active — recipients must sign up,
 * then reply for manual Pro grant (period_end = grant date + 30 days).
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { createInterface } from "readline/promises";
import { stdin as input, stdout as output } from "process";
import { sendEmail } from "../src/lib/email";

/** Standing default for --test preview sends (never the real recipient list). */
const TEST_EMAIL = "testcoremax@gmail.com";

const SUBJECT = "You're invited — 30 days of Coursework Pro (complimentary)";
const REPLY_TO = "help@coremaxsystems.com";
const SEND_DELAY_MS = 250;

/** Legacy list (may include people who already got mail). */
const RECIPIENTS = [
  "danorete@gmail.com",
  "Sammor2023@gmail.com",
  "Tmakinde2@student.gsu.edu",
  "mroseman2@student.gsu.edu",
  "risbyceonna07@gmail.com",
] as const;

/**
 * No Coursework account yet — invite only; do not claim Pro is active.
 * (columbia.edu corrected from typed cloumbia.edu)
 */
const PENDING_NO_ACCOUNT = [
  "mif2128@columbia.edu",
  "esika1@student.gsu.edu",
  "sdunn27@student.gsu.edu",
] as const;

const BODY_TEXT = `Hey,

I'm giving a small group of people complimentary access to Coursework by CoreMax — 30 days of full Pro features, no card required.

A quick overview of what's included:
- Upload a syllabus and get a semester dashboard automatically — due dates, exams, and grading breakdown extracted for you
- Google Calendar sync so everything shows up where you already look
- Grade tracking with projections for what you need on remaining work
- AI-generated study guides and quizzes from your course materials
- ClassToExcel — export any class (or your whole semester) to a color-coded spreadsheet
- Resume builder

Get started: https://www.coremaxsystems.com/signup

Sign up with this same email. Once you're in, reply to this message (or email help@coremaxsystems.com) and I'll turn on your 30 days of complimentary Pro.

Would love honest feedback — what's useful, what's confusing, what's missing.

— Maxwell

---
To unsubscribe from marketing emails, email help@coremaxsystems.com with subject "unsubscribe".`;

function buildBodyHtml() {
  const unsubscribeMailto =
    "mailto:help@coremaxsystems.com?subject=unsubscribe";
  return `<p>Hey,</p>
<p>I'm giving a small group of people complimentary access to <strong>Coursework by CoreMax</strong> — 30 days of full Pro features, no card required.</p>
<p>A quick overview of what's included:</p>
<ul>
  <li>Upload a syllabus and get a semester dashboard automatically — due dates, exams, and grading breakdown extracted for you</li>
  <li>Google Calendar sync so everything shows up where you already look</li>
  <li>Grade tracking with projections for what you need on remaining work</li>
  <li>AI-generated study guides and quizzes from your course materials</li>
  <li>ClassToExcel — export any class (or your whole semester) to a color-coded spreadsheet</li>
  <li>Resume builder</li>
</ul>
<p>Get started: <a href="https://www.coremaxsystems.com/signup">https://www.coremaxsystems.com/signup</a></p>
<p>Sign up with this same email. Once you're in, reply to this message (or email <a href="mailto:help@coremaxsystems.com">help@coremaxsystems.com</a>) and I'll turn on your 30 days of complimentary Pro.</p>
<p>Would love honest feedback — what's useful, what's confusing, what's missing.</p>
<p>— Maxwell</p>
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
  const test = argv.includes("--test");
  const confirmSendAll = argv.includes("--confirm-send-all");
  const confirmSendPending = argv.includes("--confirm-send-pending");
  const preview = argv.includes("--preview");
  const sendToArg = argv.find((a) => a.startsWith("--send-to="));
  const sendTo = sendToArg?.slice("--send-to=".length).trim().toLowerCase() || null;
  return { test, confirmSendAll, confirmSendPending, preview, sendTo };
}

function isAllowedSendTo(email: string) {
  const e = email.toLowerCase();
  return (
    RECIPIENTS.some((r) => r.toLowerCase() === e) ||
    PENDING_NO_ACCOUNT.some((r) => r.toLowerCase() === e)
  );
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

function printRenderedPreview(to?: string, listLabel?: string, list?: readonly string[]) {
  console.log("=== RENDERED PREVIEW ===");
  if (to) console.log(`To: ${to}`);
  console.log(`Subject: ${SUBJECT}`);
  console.log(`Reply-To: ${REPLY_TO}`);
  console.log("\n--- plain text ---\n");
  console.log(BODY_TEXT);
  console.log("\n--- html (truncated header) ---\n");
  console.log(buildBodyHtml().slice(0, 700) + "\n...(html continues)");
  const show = list ?? PENDING_NO_ACCOUNT;
  console.log(`\n${listLabel ?? "Pending no-account recipients"}:`);
  show.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
}

function printUsage() {
  console.log(`Usage:
  npx tsx scripts/send-comp-invite.ts --preview
    Print subject + body without sending.

  npx tsx scripts/send-comp-invite.ts --test
    Send one test email to ${TEST_EMAIL} (standing default).

  npx tsx scripts/send-comp-invite.ts --send-to=<email>
    Send one invite (must be in RECIPIENTS or PENDING_NO_ACCOUNT).

  npx tsx scripts/send-comp-invite.ts --confirm-send-pending
    Send to the ${PENDING_NO_ACCOUNT.length} no-account pending invites.
    Requires typing "yes".

  npx tsx scripts/send-comp-invite.ts --confirm-send-all
    Send to legacy RECIPIENTS list (use carefully).`);
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
  const { test, confirmSendAll, confirmSendPending, preview, sendTo } =
    parseArgs(process.argv.slice(2));

  if (!test && !confirmSendAll && !confirmSendPending && !preview && !sendTo) {
    printUsage();
    console.log(
      "\nNo action taken. Pass --preview, --test, --send-to, --confirm-send-pending, or --confirm-send-all."
    );
    return;
  }

  const flagCount = [
    test,
    confirmSendAll,
    confirmSendPending,
    preview,
    !!sendTo,
  ].filter(Boolean).length;
  if (flagCount > 1) {
    throw new Error(
      "Use only one of --preview, --test, --send-to, --confirm-send-pending, or --confirm-send-all."
    );
  }

  if (preview) {
    printRenderedPreview();
    return;
  }

  if (test) {
    printRenderedPreview(TEST_EMAIL);
    await sendBatch([TEST_EMAIL], "TEST SEND");
    return;
  }

  if (sendTo) {
    if (!isAllowedSendTo(sendTo)) {
      throw new Error(
        `--send-to must be in RECIPIENTS or PENDING_NO_ACCOUNT. Got: ${sendTo}`
      );
    }
    printRenderedPreview(sendTo);
    await sendBatch([sendTo], "SINGLE SEND");
    return;
  }

  if (confirmSendPending) {
    const recipients = [...PENDING_NO_ACCOUNT];
    console.log("=== PENDING NO-ACCOUNT SEND PREVIEW ===");
    console.log(`Recipient count: ${recipients.length}`);
    recipients.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
    console.log(
      "\nCopy does not claim Pro is active — they must sign up, then reply for grant."
    );
    const confirmed = await promptYes(
      `\nAbout to send to ${recipients.length} pending invites. Type "yes" to confirm: `
    );
    if (!confirmed) {
      console.log("Aborted — confirmation not received.");
      return;
    }
    await sendBatch(recipients, "PENDING NO-ACCOUNT SEND");
    return;
  }

  const recipients = [...RECIPIENTS];
  console.log("=== BULK SEND PREVIEW (legacy RECIPIENTS) ===");
  console.log(`Recipient count: ${recipients.length}`);
  recipients.forEach((e, i) => console.log(`  ${i + 1}. ${e}`));
  const confirmed = await promptYes(
    `\nAbout to send to ${recipients.length} recipients. Type "yes" to confirm: `
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
