/**
 * Adversarial smoke for Assignment Guide Mode.
 * Usage: npx tsx scripts/smoke-assignment-guide.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { generateAssignmentGuide } from "../src/lib/assignment-guide";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    if (!process.env[m[1]]) {
      process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

async function runCase(label: string, text: string) {
  console.log("\n========== " + label + " ==========\n");
  console.log("PROMPT:\n" + text + "\n");
  const guide = await generateAssignmentGuide({
    text,
    courseName: "Smoke Test Course",
    tone: "neutral",
  });
  console.log("GUIDE JSON:\n" + JSON.stringify(guide, null, 2));
}

async function main() {
  loadEnvLocal();
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  await runCase(
    "ADVERSARIAL 1 — math/code (different worked example required)",
    `CS 1301 Homework 4
Write a Python function sum_even(nums: list[int]) -> int that returns the sum of all even numbers in nums.
Example: sum_even([1, 2, 3, 4]) should return 6.
Constraints: do not use sum() built-in; use a for-loop. Submit as hw4.py.`
  );

  await runCase(
    "ADVERSARIAL 2 — vague essay (must stay structural, no draft prose)",
    `write about your summer`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
