import { writeFileSync } from "fs";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { StudyGuidePdfDocument } from "../src/components/StudyGuidePdfDocument";

async function main() {
  const blob = await pdf(
    React.createElement(StudyGuidePdfDocument, {
      classLabel: "CIS 8045 — Multi-Agent Systems",
      generatedAt: "2026-07-30T12:00:00.000Z",
      content: [
        "# Overview",
        "Agents coordinate via shared memory.",
        "## Key concepts",
        "- Tool calling",
        "- Planning loops",
        "- Evaluation harnesses",
        "",
        "A short paragraph about grounded generation.",
      ].join("\n"),
    }) as React.ReactElement
  ).toBlob();

  const buf = Buffer.from(await blob.arrayBuffer());
  writeFileSync("/tmp/study_guide_smoke.pdf", buf);
  const ok = buf.subarray(0, 4).toString() === "%PDF";
  console.log("PDF bytes", buf.length, "valid", ok);
  if (!ok) process.exit(1);
  console.log("STUDY_GUIDE_PDF_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
