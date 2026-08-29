/**
 * Billing E2E test matrix — local dev + Stripe test mode.
 * Run: CAMPUS_PASSWORD='…' node scripts/billing-e2e-test.mjs
 */
import { chromium } from "playwright";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const SYLLABUS = join(ROOT, "fixtures/sample-syllabus.txt");

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
  const mark = pass ? "PASS" : "FAIL";
  console.log(`[${mark}] ${id}: ${detail}`);
}

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );
}

async function queryProfile(email) {
  const { data, error } = await admin()
    .from("profiles")
    .select(
      "email,subscription_status,subscription_plan,stripe_customer_id,stripe_subscription_id,free_syllabus_used"
    )
    .eq("email", email)
    .single();
  if (error) throw error;
  return data;
}

async function resetSubscriptionFields(email, keepCustomer = true) {
  const profile = await queryProfile(email);

  const stripeKey = process.env.STRIPE_SECRET_KEY?.trim();
  if (stripeKey) {
    const stripe = new Stripe(stripeKey);
    if (profile.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(profile.stripe_subscription_id);
      } catch {
        /* already canceled */
      }
    }
    if (profile.stripe_customer_id) {
      const subs = await stripe.subscriptions.list({
        customer: profile.stripe_customer_id,
        status: "all",
        limit: 20,
      });
      for (const sub of subs.data) {
        if (sub.status !== "canceled" && sub.status !== "incomplete_expired") {
          try {
            await stripe.subscriptions.cancel(sub.id);
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  const patch = {
    subscription_plan: null,
    subscription_current_period_end: null,
    subscription_cancel_at_period_end: false,
    subscription_expires_at: null,
  };
  if (!keepCustomer) patch.stripe_customer_id = null;
  await admin().from("profiles").update(patch).eq("email", email);

  // Poll for webhook-synced non-premium state (typically "canceled")
  for (let i = 0; i < 10; i++) {
    const current = await queryProfile(email);
    if (!["trialing", "active", "past_due"].includes(current.subscription_status)) {
      return current;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return queryProfile(email);
}

function isPremiumProfile(profile) {
  return (
    !!profile.stripe_subscription_id &&
    ["trialing", "active", "past_due"].includes(profile.subscription_status)
  );
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
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);
}

async function login(page, email, password) {
  await authenticateContext(page.context(), email, password);
  await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    throw new Error("Auth cookie injection failed — redirected to login");
  }
}

async function apiFetch(page, path, init = {}) {
  return page.evaluate(
    async ({ path, init }) => {
      const res = await fetch(path, init);
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        json = { raw: text };
      }
      return { status: res.status, json };
    },
    { path, init }
  );
}

async function fillStripeCheckout(page, cardNumber, expectSuccess) {
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 30000 });

  for (let i = 0; i < 15; i++) {
    if (await page.locator("#cardNumber").count()) break;
    const cardAccordion = page.locator("#payment-method-accordion-item-title-card");
    if (await cardAccordion.count()) {
      await cardAccordion.click({ force: true });
    }
    await page.waitForTimeout(2000);
  }

  if (!(await page.locator("#cardNumber").count())) {
    const snippet = (await page.locator("body").innerText()).slice(0, 300);
    throw new Error(`Stripe card form not found. Page snippet: ${snippet}`);
  }
  await page.locator("#cardNumber").fill(cardNumber);
  await page.locator("#cardExpiry").fill("1234");
  await page.locator("#cardCvc").fill("123");
  await page.locator("#billingName").fill("Billing Test");
  if (await page.locator("#billingPostalCode").count()) {
    await page.locator("#billingPostalCode").fill("30303");
  }

  const submit = page.getByTestId("hosted-payment-submit-button");
  await submit.click();

  if (expectSuccess) {
    await page.waitForURL(/billing=success|\/settings/, { timeout: 120000 });
    return true;
  }

  await page.waitForTimeout(8000);
  const url = page.url();
  const body = await page.locator("body").innerText();
  return (
    url.includes("checkout.stripe.com") &&
    /declined|failed|unable|error|does not support/i.test(body)
  );
}

async function startCheckout(page, plan) {
  const { status, json } = await apiFetch(page, "/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plan }),
  });
  return { status, json };
}

