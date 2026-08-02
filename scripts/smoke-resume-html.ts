/**
 * Smoke: HTML resume sanitize + DOCX (+ PDF when Chromium available).
 * Run: npx tsx scripts/smoke-resume-html.ts
 */
import { writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import {
  assertValidResumeHtml,
  sanitizeResumeHtml,
  wrapResumeDocument,
} from "../src/lib/resume-html";

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

const SAMPLE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Resume</title>
<style>
@page { size: letter; margin: 0.6in; }
body { font-family: Georgia, serif; color: #111; max-width: 8in; margin: 0 auto; }
h1 { text-align: center; font-size: 22pt; margin: 0 0 6px; }
.contact { text-align: center; font-size: 10pt; }
h2 { font-size: 11pt; text-transform: uppercase; border-bottom: 1px solid #222; margin: 14px 0 6px; }
.company { font-style: italic; }
</style>
</head>
<body>
<header>
  <h1>EDITED_NAME_SMOKE_XYZ</h1>
  <p class="contact">404-555-0100 | smoke@example.com | Des Moines, IA</p>
</header>
<section>
  <h2>Education</h2>
  <p><strong>EDITED_SCHOOL_SMOKE_XYZ University</strong> — Madison, WI</p>
  <p><em>B.S. Computer Science</em></p>
</section>
<section>
  <h2>Experience</h2>
  <p><strong>Analyst</strong> — Houston, TX</p>
  <p class="company">Houston Energy Partners — May 2024</p>
  <ul><li>EDITED_BULLET_SMOKE_XYZ measurable impact on reporting pipelines.</li></ul>
</section>
<script>alert('xss')</script>
</body>
</html>`;

async function main() {
  const cleaned = sanitizeResumeHtml(SAMPLE);
  assert(!/<script/i.test(cleaned), "script tags must be stripped");
  assert(cleaned.includes("EDITED_NAME_SMOKE_XYZ"), "name preserved");
  assert(cleaned.includes("Houston Energy Partners"), "company preserved");

  const doc = wrapResumeDocument(assertValidResumeHtml(cleaned));
  assert(/<html/i.test(doc), "full document wrapper");

  const HTMLtoDOCX = (await import("html-to-docx")).default;
  const docx = await HTMLtoDOCX(doc, null, {
    title: "Resume Smoke",
    creator: "CampusOS",
  });
  const docxBuf = Buffer.isBuffer(docx) ? docx : Buffer.from(docx as ArrayBuffer);
  assert(docxBuf.byteLength > 1000, "docx should be non-trivial");
  const docxPath = join(tmpdir(), "campusos-resume-html-smoke.docx");
  writeFileSync(docxPath, docxBuf);
  console.log("DOCX ok:", docxPath, docxBuf.byteLength, "bytes");

  if (process.env.SMOKE_RESUME_PDF === "1") {
    const { htmlToPdfBuffer } = await import("../src/lib/resume-pdf-chromium");
    const pdf = await htmlToPdfBuffer(doc);
    assert(pdf.byteLength > 1000, "pdf should be non-trivial");
    const pdfPath = join(tmpdir(), "campusos-resume-html-smoke.pdf");
    writeFileSync(pdfPath, pdf);
    console.log("PDF ok:", pdfPath, pdf.byteLength, "bytes");
  } else {
    console.log("PDF skipped (set SMOKE_RESUME_PDF=1 to run Chromium PDF)");
  }

  console.log("smoke-resume-html: PASS");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
