/**
 * ONE-TIME manual thank-you email to confirmed CoreMax signups via Resend.
 *
 * Dry-run (default — no sends):
 *   npx tsx scripts/send-launch-thank-you.ts
 *
 * Actually send (only after you confirm dry-run output):
 *   npx tsx scripts/send-launch-thank-you.ts --send
 *
 * Optional: --limit N
 *
 * Env (.env.local or shell):
 *   SUPABASE_ACCESS_TOKEN   — required (sbp_…) for auth.users query
 *   SUPABASE_PROJECT_REF    — optional (default zbfnysljwyebktmxazii)
 *   RESEND_API_KEY          — required only with --send
 *   THANK_YOU_REPLY_TO      — optional (default maxwellowen199@gmail.com)
 *   THANK_YOU_FROM          — optional (default noreply@coremaxsystems.com)
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PROJECT_DEFAULT = "zbfnysljwyebktmxazii";
const FROM_DEFAULT = "Coursework by CoreMax <noreply@coremaxsystems.com>";
const REPLY_TO_DEFAULT = "maxwellowen199@gmail.com";

const SUBJECT = "Thank you for trying Coursework by CoreMax 🙏";

const BODY_TEXT = `Hey,

Thank you for signing up for Coursework by CoreMax — it means a lot, especially this early.

I'm actively building this and would love your honest feedback: what's working, what's confusing, what you wish it did. Just reply to this email directly, I read every response.

Coming in v1.2: Google Calendar integration, so your CoreMax deadlines sync straight to your own calendar. More features on the way too.

— Maxwell`;

const BODY_HTML = `<p>Hey,</p>
<p>Thank you for signing up for Coursework by CoreMax — it means a lot, especially this early.</p>
<p>I'm actively building this and would love your honest feedback: what's working, what's confusing, what you wish it did. Just reply to this email directly, I read every response.</p>
<p>Coming in v1.2: Google Calendar integration, so your CoreMax deadlines sync straight to your own calendar. More features on the way too.</p>
<p>— Maxwell</p>`;

/** Confirmed users only; exclude internal/test accounts in SQL. */
const LIST_QUERY = `
select email
from auth.users
where email_confirmed_at is not null
  and email is not null
  and email not ilike 'test+%@coremaxsystems.com'
  and email not ilike 'campusos.html.e2e.%'
  and email not ilike 'campusos.e2e.%'
  and email not ilike 'campusos.rls.%'
order by created_at asc;
`;

/** Mirror SQL exclusions for service-role listUsers fallback. */
function isExcludedTestEmail(email: string): boolean {
  const e = email.toLowerCase();
  if (/^test\+.*@coremaxsystems\.com$/.test(e)) return true;
  if (e.startsWith("campusos.html.e2e.")) return true;
  if (e.startsWith("campusos.e2e.")) return true;
  if (e.startsWith("campusos.rls.")) return true;
  return false;
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

async function fetchViaManagementSql(): Promise<string[]> {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) {
    throw new Error("missing SUPABASE_ACCESS_TOKEN");
  }
  const project = process.env.SUPABASE_PROJECT_REF || PROJECT_DEFAULT;
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
      body: JSON.stringify({ query: LIST_QUERY }),
    }
  );
  if (!res.ok) {
    throw new Error(`Management SQL failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as unknown;
  const rows: Array<{ email?: string }> = Array.isArray(data)
    ? data
    : Array.isArray((data as { rows?: unknown }).rows)
      ? (data as { rows: Array<{ email?: string }> }).rows
      : [];
  return rows
    .map((r) => (typeof r.email === "string" ? r.email.trim().toLowerCase() : ""))
    .filter(Boolean);
}

/** Fallback: Auth Admin API (same exclusions applied in-query via list + filter matching SQL). */
async function fetchViaServiceRole(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  const { createClient } = await import("@supabase/supabase-js");
  const admin = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const emails: string[] = [];
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    for (const u of data.users) {
      const email = u.email?.trim().toLowerCase();
      if (!email) continue;
      if (!u.email_confirmed_at) continue;
      if (isExcludedTestEmail(email)) continue;
      emails.push(email);
    }
    if (data.users.length < 200) break;
    page += 1;
  }
  return emails;
}

async function fetchConfirmedEmails(): Promise<string[]> {
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    const emails = await fetchViaManagementSql();
    return [...new Set(emails)];
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.warn(
      "Note: using SUPABASE_SERVICE_ROLE_KEY fallback (exclusions mirrored in code to match SQL)."
    );
    const emails = await fetchViaServiceRole();
    return [...new Set(emails)];
  }
  throw new Error(
    "Set SUPABASE_ACCESS_TOKEN (sbp_…) for SQL list, or SUPABASE_SERVICE_ROLE_KEY as fallback"
  );
}

async function sendOne(
  to: string,
  apiKey: string,
  from: string,
  replyTo: string
): Promise<void> {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      reply_to: replyTo,
      subject: SUBJECT,
      text: BODY_TEXT,
      html: BODY_HTML,
    }),
  });
  if (!res.ok) {
    throw new Error(`${res.status} ${await res.text()}`);
  }
}

async function main() {
  loadEnv();
  const doSend = process.argv.includes("--send");
  const limitArg = process.argv.find((a) => a.startsWith("--limit="));
  const limit = limitArg ? Number(limitArg.split("=")[1]) : undefined;

  const from = process.env.THANK_YOU_FROM || FROM_DEFAULT;
  const replyTo = process.env.THANK_YOU_REPLY_TO || REPLY_TO_DEFAULT;

  console.log("=== Launch thank-you (Coursework by CoreMax) ===\n");
  console.log("Mode:", doSend ? "SEND" : "DRY-RUN (no emails sent)");
  console.log("From:", from);
  console.log("Reply-To:", replyTo);
  console.log("\n--- Subject ---");
  console.log(SUBJECT);
  console.log("\n--- Body (text) ---");
  console.log(BODY_TEXT);
  console.log("\n--- Fetching recipients (SQL excludes test+%@coremaxsystems.com) ---\n");

  let emails = await fetchConfirmedEmails();
  const leakedTest = emails.filter((e) => isExcludedTestEmail(e));
  if (leakedTest.length) {
    throw new Error(
      `Safety abort: excluded test addresses still present: ${leakedTest.join(", ")}`
    );
  }

  if (limit != null && Number.isFinite(limit) && limit > 0) {
    emails = emails.slice(0, limit);
    console.log(`(--limit=${limit} applied)\n`);
  }

  console.log(`Recipient count: ${emails.length}\n`);
  console.log("--- Full recipient list ---");
  emails.forEach((e, i) => console.log(`${String(i + 1).padStart(3, " ")}. ${e}`));
  console.log("");

  if (!doSend) {
    console.log(
      "Dry-run complete. Review the list and copy above. Re-run with --send when you say go."
    );
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("RESEND_API_KEY required for --send");
  }

  let ok = 0;
  let fail = 0;
  for (const email of emails) {
    try {
      await sendOne(email, apiKey, from, replyTo);
      ok += 1;
      console.log(`OK  ${email}`);
    } catch (err) {
      fail += 1;
      console.error(`FAIL ${email}:`, err instanceof Error ? err.message : err);
    }
    await sleep(550);
  }
  console.log(`\nDone. ok=${ok} fail=${fail} total=${emails.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