async function main() {
  loadEnv();
  const email = process.env.CAMPUS_EMAIL || "campusos.billing.test@gsu.edu";
  const password = process.env.CAMPUS_PASSWORD || "";
  if (!password) {
    console.error("Set CAMPUS_PASSWORD");
    process.exit(1);
  }
  if (!existsSync(SYLLABUS)) {
    console.error(`Missing fixture ${SYLLABUS}`);
    process.exit(1);
  }

  console.log(`Billing E2E — ${email} @ ${BASE}\n`);

  const browser = await chromium.launch({
    headless: true,
    channel: process.env.PW_CHANNEL || "chrome",
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    await resetSubscriptionFields(email, true);
    await login(page, email, password);
    record("setup", true, "Logged in");

    // T1 — paywall on second syllabus
    const syllabusBytes = readFileSync(SYLLABUS);
    const b64 = Buffer.from(syllabusBytes).toString("base64");
    const t1 = await page.evaluate(
      async ({ b64, fileName }) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const form = new FormData();
        form.append(
          "file",
          new File([bytes], fileName, { type: "text/plain" })
        );
        const res = await fetch("/api/parse-syllabus", {
          method: "POST",
          body: form,
        });
        const json = await res.json().catch(() => ({}));
        return { status: res.status, json };
      },
      { b64, fileName: "sample-syllabus.txt" }
    );
    record(
      "T1_paywall",
      t1.status === 402 && t1.json?.error === "PAYWALL_REQUIRED",
      `status=${t1.status} error=${t1.json?.error ?? "none"}`
    );

    // T2 — monthly checkout success (4242)
    const t2start = await startCheckout(page, "monthly");
    if (t2start.status !== 200 || !t2start.json?.url) {
      record(
        "T2_monthly_checkout",
        false,
        `checkout start failed: ${t2start.status} ${t2start.json?.error ?? ""}`
      );
    } else {
      await page.goto(t2start.json.url, { waitUntil: "domcontentloaded" });
      const ok = await fillStripeCheckout(page, "4242424242424242", true);
      record("T2_monthly_checkout", ok, ok ? "redirected to success" : "no success redirect");
    }

    // T3 — webhook sync / DB state
    await page.waitForTimeout(3000);
    let profile = await queryProfile(email);
    const t3ok =
      profile.subscription_status === "trialing" &&
      !!profile.stripe_subscription_id?.startsWith("sub_") &&
      !!profile.stripe_customer_id?.startsWith("cus_");
    record(
      "T3_db_trialing",
      t3ok,
      `status=${profile.subscription_status} sub=${profile.stripe_subscription_id} cus=${profile.stripe_customer_id}`
    );

    // T4 — re-checkout blocked
    const t4 = await startCheckout(page, "monthly");
    record(
      "T4_recheckout_409",
      t4.status === 409,
      `status=${t4.status} error=${t4.json?.error ?? ""}`
    );

    // T5 — reset for failure test (webhook typically sets "canceled")
    profile = await resetSubscriptionFields(email, true);
    const t5ok = !isPremiumProfile(profile);
    record(
      "T5_reset",
      t5ok,
      `status=${profile.subscription_status} sub=${profile.stripe_subscription_id}`
    );

    // T6 — annual decline (0341)
    await login(page, email, password);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    const t6start = await startCheckout(page, "annual");
    let t6declined = false;
    if (t6start.status === 200 && t6start.json?.url) {
      await page.goto(t6start.json.url, { waitUntil: "domcontentloaded" });
      t6declined = await fillStripeCheckout(
        page,
        "4000000000000341",
        false
      );
    }
    record(
      "T6_annual_decline",
      t6declined,
      t6declined ? "decline shown on checkout" : "expected decline not detected"
    );

    // T7 — no premium after decline
    await login(page, email, password);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    profile = await queryProfile(email);
    const t7parse = await page.evaluate(async ({ b64, fileName }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append(
        "file",
        new File([bytes], fileName, { type: "text/plain" })
      );
      const res = await fetch("/api/parse-syllabus", {
        method: "POST",
        body: form,
      });
      return res.status;
    }, { b64, fileName: "sample-syllabus.txt" });
    const premium = isPremiumProfile(profile);
    record(
      "T7_no_premium_after_decline",
      !premium && t7parse === 402,
      `premium=${premium} parseStatus=${t7parse} sub=${profile.stripe_subscription_id}`
    );

    // T8 — annual success (4242)
    const t8start = await startCheckout(page, "annual");
    let t8ok = false;
    if (t8start.status === 200 && t8start.json?.url) {
      await page.goto(t8start.json.url, { waitUntil: "domcontentloaded" });
      t8ok = await fillStripeCheckout(page, "4242424242424242", true);
    }
    record(
      "T8_annual_success",
      t8ok,
      t8ok ? "redirected to success" : `start=${t8start.status}`
    );

    // T9 — active premium, parse allowed
    await page.waitForTimeout(3000);
    profile = await queryProfile(email);
    const t9parse = await page.evaluate(async ({ b64, fileName }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const form = new FormData();
      form.append(
        "file",
        new File([bytes], fileName, { type: "text/plain" })
      );
      const res = await fetch("/api/parse-syllabus", { method: "POST", body: form });
      const json = await res.json().catch(() => ({}));
      return { status: res.status, error: json.error };
    }, { b64, fileName: "sample-syllabus.txt" });
    const t9ok =
      profile.subscription_status === "active" &&
      !!profile.stripe_subscription_id &&
      t9parse.status === 200;
    record(
      "T9_active_premium_parse",
      t9ok,
      `status=${profile.subscription_status} parse=${t9parse.status} err=${t9parse.error ?? ""}`
    );
  } catch (err) {
    record("fatal", false, err instanceof Error ? err.message : String(err));
  } finally {
    await browser.close();
  }

  console.log("\n=== CONSOLIDATED REPORT ===");
  for (const r of results) {
    console.log(`${r.pass ? "PASS" : "FAIL"}\t${r.id}\t${r.detail}`);
  }
  const failed = results.filter((r) => !r.pass).length;
  process.exit(failed > 0 ? 1 : 0);
}

main();
