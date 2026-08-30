/**
 * ClassToExcel billing smoke test — Playwright browser auth (SSR cookies).
 * Run:
 *   TEST_BASE_URL='https://www.coremaxsystems.com' \
 *   TEST_EMAIL='…' CAMPUS_PASSWORD='…' \
 *   npm run smoke:classtoexcel
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const SYLLABUS = join(ROOT, "fixtures/sample-syllabus.txt");
const XLSX_TYPE =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

const results = [];

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

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}: ${detail}`);
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

function cookieDomainForBase(baseUrl) {
  const hostname = new URL(baseUrl).hostname;
  if (hostname === "localhost" || hostname.endsWith(".local")) {
    return hostname;
  }
  const parts = hostname.split(".");
  if (parts.length >= 2) {
    return `.${parts.slice(-2).join(".")}`;
  }
  return hostname;
}

async function authenticateContext(context, email, password) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(error?.message || "Supabase sign-in failed");
  }

  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(
    "."
  )[0];
  const sessionPayload = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  });
  const cookieValue = `base64-${Buffer.from(sessionPayload).toString("base64")}`;

  await context.clearCookies();
  await context.addCookies([
    {
      name: `sb-${projectRef}-auth-token`,
      value: cookieValue,
      domain: cookieDomainForBase(BASE),
      path: "/",
      sameSite: "Lax",
    },
  ]);

  return data.session.user.id;
}

async function login(page, email, password) {
  const userId = await authenticateContext(page.context(), email, password);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    throw new Error("Auth cookie injection failed — redirected to login");
  }
  return userId;
}

async function resetClassToExcelUsage(email) {
  const { error } = await admin()
    .from("profiles")
    .update({
      classtoexcel_conversions_used: 0,
      subscription_plan: null,
      subscription_current_period_end: null,
      subscription_cancel_at_period_end: false,
      subscription_expires_at: null,
      stripe_subscription_id: null,
      subscription_status: "free",
    })
    .ilike("email", email);
  if (error) throw error;
}

async function setPremium(email) {
  const { error } = await admin()
    .from("profiles")
    .update({
      subscription_status: "active",
      stripe_subscription_id: "sub_smoke_classtoexcel_test",
      subscription_plan: "monthly",
    })
    .ilike("email", email);
  if (error) throw error;
}

async function convertFromBrowser(page) {
  const syllabusBytes = readFileSync(SYLLABUS);
  const b64 = Buffer.from(syllabusBytes).toString("base64");
  return page.evaluate(
    async ({ b64, fileName }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append(
        "file",
        new File([bytes], fileName, { type: "text/plain" })
      );
      const res = await fetch("/api/classtoexcel/convert", {
        method: "POST",
        body: form,
      });
      const contentType = res.headers.get("Content-Type");
      let json = null;
      if (contentType?.includes("json")) {
        json = await res.json().catch(() => ({}));
      }
      return { status: res.status, contentType, json };
    },
    { b64, fileName: "sample-syllabus.txt" }
  );
}

async function exportFromBrowser(page, classIds) {
  return page.evaluate(
    async ({ classIds }) => {
      const res = await fetch("/api/classtoexcel/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classIds }),
      });
      const contentType = res.headers.get("Content-Type");
      let json = null;
      if (contentType?.includes("json")) {
        json = await res.json().catch(() => ({}));
      }
      return { status: res.status, contentType, json };
    },
    { classIds }
  );
}

async function main() {
  loadEnv();
  const email = process.env.TEST_EMAIL?.trim();
  const password = process.env.CAMPUS_PASSWORD?.trim();
  if (!email || !password) {
    console.error("Set TEST_EMAIL and CAMPUS_PASSWORD");
    process.exit(1);
  }
  if (!existsSync(SYLLABUS)) {
    console.error(`Missing fixture ${SYLLABUS}`);
    process.exit(1);
  }

  console.log(`ClassToExcel smoke — ${email} @ ${BASE}\n`);

  await resetClassToExcelUsage(email);

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PW_CHANNEL || "chrome",
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const userId = await login(page, email, password);
    record("setup", true, "Logged in");

    for (let i = 1; i <= 3; i++) {
      const r = await convertFromBrowser(page);
      record(
        `convert_${i}`,
        r.status === 200 && r.contentType === XLSX_TYPE,
        `status=${r.status} type=${r.contentType ?? "none"}`
      );
    }

    const blocked = await convertFromBrowser(page);
    record(
      "convert_paywall",
      blocked.status === 402 &&
        blocked.json?.error === "PAYWALL_REQUIRED" &&
        blocked.json?.feature === "classtoexcel",
      `status=${blocked.status} error=${blocked.json?.error ?? "none"} feature=${blocked.json?.feature ?? "none"}`
    );

    const { data: cls } = await admin()
      .from("classes")
      .select("id")
      .eq("user_id", userId)
      .limit(1)
      .maybeSingle();

    if (cls?.id) {
      const exportBlocked = await exportFromBrowser(page, [cls.id]);
      record(
        "export_shared_counter",
        exportBlocked.status === 402 &&
          exportBlocked.json?.error === "PAYWALL_REQUIRED",
        `status=${exportBlocked.status} error=${exportBlocked.json?.error ?? "none"}`
      );
    } else {
      record(
        "export_shared_counter",
        false,
        "skipped — no classes for test user (need at least one class)"
      );
    }

    await setPremium(email);
    const unlimited = await convertFromBrowser(page);
    record(
      "convert_unlimited_after_subscribe",
      unlimited.status === 200 && unlimited.contentType === XLSX_TYPE,
      `status=${unlimited.status} type=${unlimited.contentType ?? "none"}`
    );
  } finally {
    await browser.close();
  }

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
