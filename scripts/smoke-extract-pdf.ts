/**
 * Mandatory local smoke: pdf-parse text extraction (DOMMatrix / CanvasFactory path).
 * Run: npm run smoke:extract
 *
 * Uses fixtures/sample-syllabus-cis8040.pdf (CIS 8040 Data Management), or falls
 * back to known Downloads paths for Marketing / other syllabi.
 */
import { existsSync, readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { extractSyllabusContent } from "../src/lib/extract";

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const candidates = [
  join(process.cwd(), "fixtures/sample-syllabus-cis8040.pdf"),
  join(homedir(), "Downloads/CIS 8040 syllabus-DrCasturi.pdf"),
  join(homedir(), "Downloads/MKTG_101_Introduction_to_Marketing_Study_Guide.pdf"),
  join(homedir(), "Downloads/CIS 8010 Syllabus-Spring 2026.pdf"),
];

async function main() {
  const pdfPath = candidates.find((p) => existsSync(p));
  assert(
    !!pdfPath,
    `No sample syllabus PDF found. Expected one of:\n${candidates.map((p) => `  - ${p}`).join("\n")}`
  );

  const buffer = readFileSync(pdfPath);
  assert(buffer.length > 1000, `PDF too small: ${pdfPath} (${buffer.length} bytes)`);

  const result = await extractSyllabusContent(
    buffer,
    "application/pdf",
    pdfPath.split("/").pop() || "syllabus.pdf"
  );

  assert(result.kind === "text", `expected text extraction, got ${result.kind}`);
  const text = result.text.replace(/\s+/g, " ").trim();
  assert(text.length >= 200, `extracted text too short (${text.length} chars) from ${pdfPath}`);

  const lower = text.toLowerCase();
  const looksLikeSyllabus =
    lower.includes("syllabus") ||
    lower.includes("course") ||
    lower.includes("grade") ||
    lower.includes("assignment") ||
    lower.includes("exam") ||
    lower.includes("cis ") ||
    lower.includes("mktg");

  assert(looksLikeSyllabus, `extracted text does not look like a syllabus from ${pdfPath}`);

  console.log("smoke:extract OK");
  console.log(`  file: ${pdfPath}`);
  console.log(`  bytes: ${buffer.length}`);
  console.log(`  chars: ${text.length}`);
  console.log(`  preview: ${text.slice(0, 160)}…`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
