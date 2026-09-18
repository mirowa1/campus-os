/**
 * Adversarial: diagnostic answer includes broken real Python.
 * Usage: npx tsx scripts/smoke-assignment-guide-code-guard.ts
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

async function main() {
  loadEnvLocal();
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("Missing ANTHROPIC_API_KEY");
  }

  const text = `CS 1301 Homework 4
Write a Python function sum_even(nums: list[int]) -> int that returns the sum of all even numbers in nums.
Example: sum_even([1, 2, 3, 4]) should return 6.
Constraints: do not use sum() built-in; use a for-loop. Submit as hw4.py.`;

  const brokenPaste = `tried something:
def sum_even(nums):
  total = 0
  for n in nums
    if n % 2 == 0:
      total = total + n
  return total`;

  const result = await generateAssignmentGuide({
    text,
    courseName: "CS 1301",
    tone: "neutral",
    diagnosticAnswers: [
      {
        questionId: "hardest_part",
        value: "for-loop logic / syntax",
      },
      {
        questionId: "already_tried",
        value: brokenPaste,
      },
    ],
  });

  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
