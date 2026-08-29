/**
 * Smoke-test Stripe env prefixes (never prints full secrets).
 * Run: node scripts/smoke-stripe-env.mjs
 */
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, ".env.local");
if (!existsSync(path)) {
  console.error("Missing .env.local");
  process.exit(1);
}

const env = readFileSync(path, "utf8");
function get(k) {
  const m = env.match(new RegExp(`^${k}=(.*)$`, "m"));
  if (!m) return null;
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function prefix(v) {
  if (!v) return "missing";
  if (v.startsWith("sk_test")) return "sk_test";
  if (v.startsWith("sk_live")) return "sk_live";
  if (v.startsWith("pk_test")) return "pk_test";
  if (v.startsWith("pk_live")) return "pk_live";
  if (v.startsWith("whsec_")) return "whsec_…";
  return v.slice(0, 8) + "…";
}

const secret = get("STRIPE_SECRET_KEY");
const pub = get("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY");
const webhook = get("STRIPE_WEBHOOK_SECRET");

console.log("STRIPE_SECRET_KEY:", prefix(secret));
console.log("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY:", prefix(pub));
console.log("STRIPE_WEBHOOK_SECRET:", webhook ? prefix(webhook) : "missing/empty");

const ok = prefix(secret) === "sk_test" && prefix(pub) === "pk_test";
if (!ok) {
  console.error("FAIL: expected sk_test + pk_test");
  process.exit(1);
}
console.log("OK: test-mode prefixes confirmed");
