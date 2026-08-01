import { writeFileSync } from "fs";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { ResumePdfDocument } from "../src/components/ResumePdfDocument";

async function main() {
  const long =
    "Provided at-the-elbow support for campus advisors while coordinating multi-week outreach campaigns across Atlanta metro high schools and community colleges with measurable enrollment lift.";
  const blob = await pdf(
    React.createElement(ResumePdfDocument, {
      template: "B" as const,
      contact: {
        full_name: "Test User",
        state: "GA",
        phone: "404-555-0100",
        work_email: "a@b.com",
        linkedin: null,
        professional_title: "Student",
      },
      content: {
        education: {
          school: "GSU",
          degreeLine: "BS CIS",
          location: null,
          date: "2026",
          details: [],
        },
        experience: [
          {
            title: "Intern",
            company: "Acme",
            location: "Houston",
            state: "TX",
            endDate: "2026",
            bullets: [long, "Second short bullet"],
          },
        ],
        summary: "Student with internship experience.",
        professionalSkills: [],
        technicalSkills: [],
      },
    }) as React.ReactElement
  ).toBlob();
  const buf = Buffer.from(await blob.arrayBuffer());
  writeFileSync("/tmp/wrap_test.pdf", buf);
  const ok = buf.subarray(0, 4).toString() === "%PDF";
  console.log("PDF bytes", buf.length, "valid", ok);
  if (!ok) process.exit(1);
  console.log("WRAP_PDF_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
