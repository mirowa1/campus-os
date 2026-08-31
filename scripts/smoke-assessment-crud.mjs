/**
 * Assessment CRUD API smoke test (Sections 2 & 3).
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const BASE = process.env.TEST_BASE_URL || "http://localhost:3000";
const results = [];

function loadEnv() {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

function record(id, pass, detail) {
  results.push({ id, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${id}: ${detail}`);
}

function admin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

function cookieDomainForBase(baseUrl) {
  const hostname = new URL(baseUrl).hostname;
  if (hostname === "localhost" || hostname.endsWith(".local")) return hostname;
  const parts = hostname.split(".");
  return parts.length >= 2 ? `.${parts.slice(-2).join(".")}` : hostname;
}

async function authenticateContext(context, email, password) {
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(error?.message || "Supabase sign-in failed");
  const projectRef = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  const sessionPayload = JSON.stringify({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
    expires_at: data.session.expires_at,
    expires_in: data.session.expires_in,
    token_type: data.session.token_type,
    user: data.session.user,
  });
  await context.clearCookies();
  await context.addCookies([{ name: `sb-${projectRef}-auth-token`, value: `base64-${Buffer.from(sessionPayload).toString("base64")}`, domain: cookieDomainForBase(BASE), path: "/", sameSite: "Lax" }]);
  return data.session.user.id;
}

async function apiCall(page, classId, method, path, body) {
  return page.evaluate(async ({ classId, method, path, body }) => {
    const res = await fetch(`/api/classes/${classId}/assessments${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, json: await res.json().catch(() => ({})) };
  }, { classId, method, path, body });
}

async function main() {
  loadEnv();
  const email = process.env.TEST_EMAIL?.trim();
  const password = process.env.CAMPUS_PASSWORD?.trim();
  if (!email || !password) { console.error("Set TEST_EMAIL and CAMPUS_PASSWORD"); process.exit(1); }
  console.log(`Assessment CRUD smoke — ${email} @ ${BASE}\n`);
  const browser = await chromium.launch({ headless: true, channel: process.env.PW_CHANNEL || "chrome" });
  const page = await (await browser.newContext()).newPage();
  try {
    const userId = await authenticateContext(page.context(), email, password);
    await page.goto(`${BASE}/dashboard`, { waitUntil: "domcontentloaded" });
    record("setup", !page.url().includes("/login"), `url=${page.url()}`);
    const { data: cls } = await admin().from("classes").select("id").eq("user_id", userId).limit(1).maybeSingle();
    if (!cls?.id) { record("class_exists", false, "no class"); process.exit(1); }
    const classId = cls.id;
    const created = await apiCall(page, classId, "POST", "", { title: "Smoke Test HW", type: "assignment", due_date: "2026-09-15", weight_percent: 15 });
    const a = created.json?.assessment;
    record("post_create", created.status === 200 && a?.title === "Smoke Test HW", `status=${created.status}`);
    record("post_field_mapping", a?.weight_percent === 15 && a?.max_score === 100 && a?.due_date === "2026-09-15", `weight=${a?.weight_percent} max=${a?.max_score} due=${a?.due_date}`);
    if (!a?.id) process.exit(1);
    const patched = await apiCall(page, classId, "PATCH", `/${a.id}`, { title: "Smoke Test HW Updated", type: "quiz", due_date: "2026-09-20", weight_percent: 20 });
    const u = patched.json?.assessment;
    record("patch_update", patched.status === 200 && u?.title === "Smoke Test HW Updated" && u?.weight_percent === 20, `status=${patched.status} title=${u?.title}`);
    const deleted = await apiCall(page, classId, "DELETE", `/${a.id}`, null);
    record("delete_cleanup", deleted.status === 200, `status=${deleted.status}`);
    const { data: midterms } = await admin().from("assessments").select("title, weight_percent, max_score, due_date, type").eq("class_id", classId).ilike("title", "%midterm%");
    record("midterm_db_check", true, JSON.stringify(midterms ?? []));
  } finally { await browser.close(); }
  const failed = results.filter((r) => !r.pass && r.id !== "midterm_db_check");
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
