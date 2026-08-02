/**
 * Verify expected resume schema columns exist on the live Supabase project.
 * Run after applying migrations: npx tsx scripts/verify-resume-schema.ts
 *
 * Exits non-zero if any required column is missing.
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnvLocal(): Record<string, string> {
  const raw = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
  const out: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return out;
}

async function probe(
  baseUrl: string,
  anon: string,
  table: string,
  select: string
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(
    `${baseUrl}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=1`,
    {
      headers: {
        apikey: anon,
        Authorization: `Bearer ${anon}`,
        Accept: "application/json",
      },
    }
  );
  const body = await res.text();
  return { ok: res.ok, status: res.status, body: body.slice(0, 400) };
}

async function main() {
  const env = loadEnvLocal();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY in .env.local");
  }

  const checks: { table: string; select: string; label: string }[] = [
    {
      table: "resumes",
      select: "id,generated_html,generated_content,template_choice",
      label: "resumes.generated_html (migration 013)",
    },
    {
      table: "resume_data",
      select: "resume_id,city,education_location,education_state",
      label: "resume_data.city + education fields (012 / earlier)",
    },
  ];

  let failed = 0;
  for (const c of checks) {
    const result = await probe(url, anon, c.table, c.select);
    if (result.ok) {
      console.log(`OK  ${c.label}`);
    } else {
      failed += 1;
      console.error(`FAIL ${c.label}`);
      console.error(`     HTTP ${result.status}: ${result.body}`);
    }
  }

  if (failed) {
    console.error(
      `\n${failed} schema check(s) failed. Apply the matching supabase/migrations/*.sql to the live DB, then re-run.`
    );
    process.exit(1);
  }
  console.log("\nverify-resume-schema: PASS (live DB has required columns)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
