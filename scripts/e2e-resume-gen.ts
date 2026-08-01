import { writeFileSync } from "fs";
import React from "react";
import { pdf } from "@react-pdf/renderer";
import { generateResumeWithClaude } from "../src/lib/claude";
import { getTemplateSpec } from "../src/lib/resume-templates";
import {
  parseTailoredResume,
  normalizeTailoredResume,
} from "../src/lib/resume-validate";
import { ResumePdfDocument } from "../src/components/ResumePdfDocument";

const userData = {
  resume_id: "e2e",
  full_name: "E2E Tester",
  state: "GA",
  phone: "404-555-0100",
  work_email: "campusos.e2e.20260729@gsu.edu",
  linkedin: null,
  professional_title: "CIS Student",
  school: "Georgia State University",
  major: "Computer Information Systems",
  concentration: "AI",
  minor: null,
  achievements: ["Dean List"],
  certifications: [{ label: "AWS Cloud Practitioner", isCustom: false }],
  projects: [
    {
      title: "CampusOS",
      description: "Student OS app",
      dateContext: "2026",
    },
  ],
  extracurriculars: ["Business Society"],
  experience: [
    {
      title: "Software Intern",
      company: "Acme Corp",
      location: "Atlanta, GA",
      endDate: "May 2026",
      bullets: [
        "Built enterprise features for campus tools",
        "Collaborated with product team on releases",
      ],
    },
  ],
};

async function main() {
  const template = getTemplateSpec("B");
  console.log("Calling Claude...");
  const text = await generateResumeWithClaude({
    userData,
    templateId: "B",
    templateSpec: {
      name: template.name,
      sectionOrder: template.sectionOrder,
      formattingNotes: template.formattingNotes,
    },
  });
  console.log("Claude preview:", text.slice(0, 240).replace(/\n/g, " "));

  let tailored;
  try {
    tailored = parseTailoredResume(JSON.parse(text), {
      requireExperience: true,
    });
  } catch (e) {
    console.error("VALIDATION_FAIL", e);
    console.error("RAW", text.slice(0, 2000));
    process.exit(1);
  }

  const normalized = normalizeTailoredResume(tailored);
  console.log("experience count:", normalized.experience.length);
  console.log("first title:", normalized.experience[0]?.title);
  console.log("bullets:", normalized.experience[0]?.bullets);

  const crashed = normalizeTailoredResume({
    education: tailored.education,
  } as never);
  console.log("normalize missing experience ->", crashed.experience.length);

  const blob = await pdf(
    React.createElement(ResumePdfDocument, {
      template: "B" as const,
      contact: {
        full_name: userData.full_name,
        state: userData.state,
        phone: userData.phone,
        work_email: userData.work_email,
        linkedin: null,
        professional_title: userData.professional_title,
      },
      content: normalized,
    }) as React.ReactElement
  ).toBlob();
  const buf = Buffer.from(await blob.arrayBuffer());
  writeFileSync("/tmp/e2e_resume.pdf", buf);
  const isPdf = buf.subarray(0, 4).toString() === "%PDF";
  console.log("PDF bytes:", buf.length, "valid:", isPdf);
  if (!normalized.experience.length) throw new Error("NO_EXPERIENCE_IN_OUTPUT");
  if (!isPdf) throw new Error("NOT_A_PDF");
  console.log("E2E_GENERATE_OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
