/**
 * Phase 1 smoke: diagnostic questions only.
 * Usage: npx tsx scripts/smoke-assignment-guide-diagnose.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { generateDiagnosticQuestions } from "../src/lib/assignment-guide";

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

  const text = `PHIL 201 — Argument Analysis Paper (due Friday)

Write a 1200–1500 word paper evaluating whether social media platforms should be legally required to label AI-generated political ads.

Your paper must:
1. State a clear thesis that takes a position.
2. Summarize at least two competing arguments from course readings (Week 6–7).
3. Apply at least one evaluative criterion from the unit (e.g. fairness, harm reduction, free expression, feasibility of enforcement).
4. Address one serious objection to your thesis.
5. Conclude with implications for democratic discourse — do not introduce new evidence in the conclusion.

Rubric emphasis: clarity of thesis (20%), use of readings (25%), criterion application (25%), objection handling (20%), writing mechanics (10%).
Do not submit AI-generated prose as your own writing.`;

  console.log("PROMPT:\n" + text + "\n");
  const questions = await generateDiagnosticQuestions({
    text,
    courseName: "PHIL 201",
    tone: "neutral",
  });
  console.log(JSON.stringify({ questions }, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
