#!/usr/bin/env node
/**
 * One-shot: apply 016+017 using SUPABASE_ACCESS_TOKEN, then probe tables.
 * Does not print secrets.
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

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

async function runSql(sql, label) {
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  if (!token) throw new Error("SUPABASE_ACCESS_TOKEN missing");
  const project = process.env.SUPABASE_PROJECT_REF || "zbfnysljwyebktmxazii";
  const res = await fetch(
    `https://api.supabase.com/v1/projects/${project}/database/query`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "Mozilla/5.0",
      },
      body: JSON.stringify({ query: sql }),
    }
  );
  const text = await res.text();
  if (!res.ok) throw new Error(`${label}: ${res.status} ${text}`);
  console.log(label, "applied");
}

async function probe() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  for (const table of [
    "class_meetings",
    "google_calendar_connections",
    "google_calendar_event_map",
  ]) {
    const res = await fetch(`${url}/rest/v1/${table}?select=*&limit=0`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    console.log("probe", table, res.status === 200 ? "OK" : `FAIL ${res.status}`);
  }
}

loadEnv();
const root = join(process.cwd(), "supabase/migrations");
await runSql(readFileSync(join(root, "016_class_meetings.sql"), "utf8"), "016");
await runSql(readFileSync(join(root, "017_google_calendar.sql"), "utf8"), "017");
await probe();
